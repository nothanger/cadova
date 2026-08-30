import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Pencil, AlertTriangle } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  Button,
  Card,
  ErrorState,
  LinkButton,
  Spinner,
  StatusBadge,
} from "@/components/ui"
import { getQuote, setQuoteStatus } from "./api"
import { humanizeError } from "@/lib/errors"
import { formatCents } from "@/lib/money"
import { formatDate } from "@/lib/dates"
import { daysWaiting, isQuoteDueForFollowUp } from "@/lib/followup"
import type { QuoteStatus, QuoteWithClient } from "@/types"

export function QuoteDetailPage() {
  const { quoteId } = useParams()
  const [quote, setQuote] = useState<QuoteWithClient | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updating, setUpdating] = useState<QuoteStatus | null>(null)

  async function load() {
    if (!quoteId) return
    setLoading(true)
    setError("")
    try {
      setQuote(await getQuote(quoteId))
    } catch (err) {
      setError(humanizeError(err, "Devis introuvable."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId])

  async function changeStatus(status: QuoteStatus) {
    if (!quoteId || updating) return
    setUpdating(status)
    try {
      await setQuoteStatus(quoteId, status)
      setQuote((q) => (q ? { ...q, status } : q))
    } catch (err) {
      setError(humanizeError(err, "Mise à jour impossible."))
    } finally {
      setUpdating(null)
    }
  }

  if (loading) return <Spinner />
  if (error && !quote) return <ErrorState message={error} onRetry={load} />
  if (!quote) return null

  const due = isQuoteDueForFollowUp(quote)
  const waiting = daysWaiting(quote)

  return (
    <>
      <PageHeader
        title={quote.reference}
        subtitle={quote.client ? `Client : ${quote.client.name}` : undefined}
        back={{ to: "/app/quotes", label: "Retour aux devis" }}
        actions={
          <LinkButton variant="secondary" to={`/app/quotes/${quote.id}/edit`}>
            <Pencil size={16} /> Modifier
          </LinkButton>
        }
      />

      {due && (
        <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-cadova)] border border-warning/30 bg-warning-soft p-4">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p className="font-semibold text-warning">À relancer</p>
            <p className="text-sm text-warning/90">
              Ce devis a été envoyé il y a {waiting} jours et n’a pas encore de
              réponse.
            </p>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-[10px] bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6 md:col-span-2">
          <dl className="grid gap-5 sm:grid-cols-2">
            <Detail
              label="Montant"
              value={formatCents(quote.amount_cents)}
              mono
            />
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">
                Statut
              </dt>
              <dd className="mt-1">
                <StatusBadge status={quote.status} />
              </dd>
            </div>
            <Detail label="Date d’envoi" value={formatDate(quote.sent_at)} />
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">
                Client
              </dt>
              <dd className="mt-1">
                {quote.client ? (
                  <Link
                    to={`/app/clients/${quote.client.id}`}
                    className="text-primary hover:underline"
                  >
                    {quote.client.name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wider text-muted">
                Notes
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-ink-soft">
                {quote.notes || "—"}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-semibold text-ink">Actions</h2>
          <div className="mt-4 flex flex-col gap-3">
            <Button
              variant="secondary"
              loading={updating === "accepted"}
              disabled={quote.status === "accepted"}
              onClick={() => changeStatus("accepted")}
            >
              Marquer accepté
            </Button>
            <Button
              variant="secondary"
              loading={updating === "refused"}
              disabled={quote.status === "refused"}
              onClick={() => changeStatus("refused")}
            >
              Marquer refusé
            </Button>
          </div>
        </Card>
      </div>
    </>
  )
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className={`mt-1 text-ink ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  )
}
