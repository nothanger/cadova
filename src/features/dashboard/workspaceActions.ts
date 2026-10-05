import type { QuoteWithClient } from "@/types"
import { daysBetween, toISODate } from "@/lib/dates"

export interface WorkspaceQuote extends QuoteWithClient {
  client: (QuoteWithClient["client"] & { email?: string | null }) | null
}

export interface WorkspaceAutomation {
  quote_id: string
  company_id: string
  enabled: boolean
  paused: boolean
  next_send_at: string | null
  stop_reason: string | null
}

export interface WorkspaceMessage {
  id: string
  company_id: string
  quote_id: string
  author: "client" | "company"
  kind: "question" | "accepted" | "refused" | "message"
  created_at: string
}

export interface WorkspaceEvent {
  company_id: string
  quote_id: string
  event_type: string
  occurred_at: string
}

export interface WorkspaceDelivery {
  id: string
  company_id: string
  quote_id: string
  status: "accepted" | "delayed" | "delivered" | "bounced" | "failed" | "complained"
  last_event_at: string
  created_at: string
}

export interface WorkspaceSendJob {
  company_id: string
  quote_id: string
  status:
    "preparing" | "processing" | "sent" | "failed" | "cancelled" | "delivery_unknown"
  created_at: string
}

export type ReadState = "available" | "unavailable"
export interface WorkspaceContext {
  companyId: string
  quotes: WorkspaceQuote[]
  automations: WorkspaceAutomation[]
  messages: WorkspaceMessage[]
  events: WorkspaceEvent[]
  deliveries: WorkspaceDelivery[]
  sendJobs: WorkspaceSendJob[]
  replyTo: string | null
  companyPaused: boolean
  reads: Record<
    "automation" | "messages" | "events" | "deliveries" | "settings" | "sendJobs",
    ReadState
  >
}

export type WorkActionKind =
  | "question"
  | "delivery"
  | "response"
  | "expired"
  | "missing_email"
  | "draft"
  | "followup"
  | "automation_paused"
  | "review"
export interface WorkAction {
  id: string
  quoteId: string
  clientName: string
  reference: string
  kind: WorkActionKind
  title: string
  detail: string
  label: string
  to: string
  date: string | null
}
export interface ScheduledAction extends WorkAction {
  automatic: boolean
}

