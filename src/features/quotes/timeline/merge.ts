import type { QuoteEvent, QuoteWithClient } from "@/types"
import type { PortalMessage } from "@/features/quote-portal/api"
import type { QuoteEmailDelivery } from "../emailTrackingApi"

export type TimelineFilter = "all" | "messages" | "sending" | "tracking"
export interface TimelineItem {
  id: string
  category: Exclude<TimelineFilter, "all">
  title: string
  content: string | null
  at: string
  detail?: string
  tone?: "warning" | "danger"
}
export interface TimelineDocument {
  id: string
  company_id: string
  quote_id: string
  file_name: string
  created_at: string
}
export interface TimelineJob {
  id: string
  company_id: string
  quote_id: string
  status: string
  body: string | null
  sent_at: string | null
  updated_at: string
  created_at: string
}
export interface TimelineMessage extends PortalMessage {
  company_id: string
  quote_id: string
  nonce?: string
}
export interface TimelineSources {
  events: QuoteEvent[]
  messages: TimelineMessage[]
  deliveries: QuoteEmailDelivery[]
  documents: TimelineDocument[]
  initialJobs: TimelineJob[]
  followupJobs: TimelineJob[]
}
export const emptyTimelineSources = (): TimelineSources => ({
  events: [],
  messages: [],
  deliveries: [],
  documents: [],
  initialJobs: [],
  followupJobs: [],
})

const providerContent: Record<
  Exclude<QuoteEmailDelivery["status"], "accepted">,
  string
> = {
  delayed: "Le serveur du destinataire retarde la livraison de cet email.",
  delivered:
    "Le serveur du destinataire a accepté cet email. Sa lecture n’est pas confirmée.",
  bounced:
    "Le serveur du destinataire a refusé cet email. Vérifiez son adresse avant un nouvel envoi.",
  failed: "Le service d’envoi n’a pas pu livrer cet email.",
  complained:
    "Cet email a été signalé comme indésirable. Les relances automatiques sont arrêtées.",
}
const providerLabels = {
  accepted: "Email accepté par le service d’envoi",
  delayed: "Livraison retardée",
  delivered: "Email livré",
  bounced: "Email non livré",
  failed: "Échec de livraison",
  complained: "Email signalé comme indésirable",
}
const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
})
const day = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" })

/** Calendar-only values have no time: never fabricate midnight or convert through UTC. */
export function formatTimelineDate(value: string) {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)
  if (!Number.isFinite(date.getTime())) return "Date indisponible"
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? day.format(date) : dateTime.format(date)
}

function portalItem(message: PortalMessage): Pick<TimelineItem, "title" | "category"> {
  if (message.kind === "accepted")
    return { title: "Devis accepté par le client", category: "tracking" }
  if (message.kind === "refused")
    return { title: "Devis refusé par le client", category: "tracking" }
  return {
    title:
      message.author === "company" ? "Votre réponse au client" : "Question du client",
    category: "messages",
  }
}
function eventItem(event: QuoteEvent): Pick<TimelineItem, "title" | "category"> {
  const labels: Record<QuoteEvent["event_type"], string> = {
    sent: event.initial_send_job_id
      ? "Devis remis au service email"
      : "Devis marqué comme envoyé",
    followup: "Relance enregistrée",
    response: event.email_reply_id
      ? "Réponse reçue par email"
      : "Réponse du client enregistrée",
    note: "Note interne",
    status_change: "Statut du devis modifié",
    followup_scheduled: "Rappel de relance fixé",
    followup_auto_sent: "Relance automatique remise au service email",
    followup_auto_failed:
      event.delivery_status === "delivery_unknown"
        ? event.initial_send_job_id
          ? "Envoi du devis à vérifier"
          : "Envoi automatique à vérifier"
        : event.initial_send_job_id
          ? "Échec de l’envoi du devis"
          : "Échec de la relance automatique",
    work_order_change: "Suivi de l’intervention modifié",
  }
  return {
    title: labels[event.event_type] ?? "Activité du devis",
    category: [
      "sent",
      "followup",
      "followup_auto_sent",
      "followup_auto_failed",
    ].includes(event.event_type)
      ? "sending"
      : ["response", "note"].includes(event.event_type)
        ? "messages"
        : "tracking",
  }
}
function sameScope<T extends { company_id: string; quote_id: string }>(
  quote: QuoteWithClient,
  rows: T[],
) {
  return rows.filter(
    (row) => row.company_id === quote.company_id && row.quote_id === quote.id,
  )
}
function validDate(value: string) {
  return Number.isFinite(new Date(value).getTime())
}

