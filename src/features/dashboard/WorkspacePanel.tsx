import { useId, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  MessageSquare,
  AlertTriangle,
  FileText,
  Clock,
  Wrench,
  Send,
} from "lucide-react"
import { Button, Card, cx } from "@/components/ui"
import type { DashboardData } from "./api"
import type { WorkAction, ScheduledAction } from "./workspaceActions"
import { formatDate } from "@/lib/dates"
import { resolveQuoteSituation, quoteSituationLink } from "@/features/quotes/situation"

const unavailableLabel = {
  automation: "les relances automatiques",
  messages: "les questions des clients",
  events: "les réponses enregistrées",
  deliveries: "la livraison des emails",
  settings: "les paramètres d’envoi",
  sendJobs: "les envois de devis",
} as const

export function WorkspacePanel({
  data,
  onRetry,
}: {
  data: DashboardData
  onRetry: () => void
}) {
  const [allActions, setAllActions] = useState(false)
  const unavailable: string[] = Object.entries(data.reads)
    .filter(([, state]) => state === "unavailable")
    .map(([key]) => unavailableLabel[key as keyof typeof unavailableLabel])
  if (data.context.workOrdersRead === "unavailable")
    unavailable.push("le suivi des interventions")
  if (data.context.serviceReady === null)
    unavailable.push("la disponibilité du service d’envoi")
  const actionsUnverified =
    unavailable.length > 0 || data.context.preferencesUnavailable
  const followupSourcesUnavailable = Object.values(data.reads).some(
    (state) => state !== "available",
  )
  const groups = new Map<string, WorkAction[]>()
  for (const action of data.actions)
    groups.set(action.quoteId, [...(groups.get(action.quoteId) ?? []), action])
  const dossiers = [...groups.values()].map((actions) => {
    const quote = data.context.quotes.find((row) => row.id === actions[0].quoteId)
    if (!quote) return actions
    const situation = resolveQuoteSituation(
      quote,
      { ...data.context, quotes: [quote] },
      data.followupDelayDays,
    )
    const main = actions.find((action) => action.kind === situation.kind) ?? actions[0]
    return [
      {
        ...main,
        title: situation.title,
        detail: situation.detail,
        label: situation.label,
        to: quoteSituationLink(quote.id, situation),
        date: situation.date,
      },
      ...actions.filter((action) => action.id !== main.id),
    ]
  })
  const shown = allActions ? dossiers : dossiers.slice(0, 6)
  const automatic = data.scheduled.filter(
    (action) => action.automatic && data.context.serviceReady === true,
  )
  const manual = data.scheduled.filter((action) => !action.automatic)

  return (
    <section aria-labelledby="today-heading" className="mb-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="today-heading"
            className="text-lg font-semibold tracking-tight text-ink"
          >
            À faire aujourd’hui
          </h2>
          <p className="mt-1 text-sm text-muted">
            {dossiers.length
              ? `${dossiers.length} dossier${dossiers.length > 1 ? "s" : ""} demande${dossiers.length > 1 ? "nt" : ""} votre attention.`
              : "Commencez par les dossiers qui ont besoin de vous."}
          </p>
        </div>
        <Link
          to="/app/quotes?filter=attention"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          Voir les dossiers <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      {unavailable.length > 0 && (
        <Card className="mb-3 border-warning/30 bg-warning-soft/30 p-4">
          <p role="status" className="text-sm leading-6 text-ink-soft">
            Certaines vérifications sont indisponibles : {unavailable.join(", ")}. La
            liste peut être incomplète.
          </p>
          <Button onClick={onRetry} variant="ghost" className="mt-1">
            Réessayer les vérifications
          </Button>
        </Card>
      )}
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="min-w-0 overflow-hidden">
          {shown.length === 0 ? (
            <div className="flex items-start gap-3 p-5 sm:p-6">
              <CheckCircle2
                className={cx(
                  "mt-0.5 shrink-0",
                  actionsUnverified ? "text-muted" : "text-success",
                )}
                size={22}
                aria-hidden="true"
              />
              <div>
                <p className="text-base font-semibold text-ink">
                  {actionsUnverified
                    ? "Aucune action dans les données chargées"
                    : "Aucune action en attente"}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {actionsUnverified
                    ? "Réessayez les vérifications pour confirmer les autres dossiers."
                    : "Vos prochains suivis sont affichés à côté. Vous pouvez ajouter un devis ou retrouver un dossier."}
                </p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((actions, index) => (
                <ActionRow
                  key={actions[0].quoteId}
                  actions={actions}
                  primary={index === 0}
                />
              ))}
            </ul>
          )}
          {!allActions && dossiers.length > shown.length && (
            <div className="border-t border-line px-4 py-2">
              <Button variant="ghost" onClick={() => setAllActions(true)}>
                Afficher les {dossiers.length - shown.length} autres dossiers
              </Button>
            </div>
          )}
        </Card>
        <div className="min-w-0 space-y-4">
          <ScheduledGroup
            title="Cadova envoie"
            automatic
            items={automatic}
            unknown={followupSourcesUnavailable || data.context.serviceReady !== true}
          />
          <ScheduledGroup
            title="Vos rappels"
            items={manual}
            unknown={
              followupSourcesUnavailable ||
              Boolean(data.context.preferencesUnavailable) ||
              data.context.workOrdersRead === "unavailable"
            }
          />
        </div>
      </div>
    </section>
  )
}