export function buildWorkspaceActions(
  context: WorkspaceContext,
  delayDays = 3,
  now = new Date(),
) {
  const today = toISODate(now)
  const actions: WorkAction[] = []
  const scheduled: ScheduledAction[] = []
  const manualDue: WorkspaceQuote[] = []
  // The explicit tenant filter also protects derivations from stale mixed caches.
  const quotes = context.quotes.filter(
    (quote) => quote.company_id === context.companyId,
  )
  const automations = new Map(
    context.automations
      .filter((row) => row.company_id === context.companyId)
      .map((row) => [row.quote_id, row]),
  )
  const messages = context.messages.filter(
    (row) => row.company_id === context.companyId,
  )
  const events = context.events.filter((row) => row.company_id === context.companyId)
  const deliveries = context.deliveries.filter(
    (row) => row.company_id === context.companyId,
  )
  const sendJobs = context.sendJobs.filter(
    (row) => row.company_id === context.companyId,
  )
  const followupsKnown =
    context.reads.automation === "available" &&
    context.reads.events === "available" &&
    context.reads.messages === "available" &&
    context.reads.deliveries === "available" &&
    context.reads.sendJobs === "available"

  for (const quote of quotes) {
    const quotePath = `/app/quotes/${quote.id}`
    const add = (
      kind: WorkActionKind,
      title: string,
      detail: string,
      label: string,
      date: string | null = null,
      to = quotePath,
    ) => {
      const action: WorkAction = {
        id: `${quote.id}:${kind}`,
        quoteId: quote.id,
        reference: quote.reference,
        clientName: quote.client?.name ?? "Client à vérifier",
        kind,
        title,
        detail,
        label,
        date,
        to,
      }
      actions.push(action)
      return action
    }
    const conversation = messages.filter((message) => message.quote_id === quote.id)
    const latestReply = conversation
      .filter((message) => message.author === "company")
      .reduce(
        (latest, message) =>
          message.created_at > latest ? message.created_at : latest,
        "",
      )
    const question = conversation
      .filter(
        (message) =>
          message.author === "client" &&
          message.kind === "question" &&
          message.created_at > latestReply,
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
    if (question)
      add(
        "question",
        "Répondre au client",
        "Une question attend votre réponse dans le dossier.",
        "Lire la question",
        question.created_at,
      )

    const latestDelivery = deliveries
      .filter((delivery) => delivery.quote_id === quote.id)
      .sort(
        (a, b) =>
          b.created_at.localeCompare(a.created_at) ||
          b.last_event_at.localeCompare(a.last_event_at),
      )[0]
    const deliveryProblem =
      latestDelivery &&
      ["bounced", "failed", "complained"].includes(latestDelivery.status)
    if (deliveryProblem)
      add(
        "delivery",
        "Vérifier l’envoi",
        latestDelivery.status === "complained"
          ? "Le destinataire a signalé cet email. Vérifiez le dossier avant tout nouvel envoi."
          : "Le dernier email n’a pas été livré. Vérifiez les coordonnées du client.",
        "Voir l’envoi",
        latestDelivery.last_event_at,
      )

    const latestSend = sendJobs
      .filter((job) => job.quote_id === quote.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    const sendUnresolved =
      latestSend &&
      (["preparing", "processing", "delivery_unknown"].includes(latestSend.status) ||
        (latestSend.status === "failed" && quote.status === "draft"))
    const sendPending =
      latestSend && ["preparing", "processing"].includes(latestSend.status)
    if (sendUnresolved && !deliveryProblem)
      add(
        "delivery",
        sendPending ? "Vérifier l’envoi en cours" : "Vérifier l’envoi",
        sendPending
          ? "Un envoi est en cours. Attendez son résultat avant une nouvelle tentative."
          : latestSend.status === "delivery_unknown"
            ? "Le résultat de l’envoi est incertain. Vérifiez le dossier avant toute nouvelle tentative."
            : "Le devis n’a pas pu être envoyé. Consultez le résultat dans le dossier.",
        "Voir l’envoi",
        latestSend.created_at,
      )
    if (sendUnresolved) continue

    if (quote.status === "draft" && context.reads.sendJobs !== "available") {
      if (!deliveryProblem)
        add(
          "delivery",
          "Vérifier l’envoi",
          "Le statut d’envoi de ce brouillon n’a pas pu être vérifié. Consultez le dossier avant tout envoi.",
          "Voir le dossier",
        )
      continue
    }

    if (quote.status === "accepted" || quote.status === "refused") continue
    const automation = automations.get(quote.id)
    if (automation?.stop_reason === "delivery_unknown") {
      if (!deliveryProblem)
        add(
          "delivery",
          "Vérifier la relance",
          "Le résultat de la dernière relance est incertain. Vérifiez le dossier avant un nouvel envoi.",
          "Voir l’envoi",
        )
      continue
    }
    const latestResponse = events
      .filter((event) => event.quote_id === quote.id && event.event_type === "response")
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0]
    const latestHandling = events
      .filter(
        (event) =>
          event.quote_id === quote.id &&
          ["followup", "followup_scheduled"].includes(event.event_type),
      )
      .reduce(
        (latest, event) => (event.occurred_at > latest ? event.occurred_at : latest),
        "",
      )
    const responseReceived = latestResponse
      ? latestResponse.occurred_at > latestHandling
      : automation?.stop_reason === "response_received" && !latestHandling
    if (responseReceived && !question)
      add(
        "response",
        "Faire le point sur la réponse",
        "Une réponse a été reçue. Mettez à jour le devis ou choisissez la suite.",
        "Voir le dossier",
        latestResponse?.occurred_at ?? null,
      )
    if (quote.expires_at && quote.expires_at < today) {
      add(
        "expired",
        "Décider de la suite",
        "La date de validité du devis est dépassée.",
        "Vérifier le devis",
        quote.expires_at,
      )
      continue
    }
    if (!quote.client?.email?.trim()) {
      add(
        "missing_email",
        "Compléter l’adresse email",
        "Une adresse client est nécessaire pour envoyer un email depuis Cadova.",
        "Compléter le client",
        null,
        quote.client ? `/app/clients/${quote.client.id}/edit` : `${quotePath}/edit`,
      )
    }
    if (quote.status === "draft") {
      add(
        "draft",
        "Préparer le devis",
        "Vérifiez le brouillon, puis envoyez-le ou indiquez qu’il est déjà envoyé.",
        "Ouvrir le brouillon",
      )
      continue
    }
    if (responseReceived || question || deliveryProblem || !followupsKnown) continue
    if (automation?.stop_reason === "completed") {
      add(
        "review",
        "Faire le point sur le dossier",
        "Les relances prévues sont terminées. Choisissez la suite avec ce client.",
        "Voir le dossier",
      )
      continue
    }
    if (automation?.enabled) {
      if (context.reads.settings !== "available") continue
      if (automation.paused || context.companyPaused) {
        add(
          "automation_paused",
          "Vérifier la pause",
          "Les relances automatiques de ce devis sont en pause.",
          "Voir les relances",
        )
      } else if (automation.next_send_at) {
        scheduled.push({
          id: `${quote.id}:automatic`,
          quoteId: quote.id,
          reference: quote.reference,
          clientName: quote.client?.name ?? "Client à vérifier",
          kind: "followup",
          title: "Relance automatique",
          detail: "Envoi programmé, sous réserve de disponibilité du service.",
          label: "Voir le calendrier",
          to: quotePath,
          date: automation.next_send_at,
          automatic: true,
        })
      }
      continue
    }
    const scheduledDate = quote.next_followup_at
    const due = scheduledDate
      ? scheduledDate <= today
      : quote.sent_at && daysBetween(quote.sent_at, today) >= delayDays
    if (due) {
      manualDue.push(quote)
      if (quote.client?.email?.trim())
        add(
          "followup",
          "Préparer la relance",
          scheduledDate
            ? "La date de relance choisie est arrivée."
            : "Le devis attend une réponse depuis le délai choisi.",
          "Préparer le message",
          scheduledDate ?? quote.sent_at,
        )
    } else if (scheduledDate) {
      scheduled.push({
        id: `${quote.id}:manual`,
        quoteId: quote.id,
        reference: quote.reference,
        clientName: quote.client?.name ?? "Client à vérifier",
        kind: "followup",
        title: "Relance à préparer",
        detail: "Rappel dans le dossier. Aucun email envoyé automatiquement.",
        label: "Voir le devis",
        to: quotePath,
        date: scheduledDate,
        automatic: false,
      })
    }
  }
  const rank: Record<WorkActionKind, number> = {
    question: 0,
    delivery: 1,
    response: 2,
    followup: 3,
    review: 4,
    expired: 5,
    missing_email: 6,
    automation_paused: 7,
    draft: 8,
  }
  actions.sort(
    (a, b) =>
      rank[a.kind] - rank[b.kind] ||
      (a.date ?? "9999").localeCompare(b.date ?? "9999") ||
      a.reference.localeCompare(b.reference),
  )
  scheduled.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
  manualDue.sort((a, b) =>
    (a.next_followup_at ?? a.sent_at ?? "").localeCompare(
      b.next_followup_at ?? b.sent_at ?? "",
    ),
  )
  return { actions, scheduled, manualDue, followupsKnown }
}
