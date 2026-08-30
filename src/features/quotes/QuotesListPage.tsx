import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Plus } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  Card,
  EmptyState,
  ErrorState,
  FollowUpBadge,
  LinkButton,
  Spinner,
  StatusBadge,
  cx,
} from "@/components/ui"
import { useCompany } from "@/features/company/CompanyContext"
import { listQuotes } from "./api"
import { humanizeError } from "@/lib/errors"
import { formatCents } from "@/lib/money"
import { formatDate } from "@/lib/dates"
import { daysWaiting, isQuoteDueForFollowUp } from "@/lib/followup"
import type { QuoteWithClient } from "@/types"

type Filter = "all" | "followup" | "sent" | "accepted" | "refused" | "draft"
const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "followup", label: "À relancer" },
  { key: "sent", label: "Envoyés" },
  { key: "accepted", label: "Acceptés" },
  { key: "refused", label: "Refusés" },
  { key: "draft", label: "Brouillons" },
]

export function QuotesListPage() {
  const { company } = useCompany()
  const [quotes, setQuotes] = useState<QuoteWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<Filter>("all")

  async function load() {
    if (!company) return
    setLoading(true)
    setError("")
    try {
      setQuotes(await listQuotes(company.id))
    } catch (err) {
      setError(humanizeError(err, "Impossible de charger les devis."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id])

  const filtered = useMemo(() => {
    if (filter === "all") return quotes
    if (filter === "followup") return quotes.filter(isQuoteDueForFollowUp)
    return quotes.filter((q) => q.status === filter)
  }, [quotes, filter])

  return (
    <>
      <PageHeader
        title="Devis"
        subtitle="Suivez l’état de vos devis et repérez ceux à relancer."
        actions={
          <LinkButton to="/app/quotes/new">
            <Plus size={16} /> Nouveau devis
          </LinkButton>
        }
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : quotes.length === 0 ? (
        <EmptyState
          title="Aucun devis pour le moment"
          description="Créez un devis et Cadova vous dira quand le relancer."
          action={
            <LinkButton to="/app/quotes/new">
              <Plus size={16} /> Créer mon premier devis
            </LinkButton>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cx(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === f.key
                    ? "border-primary bg-primary text-white"
                    : "border-line-strong bg-surface text-ink-soft hover:bg-background",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="Aucun devis dans cette catégorie" />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                      <th className="px-5 py-3 font-medium">Référence</th>
                      <th className="px-5 py-3 font-medium">Client</th>
                      <th className="px-5 py-3 font-medium">Montant</th>
                      <th className="px-5 py-3 font-medium">Envoyé le</th>
                      <th className="px-5 py-3 font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((q) => (
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
                        <td className="px-5 py-3 text-ink">
                          {q.client?.name ?? "—"}
                        </td>
                        <td className="px-5 py-3 font-mono text-ink">
                          {formatCents(q.amount_cents)}
                        </td>
                        <td className="px-5 py-3 text-muted">
                          {formatDate(q.sent_at)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={q.status} />
                            {isQuoteDueForFollowUp(q) && (
                              <FollowUpBadge days={daysWaiting(q)} />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </>
  )
}
