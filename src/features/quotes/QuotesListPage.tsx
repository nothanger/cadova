import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ArrowRight, Plus, Search } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  Spinner,
  StatusBadge,
  Input,
  Select,
  cx,
} from "@/components/ui"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import { useAdmin } from "@/features/admin/AdminContext"
import { getDashboardData, type DashboardData } from "@/features/dashboard/api"
import { getReminderPrefs } from "@/features/notifications/api"
import { quoteSituationLink, resolveQuoteSituation } from "./situation"
import { humanizeError } from "@/lib/errors"
import { formatCents } from "@/lib/money"
import type { QuoteWithClient } from "@/types"

type Filter = "all" | "attention" | "sent" | "accepted" | "refused" | "draft"
const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "attention", label: "À traiter" },
  { key: "sent", label: "En attente" },
  { key: "accepted", label: "Acceptés" },
  { key: "draft", label: "Brouillons" },
  { key: "refused", label: "Refusés" },
]

export function QuotesListPage() {
  const { user, loading: authLoading } = useAuth()
  const { company, loading: companyLoading } = useCompany()
  const { isAdmin, loading: adminLoading } = useAdmin()
  if (authLoading || companyLoading || adminLoading) return <Spinner />
  if (!user || !company)
    return (
      <ErrorState message="Sélectionnez une entreprise pour retrouver ses devis." />
    )
  return (
    <ScopedQuotesList
      key={`${user.id}:${company.id}`}
      userId={user.id}
      companyId={company.id}
      isAdmin={isAdmin}
    />
  )
}

