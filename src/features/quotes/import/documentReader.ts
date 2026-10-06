import { extractQuoteFields } from "./extractQuoteFields"
import { MAX_QUOTE_DOCUMENT_BYTES, MAX_QUOTE_DOCUMENT_PAGES } from "./types"
import type { DocumentPreparationOptions, PreparedQuoteDocument } from "./types"
import { LocalOcr } from "./localOcr"
import { quotePageText, type PdfTextItem } from "./pdfText"

import { imageDimensions, MAX_QUOTE_IMAGE_PIXELS } from "./imageDimensions"
const MAX_RASTER_PIXELS = 6_000_000
const ASSETS = `${import.meta.env.BASE_URL}document-reader/`

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Lecture annulée.", "AbortError")
}

async function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  stop?: () => void,
): Promise<T> {
  throwIfAborted(signal)
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      stop?.()
      reject(new DOMException("Lecture annulée.", "AbortError"))
    }
    signal.addEventListener("abort", abort, { once: true })
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort))
  })
}

function canvasBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("L’aperçu du document n’a pas pu être créé.")),
      "image/jpeg",
      quality,
    )
  })
}

function makeCanvas(width: number, height: number, maxEdge: number): HTMLCanvasElement {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error("Les dimensions du document sont invalides.")
  const scale = Math.min(
    1,
    maxEdge / Math.max(width, height),
    Math.sqrt(MAX_RASTER_PIXELS / (width * height)),
  )
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.floor(width * scale))
  canvas.height = Math.max(1, Math.floor(height * scale))
  return canvas
}

