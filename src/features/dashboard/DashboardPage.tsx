import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  Plus,
  ChevronDown,
} from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  Button,
  Card,
  ErrorState,
  LinkButton,
  Spinner,
  StatusBadge,
} from "@/components/ui"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import { useAdmin } from "@/features/admin/AdminContext"
import { getDashboardData, type DashboardData } from "./api"
import { getReminderPrefs } from "@/features/notifications/api"
import { humanizeError } from "@/lib/errors"
import { formatCents } from "@/lib/money"
import { GettingStarted } from "@/features/company/GettingStarted"
import { WorkspacePanel } from "./WorkspacePanel"

export function DashboardPage() {
  const { user } = useAuth()
  const { company, role } = useCompany()
  const { isAdmin } = useAdmin()
  const scope = company && user ? `${user.id}:${company.id}` : ""
  const scopeRef = useRef(scope)
  scopeRef.current = scope
  const requestId = useRef(0)
  const [result, setResult] = useState<{
    scope: string
    data: DashboardData | null
    loading: boolean
    error: string
  }>({ scope: "", data: null, loading: true, error: "" })

  const load = useCallback(async () => {
    if (!company || !user) return
    const request = ++requestId.current
    setResult({ scope, data: null, loading: true, error: "" })
    try {
      const prefs = isAdmin
        ? { followupDelayDays: 3 }
        : await getReminderPrefs(user.id, company.id).catch(() => null)
      const data = await getDashboardData(
        company.id,
        prefs?.followupDelayDays ?? 3,
        prefs === null,
      )
      if (request === requestId.current && scopeRef.current === scope)
        setResult({ scope, data, loading: false, error: "" })
    } catch (err) {
      if (request === requestId.current && scopeRef.current === scope)
        setResult({
          scope,
          data: null,
          loading: false,
          error: humanizeError(err, "Impossible de charger vos dossiers."),
        })
    }
  }, [company?.id, user?.id, scope, isAdmin])

  useEffect(() => {
    load()
    return () => {
      requestId.current++
    }
  }, [load])
  if (result.loading || result.scope !== scope) return <Spinner />
  const { data, error } = result
  if (error || !data) return <ErrorState message={error} onRetry={load} />

  return (
    <>
      <PageHeader
        title="Aujourd’hui"
        subtitle={
          company
            ? `Vos prochaines actions chez ${company.name}.`
            : "Retrouvez la prochaine étape de vos devis."
        }
        actions={
          <LinkButton
            to="/app/quotes/new"
            variant={data.latest.length ? "secondary" : "primary"}
          >
            <Plus size={16} aria-hidden="true" /> Ajouter un devis
          </LinkButton>
        }
      />
      {data.context.preferencesUnavailable && (
        <Card className="mb-4 p-4">
          <p role="status" className="text-sm leading-6 text-muted">
            Votre délai de rappel personnel n’a pas pu être chargé. Les relances
            manuelles à préparer ne peuvent pas être confirmées.
          </p>
          <Button variant="ghost" onClick={load} className="mt-1">
            Réessayer
          </Button>
        </Card>
      )}
      {data.latest.length > 0 && (
        <WorkspacePanel key={`actions:${scope}`} data={data} onRetry={load} />
      )}
      {user && company && (
        <GettingStarted
          key={scope}
          userId={user.id}
          companyId={company.id}
          canEditCompany={role === "owner"}
          data={data}
        />
      )}
      {data.latest.length > 0 && (
        <>
          <section className="mb-6" aria-labelledby="recent-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="recent-heading" className="text-base font-semibold text-ink">
                Retrouver un dossier récent
              </h2>
              <Link
                to="/app/quotes"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                Tous les devis <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line">
                {data.latest.map((quote) => (
                  <li key={quote.id}>
                    <Link
                      to={`/app/quotes/${quote.id}`}
                      className="flex min-w-0 flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-background sm:p-5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold text-ink">
                          {quote.client?.name ?? "Client à vérifier"}
                        </p>
                        <p className="mt-1 break-words font-mono text-xs text-muted">
                          {quote.reference}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <StatusBadge status={quote.status} />
                        <p className="text-sm font-semibold tabular-nums text-ink">
                          {formatCents(quote.amount_cents)}
                        </p>
                        <ArrowRight
                          size={16}
                          aria-hidden="true"
                          className="text-muted"
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
          <details className="group rounded-xl border border-line bg-surface">
            <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
              <div>
                <span className="text-sm font-semibold text-ink">
                  Le bilan de vos devis
                </span>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {formatCents(data.pending.amountCents)} en attente ·{" "}
                  {data.accepted.count} devis accepté
                  {data.accepted.count > 1 ? "s" : ""}
                </p>
              </div>
              <ChevronDown
                size={18}
                aria-hidden="true"
                className="shrink-0 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
              />
            </summary>
            <div className="border-t border-line p-4 sm:p-5">
              <div className="grid min-w-0 gap-3 sm:grid-cols-3">
                <Stat
                  tone="warning"
                  icon={<AlertTriangle size={18} aria-hidden="true" />}
                  label="Relances manuelles à préparer"
                  count={data.followUp.complete ? data.followUp.count : null}
                  amount={
                    data.followUp.complete
                      ? formatCents(data.followUp.amountCents)
                      : "Vérifications indisponibles"
                  }
                />
                <Stat
                  tone="primary"
                  icon={<Clock size={18} aria-hidden="true" />}
                  label="Devis en attente de réponse"
                  count={data.pending.count}
                  amount={formatCents(data.pending.amountCents)}
                />
                <Stat
                  tone="success"
                  icon={<CheckCircle2 size={18} aria-hidden="true" />}
                  label="Devis acceptés"
                  count={data.accepted.count}
                  amount={formatCents(data.accepted.amountCents)}
                />
              </div>
              <div className="mt-3 grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
                <MiniStat
                  label="Taux d’acceptation"
                  value={`${data.acceptanceRate} %`}
                />
                <MiniStat
                  label="Accepté ce mois-ci"
                  value={formatCents(data.wonThisMonthCents)}
                />
                <MiniStat
                  label="Délai moyen d’acceptation"
                  value={
                    data.averageAcceptanceDays === null
                      ? "—"
                      : `${data.averageAcceptanceDays} jours`
                  }
                />
                <MiniStat
                  label="Sans modification depuis 14 j"
                  value={String(data.staleCount)}
                  warning={data.staleCount > 0}
                />
              </div>
              <p className="mt-4 text-xs leading-5 text-muted">
                Les montants correspondent à vos devis, pas aux encaissements. Les
                indicateurs de date utilisent la dernière modification du devis.
              </p>
            </div>
          </details>
        </>
      )}
    </>
  )
}

function MiniStat({
  label,
  value,
  warning = false,
}: {
  label: string
  value: string
  warning?: boolean
}) {
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="text-xs font-medium leading-5 text-muted">{label}</p>
      <p
        className={`mt-2 break-words text-lg font-semibold tabular-nums ${warning ? "text-warning" : "text-ink"}`}
      >
        {value}
      </p>
    </div>
  )
}

function Stat({
  tone,
  icon,
  label,
  count,
  amount,
}: {
  tone: "warning" | "primary" | "success"
  icon: ReactNode
  label: string
  count: number | null
  amount: string
}) {
  const toneClass = {
    warning: "bg-warning-soft text-warning",
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
  }[tone]
  return (
    <div className="rounded-lg border border-line p-4">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneClass}`}
        >
          {icon}
        </span>
        <span className="text-xs font-medium leading-5 text-ink-soft">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-ink">
        {count ?? "—"}
      </p>
      <p className="mt-1 text-sm tabular-nums text-muted">{amount}</p>
    </div>
  )
}
