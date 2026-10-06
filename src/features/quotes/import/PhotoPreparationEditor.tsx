import { useEffect, useRef, useState } from "react"
import { Crop, RotateCcw, RotateCw, X } from "lucide-react"
import { Button, Input } from "@/components/ui"
import {
  DEFAULT_PHOTO_ADJUSTMENTS,
  normalizePhotoAdjustments,
  type PhotoAdjustments,
  type PhotoCrop,
} from "./photoGeometry"
import {
  applyQuotePhoto,
  decodeQuotePhoto,
  quotePhotoBlob,
  quotePhotoWarning,
  renderQuotePhoto,
} from "./photoPreparation"

export function PhotoPreparationEditor({
  file,
  disabled,
  onApply,
  onCancel,
}: {
  file: File
  disabled: boolean
  onApply: (file: File, warnings: string[]) => void
  onCancel: () => void
}) {
  const bitmap = useRef<ImageBitmap | null>(null)
  const applyController = useRef<AbortController | null>(null)
  const [ready, setReady] = useState(false)
  const [adjustments, setAdjustments] = useState<PhotoAdjustments>(
    DEFAULT_PHOTO_ADJUSTMENTS,
  )
  const [angleInput, setAngleInput] = useState("0")
  const [preview, setPreview] = useState("")
  const [warning, setWarning] = useState<"blurred" | "low-detail" | null>(null)
  const [error, setError] = useState("")
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void decodeQuotePhoto(file, controller.signal)
      .then((image) => {
        if (controller.signal.aborted) {
          image.close()
          return
        }
        bitmap.current = image
        setReady(true)
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Cette photo n’a pas pu être ouverte.",
          )
      })
    return () => {
      controller.abort()
      applyController.current?.abort()
      bitmap.current?.close()
      bitmap.current = null
    }
  }, [file])

  useEffect(() => {
    if (!ready || !bitmap.current) return
    const controller = new AbortController()
    let url = ""
    const frame = requestAnimationFrame(() => {
      if (!bitmap.current || controller.signal.aborted) return
      const image = bitmap.current
      let canvas: HTMLCanvasElement | undefined
      try {
        canvas = renderQuotePhoto(image, adjustments, 1600, 2_000_000)
        setWarning(quotePhotoWarning(image, adjustments))
        void quotePhotoBlob(canvas, controller.signal, 0.85)
          .then((blob) => {
            if (controller.signal.aborted) return
            url = URL.createObjectURL(blob)
            setPreview(url)
          })
          .catch((error) => {
            if (!controller.signal.aborted)
              setError(
                error instanceof Error ? error.message : "L’aperçu est indisponible.",
              )
          })
          .finally(() => {
            if (canvas) canvas.width = canvas.height = 1
          })
      } catch (error) {
        if (canvas) canvas.width = canvas.height = 1
        setError(error instanceof Error ? error.message : "L’aperçu est indisponible.")
      }
    })
    return () => {
      controller.abort()
      cancelAnimationFrame(frame)
      if (url) URL.revokeObjectURL(url)
    }
  }, [ready, adjustments])

  function updateCrop(edge: keyof PhotoCrop, value: number) {
    setAdjustments((current) =>
      normalizePhotoAdjustments({
        ...current,
        crop: { ...current.crop, [edge]: value },
      }),
    )
  }

  function rotate(direction: number) {
    setAdjustments((current) =>
      normalizePhotoAdjustments({
        ...current,
        rotation: current.rotation + direction,
        crop: DEFAULT_PHOTO_ADJUSTMENTS.crop,
      }),
    )
  }

  async function apply() {
    if (!bitmap.current || disabled || applying) return
    const controller = new AbortController()
    applyController.current = controller
    setApplying(true)
    setError("")
    try {
      const appliedWarning = quotePhotoWarning(bitmap.current, adjustments)
      const prepared = await applyQuotePhoto(
        bitmap.current,
        adjustments,
        file,
        controller.signal,
      )
      if (controller.signal.aborted || applyController.current !== controller) return
      onApply(
        prepared,
        appliedWarning === "blurred"
          ? [
              "La photo semble manquer de netteté. Vérifiez les informations proposées avec le document.",
            ]
          : appliedWarning === "low-detail"
            ? [
                "Peu de détails sont visibles sur la photo. Vérifiez que le devis complet est lisible.",
              ]
            : [],
      )
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "Cette photo n’a pas pu être préparée.",
        )
    } finally {
      if (!controller.signal.aborted && applyController.current === controller) {
        applyController.current = null
        setApplying(false)
      }
    }
  }

  const controlsDisabled = disabled || applying || !ready || !!error
  return (
    <section
      className="mt-5 min-w-0 space-y-4 border-t border-line pt-4"
      aria-labelledby="quote-photo-preparation-title"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            id="quote-photo-preparation-title"
            className="flex items-center gap-2 text-sm font-semibold text-ink"
          >
            <Crop size={16} aria-hidden="true" /> Préparer la photo
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Gardez tout le devis dans le cadre. Tournez ou redressez la photo, puis
            lancez la lecture.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 shrink-0"
          disabled={disabled}
          onClick={onCancel}
          aria-label="Annuler la préparation de la photo"
        >
          <X size={16} aria-hidden="true" />
        </Button>
      </div>
      {!ready && !error && (
        <p role="status" className="text-sm text-muted">
          Ouverture de la photo…
        </p>
      )}
      {preview && (
        <div
          className="max-h-[30rem] overflow-y-auto rounded-lg border border-line bg-background p-2 focus-visible:outline-2 focus-visible:outline-primary"
          role="region"
          aria-label="Aperçu de la photo préparée"
          tabIndex={0}
        >
          <img
            src={preview}
            alt="Devis après rotation, redressement et recadrage"
            className="mx-auto h-auto max-w-full"
          />
        </div>
      )}
      {ready && (
        <fieldset disabled={controlsDisabled} className="min-w-0 space-y-4">
          <legend className="sr-only">Réglages de la photo</legend>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => rotate(-90)}
            >
              <RotateCcw size={16} aria-hidden="true" /> Tourner à gauche
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => rotate(90)}
            >
              <RotateCw size={16} aria-hidden="true" /> Tourner à droite
            </Button>
          </div>
          <div>
            <label
              htmlFor="quote-photo-angle"
              className="block text-sm font-medium text-ink"
            >
              Redresser la photo : {adjustments.angle.toFixed(1)}°
            </label>
            <div className="mt-2 flex min-w-0 items-center gap-3">
              <input
                id="quote-photo-angle"
                type="range"
                min={-15}
                max={15}
                step={0.1}
                value={adjustments.angle}
                onChange={(event) => {
                  setAngleInput(event.target.value)
                  setAdjustments((current) => ({
                    ...current,
                    angle: Number(event.target.value),
                  }))
                }}
                className="h-11 min-w-0 flex-1 accent-primary"
                aria-describedby="quote-photo-angle-help"
              />
              <Input
                type="number"
                min={-15}
                max={15}
                step={0.1}
                value={angleInput}
                onChange={(event) => {
                  const value = event.target.value
                  setAngleInput(value)
                  if (value !== "" && Number.isFinite(Number(value)))
                    setAdjustments((current) =>
                      normalizePhotoAdjustments({ ...current, angle: Number(value) }),
                    )
                }}
                onBlur={() => setAngleInput(String(adjustments.angle))}
                className="min-h-11 w-24"
                aria-label="Angle de redressement en degrés"
              />
            </div>
            <p id="quote-photo-angle-help" className="text-xs leading-5 text-muted">
              Ajustez l’angle jusqu’à ce que les lignes du texte soient horizontales.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-ink">Recadrer les bords</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Pourcentage à retirer de chaque bord. Vérifiez que les coordonnées et le
              montant restent visibles.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(
                [
                  ["left", "À gauche"],
                  ["right", "À droite"],
                  ["top", "En haut"],
                  ["bottom", "En bas"],
                ] as const
              ).map(([edge, label]) => (
                <div key={edge} className="min-w-0">
                  <label
                    htmlFor={`quote-photo-crop-${edge}`}
                    className="mb-1 block text-xs font-medium text-ink"
                  >
                    {label} (%)
                  </label>
                  <Input
                    id={`quote-photo-crop-${edge}`}
                    type="number"
                    min={0}
                    max={45}
                    step={1}
                    inputMode="numeric"
                    value={adjustments.crop[edge]}
                    onChange={(event) => updateCrop(edge, Number(event.target.value))}
                    className="min-h-11 w-full"
                  />
                </div>
              ))}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            onClick={() => {
              setAdjustments(DEFAULT_PHOTO_ADJUSTMENTS)
              setAngleInput("0")
            }}
          >
            Réinitialiser les réglages
          </Button>
        </fieldset>
      )}
      {warning && (
        <p
          className="rounded-lg bg-warning-soft p-3 text-sm leading-6 text-warning"
          role="status"
        >
          {warning === "blurred"
            ? "Cette photo semble manquer de netteté. Agrandissez l’aperçu pour vérifier le texte ou reprenez la photo. Vous pouvez continuer si elle reste lisible."
            : "Peu de détails sont visibles. Vérifiez que la photo contient bien le devis et que le texte est lisible."}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="min-h-11"
          disabled={controlsDisabled || !preview}
          loading={applying}
          onClick={() => void apply()}
        >
          Lire cette photo
        </Button>
        <Button
          type="button"
          className="min-h-11"
          variant="secondary"
          disabled={disabled}
          onClick={onCancel}
        >
          Choisir une autre photo
        </Button>
      </div>
      <p className="text-xs leading-5 text-muted">
        La photo est préparée sur cet appareil. Aucune lecture ne commence avant votre
        validation.
      </p>
    </section>
  )
}
