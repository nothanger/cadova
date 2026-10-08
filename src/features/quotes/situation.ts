import type { QuoteWithClient } from "@/types"
import { formatDate, toISODate } from "@/lib/dates"
import {
  buildWorkspaceActions,
  type WorkspaceContext,
  type WorkActionKind,
} from "@/features/dashboard/workspaceActions"

export type QuoteSituationTarget =
  | "document"
  | "conversation"
  | "delivery"
  | "followups"
  | "response"
  | "work"
  | "history"
  | "details"

export interface QuoteSituation {
  kind:
    | WorkActionKind
    | "unknown"
    | "awaiting"
    | "automatic"
    | "manual_scheduled"
    | "accepted"
    | "refused"
    | "work_scheduled"
    | "work_in_progress"
    | "work_completed"
  title: string
  detail: string
  label: string
  target: QuoteSituationTarget
  /** A contextual action can lead straight to an existing client form. */
  destination?: string
  tone: "neutral" | "primary" | "warning" | "danger" | "success"
  automatic: boolean
  date: string | null
  complete: boolean
  /** A next action is different from a future reminder or a closed dossier. */
  attention: boolean
}

/** Presentation only: the server still decides which mutations and sends are allowed. */
export function resolveQuoteSituation(
  quote: QuoteWithClient,
  context: WorkspaceContext,
  delayDays = 3,
  now = new Date(),
): QuoteSituation {
  const unknown = (
    detail = "Le suivi n’a pas pu être entièrement vérifié. Actualisez avant de choisir la suite.",
  ): QuoteSituation => ({
    kind: "unknown",
    title: "Suivi à vérifier",
    detail,
    label: "Vérifier le suivi",
    target: "details",
    tone: "warning",
    automatic: false,
    date: null,
    complete: false,
    attention: false,
  })
  if (
    quote.company_id !== context.companyId ||
    !context.quotes.some(
      (row) => row.id === quote.id && row.company_id === context.companyId,
    )
  )
    return unknown(
      "Ce devis n’appartient pas à l’espace chargé. Rechargez votre espace.",
    )

  // Resolve one dossier, rather than rebuilding the whole company for every list row.
  const workspace = buildWorkspaceActions(
    { ...context, quotes: context.quotes.filter((row) => row.id === quote.id) },
    delayDays,
    now,
  )
  const actions = workspace.actions.filter((row) => row.quoteId === quote.id)
  const scheduled = workspace.scheduled.find((row) => row.quoteId === quote.id)
  const complete =
    Object.values(context.reads).every((state) => state === "available") &&
    context.clientRead !== "unavailable"
  const fromAction = (kind: WorkActionKind): QuoteSituation | null => {
    const action = actions.find((row) => row.kind === kind)
    if (!action) return null
    const targets: Record<WorkActionKind, QuoteSituationTarget> = {
      question: "conversation",
      delivery: "delivery",
      response: "history",
      expired: "details",
      missing_email: "details",
      draft: "document",
      followup: "followups",
      automation_paused: "followups",
      review: "history",
      work: "work",
    }
    return {
      kind,
      title: action.title,
      detail: action.detail,
      label:
        kind === "response"
          ? "Lire la réponse"
          : kind === "review"
            ? "Voir les échanges"
            : action.label,
      target:
        kind === "delivery" && action.to.endsWith("?focus=document")
          ? "document"
          : kind === "delivery" && action.to.endsWith("?focus=followups")
            ? "followups"
            : targets[kind],
      ...(kind === "missing_email" ? { destination: action.to } : {}),
      tone:
        kind === "delivery"
          ? "danger"
          : kind === "question" || kind === "draft"
            ? "primary"
            : "warning",
      automatic: false,
      date: action.date,
      complete:
        complete && !(kind === "automation_paused" && context.serviceReady === null),
      attention: true,
    }
  }

  // A client waiting for an answer and an unresolved send precede every other action.
  const urgent = fromAction("question") ?? fromAction("delivery")
  if (urgent) return urgent

  if (quote.status === "accepted") {
    const work = context.workOrders?.find(
      (row) => row.quote_id === quote.id && row.company_id === quote.company_id,
    )
    const workKnown = context.workOrdersRead === "available"
    if (!workKnown)
      return {
        kind: "accepted",
        title: "Devis accepté",
        detail:
          "Consultez le suivi pour vérifier la prochaine étape de l’intervention.",
        label: "Voir l’intervention",
        target: "work",
        tone: "success",
        automatic: false,
        date: null,
        complete: false,
        attention: false,
      }
    if (!work || work.status === "to_schedule")
      return {
        kind: "accepted",
        title: "Intervention à planifier",
        detail: "L’accord est enregistré. Choisissez la date de votre intervention.",
        label: "Planifier l’intervention",
        target: "work",
        tone: "success",
        automatic: false,
        date: null,
        complete,
        attention: true,
      }
    if (work.status === "scheduled")
      return {
        kind: "work_scheduled",
        title: "Intervention planifiée",
        detail: `Intervention prévue le ${formatDate(work.scheduled_for)}. Vous pourrez indiquer son démarrage dans le suivi.`,
        label: "Voir l’intervention",
        target: "work",
        tone: "success",
        automatic: false,
        date: work.scheduled_for,
        complete,
        attention: Boolean(work.scheduled_for && work.scheduled_for <= toISODate(now)),
      }
    if (work.status === "in_progress")
      return {
        kind: "work_in_progress",
        title: "Intervention en cours",
        detail: "Mettez le suivi à jour lorsque le travail est terminé.",
        label: "Suivre l’intervention",
        target: "work",
        tone: "primary",
        automatic: false,
        date: work.scheduled_for,
        complete,
        attention: true,
      }
    return {
      kind: "work_completed",
      title: "Intervention terminée",
      detail: "Le dossier conserve le devis et tous vos échanges.",
      label: "Voir l’historique",
      target: "history",
      tone: "success",
      automatic: false,
      date: null,
      complete,
      attention: false,
    }
  }
  if (quote.status === "refused")
    return {
      kind: "refused",
      title: "Devis refusé",
      detail:
        "La décision est enregistrée. Aucune relance automatique n’est prévue pour ce devis.",
      label: "Voir l’historique",
      target: "history",
      tone: "neutral",
      automatic: false,
      date: null,
      complete,
      attention: false,
    }
  if (quote.status === "draft") {
    if (context.reads.sendJobs !== "available")
      return unknown(
        "L’état d’envoi n’a pas pu être vérifié. Consultez le résultat avant une nouvelle tentative.",
      )
    return {
      kind: "draft",
      title: "Préparer l’envoi",
      detail:
        "Vérifiez le PDF et le destinataire, ou indiquez que ce devis est déjà envoyé.",
      label: "Préparer l’envoi",
      target: "document",
      tone: "primary",
      automatic: false,
      date: null,
      complete,
      attention: true,
    }
  }
  const response = fromAction("response")
  if (response) return response
  const expired = fromAction("expired")
  if (expired) return expired
  // With missing sources, absence of an action never means absence of a response.
  if (!complete) return unknown()
  const review = fromAction("review")
  if (review) return review
  const paused = fromAction("automation_paused")
  if (paused) return paused
  const automation = context.automations.find(
    (row) => row.company_id === context.companyId && row.quote_id === quote.id,
  )
  if (automation?.enabled) {
    if (context.serviceReady !== true)
      return unknown(
        context.serviceReady === false
          ? "Le service d’envoi est indisponible. Aucune prochaine relance automatique ne peut être confirmée."
          : "Les relances sont configurées, mais la disponibilité du service n’a pas pu être vérifiée.",
      )
    const client = context.quotes.find(
      (row) => row.id === quote.id && row.company_id === quote.company_id,
    )?.client
    if (!context.replyTo || !client?.email?.trim())
      return unknown(
        "Vérifiez les coordonnées du client et l’adresse de réponse avant de poursuivre les relances.",
      )
    if (scheduled?.automatic)
      return {
        kind: "automatic",
        title: "Relance automatique prévue",
        detail: `Cadova prévoit le prochain message le ${formatDate(scheduled.date?.slice(0, 10) ?? null)}, si le devis reste sans réponse et les relances actives.`,
        label: "Voir les relances",
        target: "followups",
        tone: "primary",
        automatic: true,
        date: scheduled.date,
        complete: true,
        attention: false,
      }
    return unknown(
      "Les relances sont activées, mais aucune prochaine date d’envoi n’est confirmée. Consultez le suivi.",
    )
  }
  const missingEmail = fromAction("missing_email")
  if (missingEmail) return missingEmail
  if (context.preferencesUnavailable)
    return unknown(
      "Votre délai de rappel n’a pas pu être chargé. Actualisez pour confirmer les relances à préparer.",
    )
  const due = fromAction("followup")
  if (due) return due
  if (scheduled && !scheduled.automatic)
    return {
      kind: "manual_scheduled",
      title: "Rappel de relance prévu",
      detail: `Vous devrez préparer le message le ${formatDate(scheduled.date?.slice(0, 10) ?? null)}. Ce rappel n’envoie aucun email.`,
      label: "Voir le rappel",
      target: "followups",
      tone: "neutral",
      automatic: false,
      date: scheduled.date,
      complete: true,
      attention: false,
    }
  return {
    kind: "awaiting",
    title: "En attente du client",
    detail:
      "Retrouvez les échanges ici. Vous pouvez choisir un rappel ou activer les relances automatiques.",
    label: "Choisir le suivi",
    target: "followups",
    tone: "neutral",
    automatic: false,
    date: null,
    complete: true,
    attention: false,
  }
}

export function quoteSituationLink(quoteId: string, situation: QuoteSituation): string {
  if (situation.destination) return situation.destination
  if (situation.kind === "unknown") return `/app/quotes/${encodeURIComponent(quoteId)}`
  return `/app/quotes/${encodeURIComponent(quoteId)}?focus=${situation.target}`
}