function ScheduledGroup({
  title,
  automatic = false,
  items,
  unknown,
}: {
  title: string
  automatic?: boolean
  items: ScheduledAction[]
  unknown: boolean
}) {
  const headingId = useId()
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, 3)
  const Icon = automatic ? Send : CalendarDays
  return (
    <Card role="region" aria-labelledby={headingId} className="min-w-0 overflow-hidden">
      <div className="flex items-start gap-2 border-b border-line p-4">
        <Icon
          size={17}
          aria-hidden="true"
          className={cx("mt-0.5 shrink-0", automatic ? "text-primary" : "text-muted")}
        />
        <div>
          <h3 id={headingId} className="text-sm font-semibold text-ink">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            {automatic
              ? "Relances prévues automatiquement, sans action de votre part."
              : "Les prochaines dates qui vous concernent."}
          </p>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="p-4 text-sm leading-6 text-muted">
          {unknown
            ? "Les prochaines échéances ne peuvent pas être confirmées pour le moment."
            : automatic
              ? "Aucune relance automatique prévue. Vous pouvez choisir ce suivi dans un devis envoyé."
              : "Aucun rappel à venir. Choisissez une date dans le dossier d’un devis."}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((action) => (
            <li key={action.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{action.title}</p>
                <time
                  dateTime={action.date ?? undefined}
                  className="text-xs font-medium tabular-nums text-ink-soft"
                >
                  {formatDate(action.date?.slice(0, 10) ?? null)}
                </time>
              </div>
              <p className="mt-1 break-words text-sm text-ink-soft">
                {action.clientName}{" "}
                <span className="text-muted">· {action.reference}</span>
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {automatic
                  ? "Cadova enverra le message si le devis est toujours en attente et si les conditions d’envoi restent remplies."
                  : action.detail}
              </p>
              <Link
                to={action.to}
                className="mt-1 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                {action.label}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!all && items.length > shown.length && (
        <div className="border-t border-line px-4 py-2">
          <Button variant="ghost" onClick={() => setAll(true)}>
            Afficher les {items.length - shown.length} autres échéances
          </Button>
        </div>
      )}
    </Card>
  )
}

function ActionRow({
  actions,
  primary = false,
}: {
  actions: WorkAction[]
  primary?: boolean
}) {
  const [action, ...secondary] = actions
  const Icon =
    action.kind === "question" || action.kind === "response"
      ? MessageSquare
      : action.kind === "delivery" ||
          action.kind === "missing_email" ||
          action.kind === "expired"
        ? AlertTriangle
        : action.kind === "draft"
          ? FileText
          : action.kind === "work"
            ? Wrench
            : Clock
  return (
    <li className="flex min-w-0 items-start gap-3 p-4 sm:p-5">
      <span
        className={cx(
          "mt-0.5 shrink-0 rounded-lg p-2",
          action.kind === "delivery"
            ? "bg-danger-soft text-danger"
            : action.kind === "question"
              ? "bg-primary-soft text-primary"
              : "bg-background text-muted",
        )}
      >
        <Icon size={19} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-base font-semibold text-ink">
          {action.clientName}
        </p>
        <p className="mt-0.5 break-words font-mono text-xs text-muted">
          {action.reference}
        </p>
        <p className="mt-2 text-sm font-medium text-ink">{action.title}</p>
        <p className="mt-1 text-sm leading-6 text-muted">{action.detail}</p>
        <Link
          to={action.to}
          className={cx(
            "mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold",
            primary
              ? "bg-primary text-white hover:bg-primary-hover"
              : "bg-primary-soft text-primary hover:bg-primary-soft/70",
          )}
        >
          {action.label}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
        {secondary.length > 0 && (
          <details className="mt-2 text-sm">
            <summary className="min-h-11 cursor-pointer py-3 text-ink-soft">
              {secondary.length} autre{secondary.length > 1 ? "s" : ""} point
              {secondary.length > 1 ? "s" : ""} à vérifier
            </summary>
            <ul className="space-y-3 border-l border-line pl-3">
              {secondary.map((item) => (
                <li key={item.id}>
                  <p className="font-medium text-ink">{item.title}</p>
                  <p className="mt-1 leading-6 text-muted">{item.detail}</p>
                  <Link
                    to={item.to}
                    className="inline-flex min-h-11 items-center text-primary hover:underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </li>
  )
}