function ScopedQuotesList({
  userId,
  companyId,
  isAdmin,
}: {
  userId: string
  companyId: string
  isAdmin: boolean
}) {
  const [params, setParams] = useSearchParams()
  const requestedFilter = params.get("filter")
  const filter: Filter = filters.some((item) => item.key === requestedFilter)
    ? (requestedFilter as Filter)
    : requestedFilter === "followup"
      ? "attention"
      : "all"
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const [query, setQuery] = useState("")
  const [view, setView] = useState<"list" | "stages">("list")
  const [sort, setSort] = useState<"recent" | "amount" | "waiting">("recent")

  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    setData(null)
    async function load() {
      try {
        const prefs = isAdmin
          ? { followupDelayDays: 3 }
          : await getReminderPrefs(userId, companyId).catch(() => null)
        const result = await getDashboardData(
          companyId,
          prefs?.followupDelayDays ?? 3,
          prefs === null,
        )
        if (active) setData(result)
      } catch (err) {
        if (active) setError(humanizeError(err, "Impossible de charger les devis."))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [companyId, userId, retry, isAdmin])

  const quotes = data?.context.quotes ?? []
  const situations = useMemo(() => {
    if (!data) return new Map<string, ReturnType<typeof resolveQuoteSituation>>()
    return new Map(
      data.context.quotes.map((quote) => [
        quote.id,
        resolveQuoteSituation(
          quote,
          { ...data.context, quotes: [quote] },
          data.followupDelayDays,
        ),
      ]),
    )
  }, [data])
  const attention = useMemo(
    () =>
      new Set(
        [...situations]
          .filter(([, situation]) => situation.attention)
          .map(([id]) => id),
      ),
    [situations],
  )
  const filtered = useMemo(() => {
    let result =
      filter === "all"
        ? quotes
        : filter === "attention"
          ? quotes.filter((quote) => attention.has(quote.id))
          : quotes.filter((quote) => quote.status === filter)
    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("fr")
    const needle = normalize(query.trim())
    if (needle)
      result = result.filter((quote) =>
        normalize(`${quote.reference} ${quote.client?.name ?? ""}`).includes(needle),
      )
    return [...result].sort((a, b) =>
      sort === "amount"
        ? b.amount_cents - a.amount_cents
        : sort === "waiting"
          ? (a.status === "sent" ? (a.sent_at ?? "9999") : "9999").localeCompare(
              b.status === "sent" ? (b.sent_at ?? "9999") : "9999",
            )
          : b.created_at.localeCompare(a.created_at),
    )
  }, [quotes, filter, query, sort, attention])
  const incomplete =
    data &&
    (Object.values(data.reads).includes("unavailable") ||
      data.context.preferencesUnavailable ||
      data.context.workOrdersRead === "unavailable" ||
      data.context.serviceReady === null)

  return (
    <>
      <PageHeader
        title="Devis"
        subtitle="Retrouvez vos dossiers et leur prochaine étape."
        actions={
          <LinkButton to="/app/quotes/new">
            <Plus size={16} aria-hidden="true" /> Ajouter un devis
          </LinkButton>
        }
      />
      {loading ? (
        <Spinner />
      ) : error || !data ? (
        <ErrorState
          message={error || "Les devis n’ont pas pu être chargés."}
          onRetry={() => setRetry((value) => value + 1)}
        />
      ) : quotes.length === 0 ? (
        <EmptyState
          title="Votre premier devis commence ici"
          description="Importez un PDF ou une photo, ou saisissez ses informations. Vous pourrez l’envoyer depuis Cadova ou indiquer qu’il est déjà envoyé."
          action={
            <LinkButton to="/app/quotes/new">
              <Plus size={16} aria-hidden="true" /> Ajouter mon premier devis
            </LinkButton>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-3.5 text-muted"
              />
              <Input
                aria-label="Rechercher un devis par client ou référence"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nom du client ou référence"
                className="pl-9"
              />
            </div>
            <details className="relative shrink-0">
              <summary className="min-h-11 cursor-pointer rounded-lg border border-line-strong bg-surface px-4 py-3 text-sm font-medium text-ink-soft">
                Affichage et tri
              </summary>
              <div className="mt-2 grid gap-3 rounded-xl border border-line bg-surface p-4 sm:absolute sm:right-0 sm:z-10 sm:w-72 sm:shadow-lg">
                <label className="text-xs font-medium text-muted">
                  Présentation
                  <Select
                    aria-label="Affichage des devis"
                    value={view}
                    className="mt-1"
                    onChange={(event) => setView(event.target.value as typeof view)}
                  >
                    <option value="list">Liste des dossiers</option>
                    <option value="stages">Par étape du devis</option>
                  </Select>
                </label>
                <label className="text-xs font-medium text-muted">
                  Ordre
                  <Select
                    aria-label="Trier les devis"
                    value={sort}
                    className="mt-1"
                    onChange={(event) => setSort(event.target.value as typeof sort)}
                  >
                    <option value="recent">Plus récents</option>
                    <option value="amount">Montant décroissant</option>
                    <option value="waiting">Attente la plus longue</option>
                  </Select>
                </label>
              </div>
            </details>
          </div>
          <div
            className="mb-4 flex flex-wrap gap-2"
            role="group"
            aria-label="Filtrer les devis"
          >
            {filters.map((item) => {
              const count =
                item.key === "all"
                  ? quotes.length
                  : item.key === "attention"
                    ? attention.size
                    : quotes.filter((quote) => quote.status === item.key).length
              return (
                <button
                  key={item.key}
                  aria-pressed={filter === item.key}
                  onClick={() => {
                    const next = new URLSearchParams(params)
                    if (item.key === "all") next.delete("filter")
                    else next.set("filter", item.key)
                    setParams(next, { replace: true })
                  }}
                  className={cx(
                    "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    filter === item.key
                      ? "border-primary bg-primary text-white"
                      : "border-line-strong bg-surface text-ink-soft hover:bg-background",
                  )}
                >
                  {item.label}
                  <span className="text-xs tabular-nums opacity-75">
                    {item.key === "attention" && incomplete ? "…" : count}
                  </span>
                </button>
              )
            })}
          </div>
          {incomplete && (
            <Card className="mb-4 p-4">
              <p role="status" className="text-sm leading-6 text-muted">
                Certaines informations de suivi n’ont pas pu être vérifiées. Les
                dossiers à traiter et les prochaines étapes peuvent être incomplets.
                {data.context.preferencesUnavailable &&
                  " Votre délai de rappel personnel est indisponible."}
              </p>
              <Button
                variant="ghost"
                onClick={() => setRetry((value) => value + 1)}
                className="mt-1"
              >
                Réessayer les vérifications
              </Button>
            </Card>
          )}
          {filtered.length === 0 ? (
            <EmptyState
              title={
                query.trim()
                  ? "Aucun devis ne correspond à votre recherche"
                  : filter === "attention" && incomplete
                    ? "Aucun dossier à traiter dans les données vérifiées"
                    : "Aucun devis dans cette vue"
              }
              description={
                filter === "attention" && !incomplete
                  ? "Les autres dossiers attendent une réponse, une date prévue ou sont déjà décidés."
                  : "Changez de vue ou de recherche pour retrouver vos dossiers."
              }
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("")
                    const next = new URLSearchParams(params)
                    next.delete("filter")
                    setParams(next, { replace: true })
                  }}
                >
                  Voir tous les devis
                </Button>
              }
            />
          ) : view === "stages" ? (
            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {(["draft", "sent", "accepted", "refused"] as const).map((status) => {
                const items = filtered.filter((quote) => quote.status === status)
                return (
                  <section
                    key={status}
                    className="min-w-0 rounded-xl border border-line bg-background p-3"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-ink">
                        {
                          {
                            draft: "Brouillons",
                            sent: "En attente",
                            accepted: "Acceptés",
                            refused: "Refusés",
                          }[status]
                        }
                      </h2>
                      <span className="text-xs tabular-nums text-muted">
                        {items.length}
                      </span>
                    </div>
                    <ul className="space-y-3">
                      {items.map((quote) => (
                        <li key={quote.id}>
                          <QuoteCard
                            quote={quote}
                            situation={situations.get(quote.id)!}
                          />
                        </li>
                      ))}
                    </ul>
                    {!items.length && (
                      <p className="py-5 text-sm text-muted">
                        Aucun devis à cette étape.
                      </p>
                    )}
                  </section>
                )
              })}
            </div>
          ) : (
            <>
              <ul className="space-y-3 md:hidden">
                {filtered.map((quote) => (
                  <li key={quote.id}>
                    <QuoteCard quote={quote} situation={situations.get(quote.id)!} />
                  </li>
                ))}
              </ul>
              <Card className="hidden overflow-hidden md:block">
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th scope="col" className="w-[30%] px-5 py-3 font-medium">
                        Client et devis
                      </th>
                      <th
                        scope="col"
                        className="w-[18%] px-3 py-3 text-right font-medium"
                      >
                        Montant TTC
                      </th>
                      <th scope="col" className="px-5 py-3 font-medium">
                        Prochaine étape
                      </th>
                      <th scope="col" className="w-10">
                        <span className="sr-only">Ouvrir le dossier</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((quote) => {
                      const situation = situations.get(quote.id)!
                      return (
                        <tr
                          key={quote.id}
                          className="border-b border-line align-top last:border-0 hover:bg-background"
                        >
                          <td className="px-5 py-4">
                            <Link
                              to={`/app/quotes/${quote.id}`}
                              className="block break-words font-semibold text-ink hover:text-primary"
                            >
                              {quote.client?.name ?? "Client à vérifier"}
                            </Link>
                            <Link
                              to={`/app/quotes/${quote.id}`}
                              className="mt-1 block break-words font-mono text-xs text-muted hover:text-primary"
                            >
                              {quote.reference}
                            </Link>
                            <div className="mt-2">
                              <StatusBadge status={quote.status} />
                            </div>
                          </td>
                          <td className="break-words px-3 py-4 text-right font-semibold tabular-nums text-ink">
                            {formatCents(quote.amount_cents)}
                          </td>
                          <td className="px-5 py-4">
                            <SituationText situation={situation} />
                            <Link
                              to={quoteSituationLink(quote.id, situation)}
                              className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
                            >
                              {situation.label}
                              <ArrowRight size={14} aria-hidden="true" />
                            </Link>
                          </td>
                          <td className="pr-3 pt-4">
                            <Link
                              to={`/app/quotes/${quote.id}`}
                              aria-label={`Ouvrir le devis ${quote.reference}`}
                              className="flex min-h-11 min-w-8 items-center justify-center text-muted hover:text-primary"
                            >
                              <ArrowRight size={16} aria-hidden="true" />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </>
      )}
    </>
  )
}

function SituationText({
  situation,
}: {
  situation: ReturnType<typeof resolveQuoteSituation>
}) {
  const tones = {
    neutral: "text-ink-soft",
    primary: "text-primary",
    warning: "text-warning",
    danger: "text-danger",
    success: "text-success",
  }
  return (
    <div>
      <p className={cx("break-words text-sm font-medium", tones[situation.tone])}>
        {situation.title}
      </p>
      <p className="mt-1 break-words text-xs leading-5 text-muted">
        {situation.detail}
      </p>
    </div>
  )
}

function QuoteCard({
  quote,
  situation,
}: {
  quote: QuoteWithClient
  situation: ReturnType<typeof resolveQuoteSituation>
}) {
  return (
    <Card className="min-w-0 p-4">
      <Link
        to={`/app/quotes/${quote.id}`}
        className="flex min-h-11 min-w-0 flex-wrap items-start justify-between gap-3"
      >
        <div className="min-w-0 flex-1">
          <p className="break-words text-base font-semibold text-ink">
            {quote.client?.name ?? "Client à vérifier"}
          </p>
          <p className="mt-1 break-words font-mono text-xs text-muted">
            {quote.reference}
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-ink">
          {formatCents(quote.amount_cents)}
        </p>
      </Link>
      <div className="mb-3 mt-1">
        <StatusBadge status={quote.status} />
      </div>
      <div className="border-t border-line pt-3">
        <SituationText situation={situation} />
        <Link
          to={quoteSituationLink(quote.id, situation)}
          className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          {situation.label}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </Card>
  )
}
