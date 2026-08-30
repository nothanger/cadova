import { useEffect, useState, type ReactNode } from "react"
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
} from "@/components/ui"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import { getDashboardData, type DashboardData } from "./api"
import { getReminderPrefs } from "@/features/notifications/api"
import { humanizeError } from "@/lib/errors"
import { formatCents } from "@/lib/money"
import { formatDate } from "@/lib/dates"
import { daysWaiting } from "@/lib/followup"

export function DashboardPage() {
  const { user } = useAuth()
  const { company } = useCompany()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function load() {
    if (!company || !user) return
    setLoading(true)
    setError("")
    try {
      const prefs = await getReminderPrefs(user.id, company.id).catch(() => ({
        followupDelayDays: 3,
        reminderHour: 8,
      }))
      setData(await getDashboardData(company.id, prefs.followupDelayDays))
    } catch (err) {
      setError(humanizeError(err, "Impossible de charger le tableau de bord."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, user?.id])

  if (loading) return <Spinner />
  if (error || !data) return <ErrorState message={error} onRetry={load} />

  const noQuotes = data.latest.length === 0

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={
          company
            ? `Bonjour ${company.name} — voici ce qui mérite votre attention.`
            : ""
        }
      />

      {noQuotes ? (
        <EmptyState
          title="Rien à suivre pour l’instant"
          description="Créez un client puis un devis pour voir apparaître vos indicateurs de suivi."
          action={<LinkButton to="/app/quotes/new">Créer un devis</LinkButton>}
        />
      ) : (
        <>
          <div className="grid min-w-0 gap-4 sm:grid-cols-3">
            <Stat
              tone="warning"
              icon={<AlertTriangle size={18} />}
              label="À relancer"
              count={data.followUp.count}
              amount={formatCents(data.followUp.amountCents)}
            />
            <Stat
              tone="primary"
              icon={<Clock size={18} />}
              label="Argent en attente"
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
          <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Taux d’acceptation" value={`${data.acceptanceRate} %`} />
            <MiniStat label="Gagné ce mois-ci" value={formatCents(data.wonThisMonthCents)} />
            <MiniStat label="Délai moyen d’acceptation" value={data.averageAcceptanceDays === null ? "—" : `${data.averageAcceptanceDays} jours`} />
            <MiniStat label="Sans activité depuis 14 j" value={String(data.staleCount)} warning={data.staleCount > 0} />
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
            {data.priority.length === 0 ? (
              <Card className="p-6 text-sm text-muted">
                Aucun devis à relancer pour le moment. Beau travail 👌
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-[680px] w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                        <th className="px-5 py-3 font-medium">Client</th>
                        <th className="px-5 py-3 font-medium">Référence</th>
                        <th className="px-5 py-3 font-medium">Montant</th>
                        <th className="px-5 py-3 font-medium">Envoyé le</th>
                        <th className="px-5 py-3 font-medium">Retard</th>
                        <th className="px-5 py-3" />
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
                          <td className="px-5 py-3 font-mono text-ink">
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
                </div>
              </Card>
            )}
          </section>

          {/* Latest quotes */}
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-ink">
              Derniers devis
            </h2>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-[540px] w-full text-sm">
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
                        <td className="px-5 py-3 text-ink">
                          {q.client?.name ?? "—"}
                        </td>
                        <td className="px-5 py-3 font-mono text-ink">
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
              </div>
            </Card>
          </section>
        </>
      )}
    </>
  )
}

function MiniStat({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <Card className="p-4"><p className="text-xs font-medium text-muted">{label}</p><p className={`mt-2 text-xl font-semibold ${warning ? "text-warning" : "text-ink"}`}>{value}</p></Card>
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
  count: number
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
      <p className="mt-4 text-3xl font-semibold tracking-tight text-ink">
        {count}
      </p>
      <p className="mt-1 font-mono text-sm text-muted">{amount}</p>
    </Card>
  )
}