export async function prepareQuoteDocument(
  file: File,
  options: DocumentPreparationOptions = {},
): Promise<PreparedQuoteDocument> {
  if (!file.size)
    throw new Error("Ce fichier est vide. Choisissez un devis PDF ou une photo.")
  if (file.size > MAX_QUOTE_DOCUMENT_BYTES)
    throw new Error("Le document dépasse 10 Mo. Choisissez un fichier plus léger.")
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener("abort", abort, { once: true })
  if (options.signal?.aborted) controller.abort()
  let timedOut = false
  const timeout = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 240_000)
  const signal = controller.signal
  let worker: LocalOcr | undefined
  const warnings: string[] = []
  const progress = (value: number, label: string) =>
    options.onProgress?.({ progress: Math.max(0, Math.min(1, value)), label })
  let ocrProgressStart = 0.2
  let ocrProgressSpan = 0.65
  const lowConfidenceText: string[] = []

  const recognize = async (canvas: HTMLCanvasElement): Promise<string> => {
    throwIfAborted(signal)
    if (!worker) {
      progress(ocrProgressStart, "Préparation de la lecture sur cet appareil…")
      worker = new LocalOcr(ASSETS, signal, (value) =>
        progress(
          ocrProgressStart + value * ocrProgressSpan,
          "Lecture du document sur cet appareil…",
        ),
      )
    }
    const image = await abortable(
      canvasBlob(canvas).then((blob) => blob.arrayBuffer()),
      signal,
    )
    const result = await worker.recognize(image)
    if (result.confidence < 60) {
      lowConfidenceText.push(result.text)
      warnings.push(
        "La photo ou le scan manque de netteté. Vérifiez attentivement les informations proposées.",
      )
    }
    return result.text
  }

  try {
    throwIfAborted(signal)
    progress(0.02, "Vérification du document…")
    const bytes = new Uint8Array(await abortable(file.arrayBuffer(), signal))
    const header = new TextDecoder("ascii").decode(bytes.slice(0, 1024))
    let pdf: File
    let preview: Blob
    let text = ""
    if (header.startsWith("%PDF-")) {
      const pdfjs = await import("pdfjs-dist")
      const { default: workerUrl } =
        await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      throwIfAborted(signal)
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      const loading = pdfjs.getDocument({
        data: bytes,
        stopAtErrors: true,
        maxImageSize: MAX_QUOTE_IMAGE_PIXELS,
        canvasMaxAreaInBytes: MAX_RASTER_PIXELS * 4,
        cMapUrl: `${ASSETS}pdf/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${ASSETS}pdf/standard_fonts/`,
        wasmUrl: `${ASSETS}pdf/wasm/`,
        useWorkerFetch: false,
      })
      try {
        const document = await abortable(loading.promise, signal, () => {
          void loading.destroy()
        })
        if (document.numPages > MAX_QUOTE_DOCUMENT_PAGES)
          throw new Error(
            "Le devis dépasse 10 pages. Importez un document de 10 pages maximum.",
          )
        let firstPreview: Blob | undefined
        for (let pageIndex = 1; pageIndex <= document.numPages; pageIndex++) {
          throwIfAborted(signal)
          progress(
            0.1 + ((pageIndex - 1) / document.numPages) * 0.75,
            `Lecture de la page ${pageIndex} sur ${document.numPages}…`,
          )
          const page = await abortable(document.getPage(pageIndex), signal)
          const viewport = page.getViewport({ scale: 1 })
          const content = await abortable(page.getTextContent(), signal)
          const items = content.items.filter(
            (item): item is typeof item & PdfTextItem => "str" in item,
          )
          let currentText = quotePageText(items, viewport.width).slice(0, 160_000)
          const needsOcr = currentText.replace(/\W/g, "").length < 60
          if (pageIndex === 1 || needsOcr) {
            const canvas = makeCanvas(
              viewport.width * 3,
              viewport.height * 3,
              needsOcr ? 2400 : 1200,
            )
            const context = canvas.getContext("2d", { alpha: false })
            if (!context)
              throw new Error(
                "Cet appareil ne permet pas de lire les documents. Essayez un autre navigateur.",
              )
            const renderViewport = page.getViewport({
              scale: canvas.width / viewport.width,
            })
            const render = page.render({
              canvasContext: context,
              canvas,
              viewport: renderViewport,
              background: "rgb(255,255,255)",
            })
            try {
              await abortable(render.promise, signal, () => render.cancel())
              if (pageIndex === 1) firstPreview = await canvasBlob(canvas, 0.8)
              if (needsOcr) {
                ocrProgressStart = 0.1 + ((pageIndex - 1) / document.numPages) * 0.75
                ocrProgressSpan = 0.75 / document.numPages
                try {
                  currentText = await recognize(canvas)
                } catch (error) {
                  throwIfAborted(signal)
                  warnings.push(
                    "La lecture automatique du scan est indisponible. Le PDF reste importé et les champs peuvent être complétés manuellement.",
                  )
                  if (error instanceof Error && error.name === "AbortError") throw error
                }
              }
            } finally {
              canvas.width = 1
              canvas.height = 1
            }
          }
          text += `${currentText}\n`
          page.cleanup()
        }
        if (!firstPreview) throw new Error("Ce PDF ne contient aucune page lisible.")
        preview = firstPreview
        pdf = new File([file], file.name.replace(/\.pdf$/i, "") + ".pdf", {
          type: "application/pdf",
          lastModified: file.lastModified,
        })
      } finally {
        await loading.destroy()
      }
    } else {
      const dimensions = imageDimensions(bytes)
      if (!dimensions)
        throw new Error(
          "Format non reconnu. Choisissez un PDF ou une photo JPEG, PNG ou WebP. Pour une photo HEIC, exportez-la en JPEG.",
        )
      if (
        dimensions.width * dimensions.height > MAX_QUOTE_IMAGE_PIXELS ||
        !dimensions.width ||
        !dimensions.height
      )
        throw new Error(
          "Cette photo est trop grande. Réduisez-la à 32 mégapixels maximum.",
        )
      const bitmapPromise = createImageBitmap(
        new Blob([bytes], { type: dimensions.mime }),
        { imageOrientation: "from-image" },
      )
      const bitmap = await abortable(bitmapPromise, signal, () => {
        void bitmapPromise.then(
          (image) => image.close(),
          () => undefined,
        )
      })
      const canvas = makeCanvas(bitmap.width, bitmap.height, 3000)
      const context = canvas.getContext("2d", { alpha: false })
      if (!context) {
        bitmap.close()
        throw new Error(
          "Cet appareil ne permet pas de lire les photos. Essayez un autre navigateur.",
        )
      }
      try {
        context.fillStyle = "#ffffff"
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        bitmap.close()
        const jpeg = await canvasBlob(canvas)
        preview = jpeg
        const { PDFDocument } = await import("pdf-lib")
        throwIfAborted(signal)
        const document = await PDFDocument.create()
        const image = await document.embedJpg(await jpeg.arrayBuffer())
        const pageWidth = 595.28
        const pageHeight = (pageWidth * canvas.height) / canvas.width
        const page = document.addPage([pageWidth, pageHeight])
        page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight })
        const output = await document.save()
        pdf = new File(
          [new Uint8Array(output).buffer],
          `${file.name.replace(/\.[^.]+$/, "")}.pdf`,
          { type: "application/pdf" },
        )
        try {
          text = await recognize(canvas)
        } catch {
          throwIfAborted(signal)
          warnings.push(
            "La lecture automatique de la photo est indisponible. Le document reste importé et les champs peuvent être complétés manuellement.",
          )
        }
      } finally {
        bitmap.close()
        canvas.width = 1
        canvas.height = 1
      }
    }
    throwIfAborted(signal)
    const extracted = extractQuoteFields(text, { lowConfidenceText })
    progress(1, "Document prêt à vérifier.")
    return {
      pdf,
      preview,
      fields: extracted.fields,
      review: extracted.review,
      warnings: [...new Set([...warnings, ...extracted.warnings])],
    }
  } catch (error) {
    if (timedOut)
      throw new Error(
        "La lecture a pris trop de temps. Essayez un PDF ou une photo plus légère.",
      )
    if (signal.aborted) throw new DOMException("Lecture annulée.", "AbortError")
    if (error instanceof Error && error.name === "PasswordException")
      throw new Error(
        "Ce PDF est protégé par un mot de passe. Importez une copie déverrouillée.",
      )
    if (
      error instanceof Error &&
      ["InvalidPDFException", "UnknownErrorException", "EncodingError"].includes(
        error.name,
      )
    )
      throw new Error(
        "Ce document est illisible ou endommagé. Essayez une autre copie.",
      )
    throw error
  } finally {
    window.clearTimeout(timeout)
    options.signal?.removeEventListener("abort", abort)
    worker?.close()
  }
}
