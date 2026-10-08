import { Check, FileSearch } from "lucide-react"
import type { QuoteFieldReview } from "./types"

export function ImportFieldReview({
  field,
  label,
  review,
  confirmed,
  value,
  onConfirm,
  onCompare,
}: {
  field: string
  label: string
  review?: QuoteFieldReview
  confirmed: boolean
  value: string
  onConfirm: () => void
  onCompare: () => void
}) {
  if (!review) return null
  const optionalMissing =
    review.state === "missing" && ["clientPhone", "expiresAt"].includes(field)
  if (optionalMissing && !value) return null
  const needsReview = !confirmed && review.state !== "identified" && !optionalMissing
  return (
    <div
      className={`mt-2 text-sm ${needsReview ? "rounded-lg border border-warning/25 bg-warning-soft p-3" : "text-muted"}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p
          className={`mr-auto ${needsReview ? "font-medium text-warning" : "text-xs text-muted"}`}
        >
          {confirmed ? (
            <span className="inline-flex items-center gap-1">
              <Check size={14} aria-hidden="true" /> Vérifié
            </span>
          ) : needsReview ? (
            "À vérifier"
          ) : optionalMissing ? (
            "Non indiqué"
          ) : (
            "Lu dans le devis"
          )}
        </p>
        {review.sources.length > 0 && (
          <button
            type="button"
            onClick={onCompare}
            className="inline-flex min-h-11 items-center gap-1 rounded px-1 text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label={`Comparer ${label.toLowerCase()} au document`}
          >
            <FileSearch size={14} aria-hidden="true" /> Comparer
          </button>
        )}
        {value && !confirmed && (
          <button
            type="button"
            onClick={onConfirm}
            aria-label={`Confirmer ${label.toLowerCase()}`}
            className="min-h-11 rounded px-1 text-xs font-medium text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Vérifier
          </button>
        )}
      </div>
      {needsReview && <p className="mt-1 leading-5 text-muted">{review.reason}</p>}
    </div>
  )
}
