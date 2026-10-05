import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, Clock, CheckCircle2, ArrowRight } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  Card,
  EmptyState,
  ErrorState,
  FollowUpBadge,
  LinkButton,
  Spinner,
  StatusBadge,
  TableScroll,
} from "@/components/ui"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import { getDashboardData, type DashboardData } from "./api"
import { getReminderPrefs } from "@/features/notifications/api"
import { humanizeError } from "@/lib/errors"
import { formatCents } from "@/lib/money"
import { formatDate } from "@/lib/dates"
import { daysWaiting } from "@/lib/followup"
import { GettingStarted } from "@/features/company/GettingStarted"
import { WorkspacePanel } from "./WorkspacePanel"

export function DashboardPage() {
  const { user } = useAuth()
  const { company, role } = useCompany()
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
      const prefs = await getReminderPrefs(user.id, company.id).catch(() => ({
        followupDelayDays: 3,
        reminderHour: 8,
      }))
      const data = await getDashboardData(company.id, prefs.followupDelayDays)
      if (request === requestId.current && scopeRef.current === scope)
        setResult({ scope, data, loading: false, error: "" })
    } catch (err) {
      if (request === requestId.current && scopeRef.current === scope)
        setResult({
          scope,
          data: null,
          loading: false,
          error: humanizeError(err, "Impossible de charger le tableau de bord."),
        })
    }
  }, [company?.id, user?.id, scope])

  useEffect(() => {
    load()
    return () => {
      requestId.current++
    }
  }, [load])

  if (result.loading || result.scope !== scope) return <Spinner />
  const { data, error } = result
  if (error || !data) return <ErrorState message={error} onRetry={load} />

  const noQuotes = data.latest.length === 0

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle={company ? `Le suivi des devis de ${company.name}.` : ""}
      />

      {user && company && (
        <GettingStarted
          key={scope}
          userId={user.id}
          companyId={company.id}
          canEditCompany={role === "owner"}
          data={data}
        />
      )}
      <WorkspacePanel key={`actions:${scope}`} data={data} onRetry={load} />

      {noQuotes ? (
        <EmptyState
          title="Rien à suivre pour l’instant"
          description="Importez votre premier devis ou saisissez-le. Si vous l’avez déjà envoyé, indiquez sa date pour démarrer le suivi."
          action={<LinkButton to="/app/quotes/new">Créer un devis</LinkButton>}
        />
      ) : (
        <>
          <div className="grid min-w-0 gap-4 sm:grid-cols-3">
            <Stat
              tone="warning"
              icon={<AlertTriangle size={18} />}
              label="À relancer"
              count={data.followUp.complete ? data.followUp.count : null}
              amount={
                data.followUp.complete
                  ? formatCents(data.followUp.amountCents)
                  : "Vérifications indisponibles"
              }
            />
            <Stat
              tone="primary"
              icon={<Clock size={18} />}
              label="Montants en attente"
              count={data.pending.count}
              amount={formatCents(data.pending.amountCents)}
            />
            <Stat
              tone="success"
              icon={<CheckCircle2 size={18} />}
              label="Devis acceptés"
              count={data.accepted.count}
              amount={formatCents(data.accepted.amountCents)}
            />
          </div>
          <div className="mt-4 grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
            <MiniStat label="Taux d’acceptation" value={`${data.acceptanceRate} %`} />
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
              label="Sans activité depuis 14 j"
              value={String(data.staleCount)}
              warning={data.staleCount > 0}
            />
          </div>

          {/* Priority follow-up list */}
          <section className="mt-8">
            <div className="mb-3 flex min-w-0 items-center justify-between gap-4">
              <h2 className="min-w-0 text-sm font-semibold text-ink">
                À relancer en priorité
              </h2>
              <Link
                to="/app/quotes"
                className="shrink-0 text-xs font-medium text-primary hover:underline"
              >
                Voir tous les devis
              </Link>
            </div>
            {!data.followUp.complete ? (
              <Card className="p-6 text-sm text-muted">
                Les relances à préparer ne peuvent pas être confirmées pour le moment.
              </Card>
            ) : data.priority.length === 0 ? (
              <Card className="p-6 text-sm text-muted">
                Aucun devis à relancer pour le moment.
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <TableScroll>
                  <table className="min-w-[680px] w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                        <th scope="col" className="px-5 py-3 font-medium">
                          Client
                        </th>
                        <th scope="col" className="px-5 py-3 font-medium">
                          Référence
                        </th>
                        <th scope="col" className="px-5 py-3 text-right font-medium">
                          Montant
                        </th>
                        <th scope="col" className="px-5 py-3 font-medium">
                          Envoyé le
                        </th>
                        <th scope="col" className="px-5 py-3 font-medium">
                          Attente
                        </th>
                        <th scope="col" className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {data.priority.map((q) => (
                        <tr
                          key={q.id}
                          className="border-b border-line last:border-0 hover:bg-background"
                        >
                          <td className="px-5 py-3 text-ink">
                            {q.client?.name ?? "—"}
                          </td>
                          <td className="px-5 py-3 font-mono text-xs text-ink-soft">
                            {q.reference}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold tabular-nums text-ink">
                            {formatCents(q.amount_cents)}
                          </td>
                          <td className="px-5 py-3 text-muted">
                            {formatDate(q.sent_at)}
                          </td>
                          <td className="px-5 py-3">
                            <FollowUpBadge days={daysWaiting(q)} />
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Link
                              to={`/app/quotes/${q.id}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              Voir le devis <ArrowRight size={14} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
              </Card>
            )}
          </section>

          {/* Latest quotes */}
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-ink">Derniers devis</h2>
            <Card className="overflow-hidden">
              <TableScroll>
                <table className="min-w-[540px] w-full text-sm">
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">Référence</th>
                      <th scope="col">Client</th>
                      <th scope="col">Montant</th>
                      <th scope="col">Statut</th>
                      <th scope="col">Envoyé le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.latest.map((q) => (
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
                        <td className="px-5 py-3">
                          <StatusBadge status={q.status} />
                        </td>
                        <td className="px-5 py-3 text-muted">
                          {formatDate(q.sent_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            </Card>
          </section>
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
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p
        className={`mt-2 break-words text-xl font-semibold tabular-nums ${warning ? "text-warning" : "text-ink"}`}
      >
        {value}
      </p>
    </Card>
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
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}
        >
          {icon}
        </span>
        <span className="text-sm font-medium text-ink-soft">{label}</span>
      </div>
      <p className="mt-4 tabular-nums text-3xl font-semibold tracking-tight text-ink">
        {count ?? "—"}
      </p>
      <p className="mt-2 tabular-nums text-sm text-muted">{amount}</p>
    </Card>
  )
}
