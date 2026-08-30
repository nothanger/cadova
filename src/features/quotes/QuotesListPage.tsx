import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { LayoutGrid, List, Plus, Search } from "lucide-react"
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
  const [query, setQuery] = useState("")
  const [view, setView] = useState<"list" | "pipeline">("list")
  const [sort, setSort] = useState<"recent" | "amount" | "waiting">("recent")

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
    let result = filter === "all" ? quotes : filter === "followup" ? quotes.filter(isQuoteDueForFollowUp) : quotes.filter((q) => q.status === filter)
    const needle = query.trim().toLocaleLowerCase("fr")
    if (needle) result = result.filter((q) => q.reference.toLocaleLowerCase("fr").includes(needle) || q.client?.name.toLocaleLowerCase("fr").includes(needle))
    return [...result].sort((a, b) => sort === "amount" ? b.amount_cents - a.amount_cents : sort === "waiting" ? daysWaiting(b) - daysWaiting(a) : b.created_at.localeCompare(a.created_at))
  }, [quotes, filter, query, sort])

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
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 lg:max-w-sm"><Search size={16} className="absolute left-3 top-3 text-muted"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Client ou référence…" className="h-10 w-full rounded-[10px] border border-line-strong bg-surface pl-9 pr-3 text-sm outline-none focus:border-primary"/></div>
            <div className="flex flex-wrap gap-2"><select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-10 rounded-[10px] border border-line-strong bg-surface px-3 text-sm"><option value="recent">Plus récents</option><option value="amount">Montant décroissant</option><option value="waiting">Sans réponse depuis longtemps</option></select><button onClick={() => setView("list")} className={cx("flex h-10 items-center gap-2 rounded-[10px] border px-3 text-sm", view === "list" ? "border-primary bg-primary-soft text-primary" : "border-line-strong")}><List size={16}/> Liste</button><button onClick={() => setView("pipeline")} className={cx("flex h-10 items-center gap-2 rounded-[10px] border px-3 text-sm", view === "pipeline" ? "border-primary bg-primary-soft text-primary" : "border-line-strong")}><LayoutGrid size={16}/> Pipeline</button></div>
          </div>
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
          ) : view === "pipeline" ? (
            <Pipeline quotes={filtered} />
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

function Pipeline({ quotes }: { quotes: QuoteWithClient[] }) {
  const columns: { title: string; status: QuoteWithClient["status"]; followup?: boolean }[] = [
    { title: "Brouillon", status: "draft" }, { title: "Envoyé", status: "sent" },
    { title: "À relancer", status: "sent", followup: true }, { title: "Accepté", status: "accepted" },
    { title: "Refusé", status: "refused" },
  ]
  return <div className="grid gap-4 overflow-x-auto pb-2 md:grid-cols-2 xl:grid-cols-5">{columns.map((column) => { const items = quotes.filter((q) => q.status === column.status && (column.followup ? isQuoteDueForFollowUp(q) : q.status !== "sent" || !isQuoteDueForFollowUp(q))); return <section key={column.title} className="min-w-[220px] rounded-[var(--radius-cadova)] bg-background p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{column.title}</h3><span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">{items.length}</span></div><div className="space-y-2">{items.map((q) => <Link key={q.id} to={`/app/quotes/${q.id}`} className="block rounded-xl border border-line bg-surface p-3 transition hover:border-primary/40 hover:shadow-sm"><p className="font-mono text-xs font-semibold text-ink">{q.reference}</p><p className="mt-2 truncate text-sm text-ink-soft">{q.client?.name ?? "—"}</p><p className="mt-3 font-mono text-sm font-semibold text-ink">{formatCents(q.amount_cents)}</p>{column.followup && <p className="mt-2 text-xs font-medium text-warning">Sans réponse · {daysWaiting(q)} j</p>}</Link>)}{items.length === 0 && <p className="py-8 text-center text-xs text-muted">Aucun devis</p>}</div></section> })}</div>
}
