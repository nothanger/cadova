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
  Input,
  Select,
  TableScroll,
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
  }, [company?.id])

  const filtered = useMemo(() => {
    let result =
      filter === "all"
        ? quotes
        : filter === "followup"
          ? quotes.filter(isQuoteDueForFollowUp)
          : quotes.filter((q) => q.status === filter)
    const needle = query.trim().toLocaleLowerCase("fr")
    if (needle)
      result = result.filter(
        (q) =>
          q.reference.toLocaleLowerCase("fr").includes(needle) ||
          q.client?.name.toLocaleLowerCase("fr").includes(needle),
      )
    return [...result].sort((a, b) =>
      sort === "amount"
        ? b.amount_cents - a.amount_cents
        : sort === "waiting"
          ? (daysWaiting(b) ?? -1) - (daysWaiting(a) ?? -1)
          : b.created_at.localeCompare(a.created_at),
    )
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
          description="Ajoutez un devis pour suivre son statut et préparer vos relances."
          action={
            <LinkButton to="/app/quotes/new">
              <Plus size={16} /> Créer mon premier devis
            </LinkButton>
          }
        />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative flex-1 xl:max-w-xs">
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-3.5 text-muted"
              />
              <Input
                aria-label="Rechercher un devis par client ou référence"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Client ou référence"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                aria-label="Trier les devis"
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
              >
                <option value="recent">Plus récents</option>
                <option value="amount">Montant décroissant</option>
                <option value="waiting">Attente la plus longue</option>
              </Select>
              <div
                className="flex gap-1 rounded-lg border border-line bg-surface p-1"
                role="group"
                aria-label="Affichage des devis"
              >
                <button
                  aria-pressed={view === "list"}
                  onClick={() => setView("list")}
                  className={cx(
                    "flex min-h-9 items-center gap-2 rounded-md px-3 text-sm",
                    view === "list"
                      ? "bg-primary-soft font-semibold text-primary"
                      : "text-muted hover:bg-background",
                  )}
                >
                  <List size={16} aria-hidden="true" />
                  Liste
                </button>
                <button
                  aria-pressed={view === "pipeline"}
                  onClick={() => setView("pipeline")}
                  className={cx(
                    "flex min-h-9 items-center gap-2 rounded-md px-3 text-sm",
                    view === "pipeline"
                      ? "bg-primary-soft font-semibold text-primary"
                      : "text-muted hover:bg-background",
                  )}
                >
                  <LayoutGrid size={16} aria-hidden="true" />
                  Pipeline
                </button>
              </div>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cx(
                  "min-h-11 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
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
              <TableScroll>
                <table className="min-w-[640px] w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                      <th scope="col" className="px-5 py-3 font-medium">
                        Référence
                      </th>
                      <th scope="col" className="px-5 py-3 font-medium">
                        Client
                      </th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">
                        Montant
                      </th>
                      <th scope="col" className="px-5 py-3 font-medium">
                        Envoyé le
                      </th>
                      <th scope="col" className="px-5 py-3 font-medium">
                        Statut
                      </th>
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
                        <td className="px-5 py-3 text-ink">{q.client?.name ?? "—"}</td>
                        <td className="px-5 py-3 text-right font-semibold tabular-nums text-ink">
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
              </TableScroll>
            </Card>
          )}
        </>
      )}
    </>
  )
}

function Pipeline({ quotes }: { quotes: QuoteWithClient[] }) {
  const columns: {
    title: string
    status: QuoteWithClient["status"]
    followup?: boolean
  }[] = [
    { title: "Brouillon", status: "draft" },
    { title: "Envoyé", status: "sent" },
    { title: "À relancer", status: "sent", followup: true },
    { title: "Accepté", status: "accepted" },
    { title: "Refusé", status: "refused" },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {columns.map((column) => {
        const items = quotes.filter(
          (q) =>
            q.status === column.status &&
            (column.followup
              ? isQuoteDueForFollowUp(q)
              : q.status !== "sent" || !isQuoteDueForFollowUp(q)),
        )
        return (
          <section
            key={column.title}
            className="min-w-0 rounded-xl border border-line bg-[#eeefe9] p-4"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink-soft">{column.title}</h3>
              <span className="rounded-md border border-line bg-surface px-2 py-1 text-xs tabular-nums text-muted">
                {items.length}
              </span>
            </div>
            <div className="space-y-3">
              {items.map((q) => (
                <Link
                  key={q.id}
                  to={`/app/quotes/${q.id}`}
                  className="block rounded-lg border border-line bg-surface p-4 transition-colors hover:border-primary"
                >
                  <p className="break-words font-mono text-xs font-semibold text-ink">
                    {q.reference}
                  </p>
                  <p className="mt-2 truncate text-sm text-ink-soft">
                    {q.client?.name ?? "—"}
                  </p>
                  <p className="mt-4 text-base font-semibold tabular-nums text-ink">
                    {formatCents(q.amount_cents)}
                  </p>
                  {column.followup && (
                    <p className="mt-2 text-xs text-warning">
                      Sans réponse depuis {daysWaiting(q)} j
                    </p>
                  )}
                </Link>
              ))}
              {items.length === 0 && (
                <p className="py-6 text-center text-xs text-muted">Aucun devis</p>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
