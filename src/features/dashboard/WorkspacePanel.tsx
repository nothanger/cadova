import { useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  MessageSquare,
  AlertTriangle,
  FileText,
  Clock,
} from "lucide-react"
import { Button, Card } from "@/components/ui"
import type { DashboardData } from "./api"
import type { WorkAction } from "./workspaceActions"
import { formatDate } from "@/lib/dates"

const unavailableLabel = {
  automation: "Les relances automatiques",
  messages: "Les questions des clients",
  events: "Les réponses enregistrées",
  deliveries: "La livraison des emails",
  settings: "Les paramètres d’envoi",
  sendJobs: "Les envois de devis",
} as const

export function WorkspacePanel({
  data,
  onRetry,
}: {
  data: DashboardData
  onRetry: () => void
}) {
  const [allActions, setAllActions] = useState(false)
  const [allScheduled, setAllScheduled] = useState(false)
  const unavailable = Object.entries(data.reads)
    .filter(([, state]) => state === "unavailable")
    .map(([key]) => unavailableLabel[key as keyof typeof unavailableLabel])
  const shownActions = allActions ? data.actions : data.actions.slice(0, 6)
  const shownScheduled = allScheduled ? data.scheduled : data.scheduled.slice(0, 4)
  return (
    <section aria-labelledby="today-heading" className="mb-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="today-heading"
            className="text-lg font-semibold tracking-tight text-ink"
          >
            À faire aujourd’hui
          </h2>
          <p className="mt-1 text-sm text-muted">
            Les dossiers qui demandent votre attention.
          </p>
        </div>
        <Link
          to="/app/quotes/new"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          Ajouter un devis
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      {unavailable.length > 0 && (
        <Card className="mb-3 p-4">
          <p role="status" className="text-sm leading-6 text-muted">
            Certaines vérifications sont indisponibles :{" "}
            {unavailable.join(", ").toLocaleLowerCase("fr-FR")}. La liste peut être
            incomplète.
          </p>
          <Button onClick={onRetry} variant="ghost" className="mt-1">
            Réessayer les vérifications
          </Button>
        </Card>
      )}
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="min-w-0 overflow-hidden">
          {shownActions.length === 0 ? (
            <div className="flex items-start gap-3 p-5">
              <CheckCircle2
                className="mt-0.5 shrink-0 text-success"
                size={20}
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-ink">
                  {unavailable.length
                    ? "Aucune action dans les données chargées"
                    : "Aucune action en attente"}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {unavailable.length
                    ? "Réessayez les vérifications pour confirmer les autres dossiers."
                    : "Vos prochains rappels apparaissent dans le calendrier."}
                </p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {shownActions.map((action) => (
                <ActionRow key={action.id} action={action} />
              ))}
            </ul>
          )}
          {!allActions && data.actions.length > shownActions.length && (
            <div className="border-t border-line px-4 py-2">
              <Button variant="ghost" onClick={() => setAllActions(true)}>
                Afficher les {data.actions.length - shownActions.length} autres actions
              </Button>
            </div>
          )}
        </Card>
        <Card className="min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line p-4">
            <CalendarDays size={17} aria-hidden="true" className="text-muted" />
            <h3 className="text-sm font-semibold text-ink">Prochains rappels</h3>
          </div>
          {shownScheduled.length === 0 ? (
            <p className="p-5 text-sm leading-6 text-muted">
              {data.reads.automation !== "available" ||
              data.reads.settings !== "available"
                ? "Le calendrier des relances ne peut pas être confirmé pour le moment."
                : "Aucun rappel planifié. Choisissez une date depuis le dossier d’un devis."}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {shownScheduled.map((action) => (
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
                    {action.clientName} · {action.reference}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted">{action.detail}</p>
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
          {!allScheduled && data.scheduled.length > shownScheduled.length && (
            <div className="border-t border-line px-4 py-2">
              <Button variant="ghost" onClick={() => setAllScheduled(true)}>
                Afficher tous les rappels
              </Button>
            </div>
          )}
        </Card>
      </div>
    </section>
  )
}

function ActionRow({ action }: { action: WorkAction }) {
  const Icon =
    action.kind === "question" || action.kind === "response"
      ? MessageSquare
      : action.kind === "delivery" ||
          action.kind === "missing_email" ||
          action.kind === "expired"
        ? AlertTriangle
        : action.kind === "draft"
          ? FileText
          : Clock
  return (
    <li className="flex min-w-0 items-start gap-3 p-4 sm:p-5">
      <span
        className={`mt-0.5 shrink-0 ${action.kind === "delivery" ? "text-danger" : action.kind === "question" ? "text-primary" : "text-muted"}`}
      >
        <Icon size={19} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{action.title}</p>
        <p className="mt-1 break-words text-sm text-ink-soft">
          {action.clientName} · {action.reference}
        </p>
        <p className="mt-1 text-sm leading-6 text-muted">{action.detail}</p>
        <Link
          to={action.to}
          className="mt-1 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          {action.label}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </li>
  )
}