/** Merge representations of the same event, retaining every original private note and email reply. */
export function mergeQuoteTimeline(
  quote: QuoteWithClient,
  sources: TimelineSources,
): TimelineItem[] {
  const events = sameScope(quote, sources.events).filter((event) =>
    validDate(event.occurred_at),
  )
  const messages = sameScope(quote, sources.messages)
  const deliveries = sameScope(quote, sources.deliveries)
  const portal = new Map(messages.map((message) => [message.id, message]))
  const emailMessages = new Map(
    messages
      .filter((message) => message.nonce)
      .map((message) => [message.nonce, message]),
  )
  const representedMessages = new Set(
    events.flatMap((event) => {
      const emailMessage = event.email_reply_id
        ? emailMessages.get(event.email_reply_id)
        : null
      return event.portal_message_id
        ? [event.portal_message_id]
        : emailMessage
          ? [emailMessage.id]
          : []
    }),
  )
  const rows: TimelineItem[] = events.map((event) => {
    const message = event.portal_message_id
      ? portal.get(event.portal_message_id)
      : event.email_reply_id
        ? emailMessages.get(event.email_reply_id)
        : null
    let metadata =
      message && !event.email_reply_id ? portalItem(message) : eventItem(event)
    let tone: TimelineItem["tone"] =
      event.delivery_status === "delivery_unknown"
        ? "warning"
        : event.delivery_status === "failed"
          ? "danger"
          : undefined
    if (event.email_delivery_id) {
      const status = Object.entries(providerContent).find(
        ([, content]) => content === event.content,
      )?.[0] as keyof typeof providerContent | undefined
      metadata = {
        title: status ? providerLabels[status] : "Mise à jour de la livraison",
        category: "sending",
      }
      if (status && ["failed", "bounced", "complained"].includes(status))
        tone = "danger"
      else if (status === "delayed") tone = "warning"
    }
    return {
      id: `event:${event.id}`,
      ...metadata,
      at:
        event.email_reply_id && message && validDate(message.created_at)
          ? message.created_at
          : event.occurred_at,
      // The event contains the full private email text; the public conversation may be truncated.
      content: event.content ?? message?.content ?? null,
      ...((event.initial_send_job_id && event.event_type === "sent") ||
      event.event_type === "followup_auto_sent"
        ? {
            detail:
              "L’envoi a été accepté par le service email. Cela ne confirme pas sa lecture.",
          }
        : {}),
      ...(tone ? { tone } : {}),
    }
  })
  for (const message of messages) {
    if (representedMessages.has(message.id)) continue
    rows.push({
      id: `message:${message.id}`,
      ...portalItem(message),
      at: message.created_at,
      content: message.content,
    })
  }
  for (const [kind, jobs] of [
    ["initial", sources.initialJobs],
    ["followup", sources.followupJobs],
  ] as const) {
    for (const job of sameScope(quote, jobs)) {
      if (!["sent", "failed", "delivery_unknown"].includes(job.status)) continue
      const linked = events.some(
        (event) =>
          (kind === "initial" ? event.initial_send_job_id : event.automation_job_id) ===
            job.id &&
          (job.status === "sent"
            ? event.event_type === "sent" || event.event_type === "followup_auto_sent"
            : event.delivery_status === job.status),
      )
      if (linked) continue
      rows.push({
        id: `${kind}:${job.id}`,
        category: "sending",
        title:
          job.status === "sent"
            ? kind === "initial"
              ? "Devis remis au service email"
              : "Relance automatique remise au service email"
            : job.status === "delivery_unknown"
              ? "Résultat de l’envoi à vérifier"
              : kind === "initial"
                ? "Échec de l’envoi du devis"
                : "Échec de la relance automatique",
        at: job.status === "sent" ? (job.sent_at ?? job.updated_at) : job.updated_at,
        content: job.body,
        detail:
          job.status === "sent"
            ? "L’envoi a été accepté par le service email. Cela ne confirme pas sa lecture."
            : job.status === "delivery_unknown"
              ? "Vérifiez cet envoi avant de réessayer : il peut avoir été accepté."
              : "Aucune livraison n’est confirmée pour cet envoi.",
        ...(job.status === "sent"
          ? {}
          : {
              tone:
                job.status === "failed" ? ("danger" as const) : ("warning" as const),
            }),
      })
    }
  }
  for (const delivery of deliveries) {
    if (delivery.status === "accepted") {
      const matchingSend =
        events.some(
          (event) =>
            (delivery.initial_send_job_id &&
              event.initial_send_job_id === delivery.initial_send_job_id &&
              event.event_type === "sent") ||
            (delivery.automation_job_id &&
              event.automation_job_id === delivery.automation_job_id &&
              event.event_type === "followup_auto_sent"),
        ) ||
        [...sources.initialJobs, ...sources.followupJobs].some(
          (job) =>
            job.company_id === quote.company_id &&
            job.quote_id === quote.id &&
            job.status === "sent" &&
            (job.id === delivery.initial_send_job_id ||
              job.id === delivery.automation_job_id),
        )
      if (matchingSend) continue
    } else if (
      events.some(
        (event) =>
          event.email_delivery_id === delivery.id &&
          event.content ===
            providerContent[delivery.status as keyof typeof providerContent],
      )
    )
      continue
    rows.push({
      id: `delivery:${delivery.id}`,
      category: "sending",
      title: providerLabels[delivery.status],
      at: delivery.last_event_at,
      content:
        delivery.status === "accepted"
          ? "Le service email a accepté cet envoi. Sa livraison n’est pas encore confirmée."
          : providerContent[delivery.status],
      detail: delivery.initial_send_job_id ? "Envoi du devis" : "Relance automatique",
      ...(["failed", "bounced", "complained"].includes(delivery.status)
        ? { tone: "danger" as const }
        : {}),
    })
  }
  for (const document of sameScope(quote, sources.documents)) {
    rows.push({
      id: `document:${document.id}`,
      category: "tracking",
      title: "Document ajouté au dossier",
      content: document.file_name,
      at: document.created_at,
    })
  }
  if (
    quote.sent_at &&
    !events.some((event) => event.event_type === "sent") &&
    !sources.initialJobs.some(
      (job) =>
        job.company_id === quote.company_id &&
        job.quote_id === quote.id &&
        job.status === "sent",
    )
  ) {
    rows.push({
      id: `recorded-sent:${quote.id}`,
      category: "sending",
      title: "Date d’envoi enregistrée",
      at: quote.sent_at,
      content:
        "Date renseignée dans le devis. Aucune preuve de livraison n’est ajoutée.",
    })
  }
  // Never synthesize a creation, acceptance, or completion event from current status alone.
  return [...new Map(rows.map((row) => [row.id, row])).values()]
    .filter((row) => validDate(row.at))
    .sort(
      (a, b) =>
        new Date(b.at).getTime() - new Date(a.at).getTime() || a.id.localeCompare(b.id),
    )
}

export function appendTimelineSources(
  previous: TimelineSources,
  next: TimelineSources,
): TimelineSources {
  const append = <T extends { id: string }>(old: T[], fresh: T[]) => [
    ...new Map([...old, ...fresh].map((row) => [row.id, row])).values(),
  ]
  return {
    events: append(previous.events, next.events),
    messages: append(previous.messages, next.messages),
    deliveries: append(previous.deliveries, next.deliveries),
    documents: append(previous.documents, next.documents),
    initialJobs: append(previous.initialJobs, next.initialJobs),
    followupJobs: append(previous.followupJobs, next.followupJobs),
  }
}
