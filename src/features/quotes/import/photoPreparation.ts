import { MAX_QUOTE_DOCUMENT_BYTES } from "./types"
import { imageDimensions, MAX_QUOTE_IMAGE_PIXELS } from "./imageDimensions"
import { photoGeometry, photoSharpness, type PhotoAdjustments } from "./photoGeometry"

export function checkPhotoAbort(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Préparation annulée.", "AbortError")
}

export async function decodeQuotePhoto(
  file: File,
  signal: AbortSignal,
): Promise<ImageBitmap> {
  checkPhotoAbort(signal)
  if (!file.size) throw new Error("Ce fichier est vide. Choisissez une autre photo.")
  if (file.size > MAX_QUOTE_DOCUMENT_BYTES)
    throw new Error("La photo dépasse 10 Mo. Choisissez un fichier plus léger.")
  const bytes = new Uint8Array(await file.arrayBuffer())
  checkPhotoAbort(signal)
  const dimensions = imageDimensions(bytes)
  if (!dimensions)
    throw new Error(
      "Format non reconnu. Choisissez un JPEG, PNG ou WebP. Pour une photo HEIC, exportez-la en JPEG.",
    )
  if (
    !dimensions.width ||
    !dimensions.height ||
    dimensions.width * dimensions.height > MAX_QUOTE_IMAGE_PIXELS
  )
    throw new Error("Cette photo est trop grande. Réduisez-la à 32 mégapixels maximum.")
  // Native decoding applies the phone's EXIF orientation before manual rotation.
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(new Blob([bytes], { type: dimensions.mime }), {
      imageOrientation: "from-image",
    })
  } catch {
    checkPhotoAbort(signal)
    throw new Error(
      "Cette photo est illisible ou endommagée. Choisissez une autre copie.",
    )
  }
  if (signal.aborted) {
    bitmap.close()
    checkPhotoAbort(signal)
  }
  return bitmap
}

export function renderQuotePhoto(
  bitmap: ImageBitmap,
  value: PhotoAdjustments,
  maxEdge = 3000,
  maxPixels = 6_000_000,
): HTMLCanvasElement {
  const geometry = photoGeometry(bitmap.width, bitmap.height, value)
  const scale = Math.min(
    1,
    maxEdge / Math.max(geometry.width, geometry.height),
    Math.sqrt(maxPixels / (geometry.width * geometry.height)),
  )
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.floor(geometry.width * scale))
  canvas.height = Math.max(1, Math.floor(geometry.height * scale))
  const context = canvas.getContext("2d", { alpha: false })
  if (!context)
    throw new Error(
      "Cet appareil ne permet pas de préparer les photos. Essayez un autre navigateur.",
    )
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  // Transform directly into the bounded output canvas; no full-size duplicate.
  context.scale(scale, scale)
  context.translate(
    geometry.fullWidth / 2 - geometry.x,
    geometry.fullHeight / 2 - geometry.y,
  )
  context.rotate(geometry.radians)
  context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
  return canvas
}

export function quotePhotoWarning(bitmap: ImageBitmap, value: PhotoAdjustments) {
  const canvas = renderQuotePhoto(bitmap, value, 1024, 1_048_576)
  try {
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context || canvas.width < 3 || canvas.height < 3) return null
    return photoSharpness(
      context.getImageData(0, 0, canvas.width, canvas.height).data,
      canvas.width,
      canvas.height,
    ).warning
  } finally {
    canvas.width = canvas.height = 1
  }
}

export async function quotePhotoBlob(
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
  quality = 0.94,
): Promise<Blob> {
  checkPhotoAbort(signal)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) =>
        result
          ? resolve(result)
          : reject(new Error("Cette photo n’a pas pu être préparée.")),
      "image/jpeg",
      quality,
    ),
  )
  checkPhotoAbort(signal)
  return blob
}

export async function applyQuotePhoto(
  bitmap: ImageBitmap,
  value: PhotoAdjustments,
  file: File,
  signal: AbortSignal,
): Promise<File> {
  checkPhotoAbort(signal)
  const canvas = renderQuotePhoto(bitmap, value)
  try {
    const blob = await quotePhotoBlob(canvas, signal)
    if (blob.size > MAX_QUOTE_DOCUMENT_BYTES)
      throw new Error(
        "La photo préparée dépasse 10 Mo. Réduisez la zone à importer ou choisissez une autre photo.",
      )
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    })
  } finally {
    canvas.width = canvas.height = 1
  }
}
