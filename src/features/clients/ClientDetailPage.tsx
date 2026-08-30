import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Pencil, Plus } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  Card,
  EmptyState,
  ErrorState,
  FollowUpBadge,
  LinkButton,
  Spinner,
  StatusBadge,
} from "@/components/ui"
import { getClient } from "./api"
import { listQuotesForClient } from "@/features/quotes/api"
import { humanizeError } from "@/lib/errors"
import { formatCents } from "@/lib/money"
import { formatDate } from "@/lib/dates"
import { daysWaiting, isQuoteDueForFollowUp } from "@/lib/followup"
import type { Client, Quote } from "@/types"

export function ClientDetailPage() {
  const { clientId } = useParams()
  const [client, setClient] = useState<Client | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function load() {
    if (!clientId) return
    setLoading(true)
    setError("")
    try {
      const [c, q] = await Promise.all([
        getClient(clientId),
        listQuotesForClient(clientId),
      ])
      setClient(c)
      setQuotes(q)
    } catch (err) {
      setError(humanizeError(err, "Fiche client introuvable."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  if (loading) return <Spinner />
  if (error || !client)
    return (
      <ErrorState message={error || "Client introuvable."} onRetry={load} />
    )

  return (
    <>
      <PageHeader
        title={client.name}
        back={{ to: "/app/clients", label: "Retour aux clients" }}
        actions={
          <>
            <LinkButton
              variant="secondary"
              to={`/app/clients/${client.id}/edit`}
            >
              <Pencil size={16} /> Modifier
            </LinkButton>
            <LinkButton to={`/app/quotes/new?client=${client.id}`}>
              <Plus size={16} /> Créer un devis
            </LinkButton>
          </>
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6 md:col-span-1">
          <dl className="flex flex-col gap-4 text-sm">
            <Detail label="Email" value={client.email} />
            <Detail label="Téléphone" value={client.phone} />
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted">
                Notes
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-ink-soft">
                {client.notes || "—"}
              </dd>
            </div>
          </dl>
        </Card>

        <div className="md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Devis associés
          </h2>
          {quotes.length === 0 ? (
            <EmptyState
              title="Aucun devis pour ce client"
              action={
                <LinkButton to={`/app/quotes/new?client=${client.id}`}>
                  <Plus size={16} /> Créer un devis
                </LinkButton>
              }
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {quotes.map((q) => (
                      <tr
                        key={q.id}
                        className="border-b border-line last:border-0 hover:bg-background"
                      >
                        <td className="px-5 py-3">
                          <Link
                            to={`/app/quotes/${q.id}`}
                            className="font-mono text-xs font-medium text-ink hover:text-primary"
                          >
                            {q.reference}
                          </Link>
                        </td>
                        <td className="px-5 py-3 font-mono text-ink">
                          {formatCents(q.amount_cents)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={q.status} />
                            {isQuoteDueForFollowUp(q) && (
                              <FollowUpBadge days={daysWaiting(q)} />
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-muted">
                          {formatDate(q.sent_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 text-ink">{value || "—"}</dd>
    </div>
  )
}
