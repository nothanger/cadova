import { useEffect, useRef, useState } from "react"
import { Camera, FileText, Upload, X } from "lucide-react"
import { Button, Card } from "@/components/ui"
import type { prepareQuoteDocument } from "./import/documentReader"

export type PreparedQuoteDocument = Awaited<ReturnType<typeof prepareQuoteDocument>>

export function QuoteImportPanel({
  disabled,
  onPrepared,
  onBusyChange,
}: {
  disabled: boolean
  onPrepared: (document: PreparedQuoteDocument | null) => void
  onBusyChange: (busy: boolean) => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const currentRead = useRef<AbortController | null>(null)
  const [document, setDocument] = useState<PreparedQuoteDocument | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({
    progress: 0,
    label: "Préparation du document…",
  })
  const [error, setError] = useState("")

  useEffect(() => () => currentRead.current?.abort(), [])

  useEffect(() => {
    if (!document) {
      setPreviewUrl("")
      return
    }
    const url = URL.createObjectURL(document.preview)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [document])

  function cancelRead() {
    currentRead.current?.abort()
    currentRead.current = null
    setBusy(false)
    onBusyChange(false)
  }

  async function readFile(file: File | undefined) {
    if (!file || disabled) return
    cancelRead()
    const controller = new AbortController()
    currentRead.current = controller
    setDocument(null)
    onPrepared(null)
    setError("")
    setBusy(true)
    onBusyChange(true)
    setProgress({ progress: 0, label: "Préparation du document…" })
    try {
      const { prepareQuoteDocument } = await import("./import/documentReader")
      if (controller.signal.aborted) return
      const result = await prepareQuoteDocument(file, {
        signal: controller.signal,
        onProgress: (next) => {
          if (!controller.signal.aborted) setProgress(next)
        },
      })
      if (controller.signal.aborted || currentRead.current !== controller) return
      setDocument(result)
      onPrepared(result)
    } catch (err) {
      if (controller.signal.aborted || currentRead.current !== controller) return
      setError(
        err instanceof Error
          ? err.message
          : "Ce document n’a pas pu être lu. Essayez une autre photo ou complétez les champs manuellement.",
      )
    } finally {
      if (currentRead.current === controller && !controller.signal.aborted) {
        currentRead.current = null
        setBusy(false)
        onBusyChange(false)
      }
    }
  }

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-primary-soft p-2 text-primary">
          <FileText size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">Importer votre devis</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Ajoutez votre document pour préremplir les champs. Vous pourrez les vérifier
            avant l’enregistrement.
          </p>
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label="Choisir le document du devis"
        disabled={disabled || busy}
        onChange={(event) => {
          void readFile(event.target.files?.[0])
          event.target.value = ""
        }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        aria-label="Photographier le devis"
        disabled={disabled || busy}
        onChange={(event) => {
          void readFile(event.target.files?.[0])
          event.target.value = ""
        }}
      />

      {!document && !busy && (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={16} aria-hidden="true" />
            Importer un PDF ou une image
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={() => cameraInput.current?.click()}
          >
            <Camera size={16} aria-hidden="true" />
            Prendre une photo
          </Button>
        </div>
      )}

      {busy && (
        <div className="mt-5 space-y-3">
          <p role="status" className="text-sm text-ink-soft">
            {progress.label}
          </p>
          <progress
            className="h-2 w-full accent-primary"
            value={progress.progress}
            max={1}
            aria-label="Lecture du document"
          />
          <Button type="button" variant="ghost" onClick={cancelRead}>
            <X size={16} aria-hidden="true" /> Annuler la lecture
          </Button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {document && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <div className="min-w-0 flex-1">
              <p className="break-all text-sm font-medium text-ink">
                {document.pdf.name}
              </p>
              <p className="mt-1 text-xs text-muted">
                Vérifiez les champs proposés. Vos saisies sont conservées.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              aria-label="Retirer le document"
              onClick={() => {
                setDocument(null)
                onPrepared(null)
              }}
            >
              <X size={16} aria-hidden="true" /> Retirer
            </Button>
          </div>
          {document.warnings.length > 0 && (
            <ul
              className="space-y-1 rounded-lg bg-warning-soft p-3 text-sm text-warning"
              aria-label="Informations à vérifier"
            >
              {document.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          )}
          {previewUrl && (
            <details className="rounded-lg border border-line">
              <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium text-ink">
                Voir le document
              </summary>
              <div className="max-h-[32rem] overflow-y-auto border-t border-line bg-background p-3">
                <img
                  src={previewUrl}
                  alt="Aperçu de la première page du devis importé"
                  className="mx-auto h-auto max-w-full rounded border border-line"
                />
              </div>
            </details>
          )}
        </div>
      )}
      {!document && !busy && (
        <p className="mt-3 text-xs leading-5 text-muted">
          PDF, JPEG, PNG ou WebP · 10 Mo et 10 pages maximum. Vous pouvez aussi remplir
          le formulaire directement.
        </p>
      )}
    </Card>
  )
}
