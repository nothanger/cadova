import {
  limitedBytes, mailbox, maxReceivedEmailBytes, maxWebhookBytes, parseEvent,
  plainContent, record, safeReplyHeaders, validReceiveDomain, verifyWebhookSignature,
  type DeliveryStatus,
} from "./validation.ts"

export interface EmailEventBackend {
  setServiceStatus(deliveryReady: boolean, receivingReady: boolean): Promise<void>
  processDelivery(input: { eventId: string; providerMessageId: string; status: DeliveryStatus; occurredAt: string }): Promise<"applied" | "duplicate" | "unmatched">
  recordReply(input: { eventId: string; receivedEmailId: string; recipient: string; from: string; content: string; occurredAt: string; headers: Record<string, string> }): Promise<"applied" | "duplicate" | "ignored">
}

export interface EmailEventConfig {
  webhookSecret?: string
  resendApiKey?: string
  receivingEnabled: boolean
  receiveDomain?: string
}

export function createResendEventHandler(
  backend: EmailEventBackend,
  config: EmailEventConfig,
  dependencies: { fetcher?: typeof fetch; now?: () => number; timeoutMs?: number } = {},
) {
  const fetcher = dependencies.fetcher ?? fetch
  const now = dependencies.now ?? Date.now
  const timeoutMs = dependencies.timeoutMs ?? 10000
  const receivingReady = config.receivingEnabled && validReceiveDomain(config.receiveDomain) &&
    typeof config.resendApiKey === "string" && /^re_[A-Za-z0-9_-]+$/.test(config.resendApiKey)
  const json = (status: number, data: Record<string, unknown>) => new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  })

  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return json(405, { error: "method_not_allowed" })
    if (!config.webhookSecret || !/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(config.webhookSecret))
      return json(503, { error: "webhook_not_configured" })
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("Timeout")) }, timeoutMs)
    })
    try {
      const length = request.headers.get("Content-Length")
      if (length && (!/^\d+$/.test(length) || Number(length) > maxWebhookBytes)) return json(413, { error: "body_too_large" })
      let raw: Uint8Array
      try { raw = await Promise.race([limitedBytes(request.body, maxWebhookBytes, controller.signal), deadline]) }
      catch { return json(400, { error: "invalid_body" }) }
      if (!await verifyWebhookSignature(raw, request.headers, config.webhookSecret, now()))
        return json(401, { error: "invalid_signature" })
      let event
      try { event = parseEvent(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw))) }
      catch { return json(400, { error: "invalid_event" }) }
      if (!event || Date.parse(event.occurredAt) > now() + 300000) return json(400, { error: "invalid_event" })
      if (!event.status && event.type !== "email.received") return json(200, { state: "ignored" })
      const eventId = request.headers.get("svix-id")!
      try {
        await backend.setServiceStatus(true, receivingReady)
        if (event.status) {
          const state = await backend.processDelivery({ eventId, providerMessageId: event.emailId, status: event.status, occurredAt: event.occurredAt })
          // A webhook can precede persistence of the provider's HTTP response.
          // Returning a retryable status retains it instead of losing the event.
          return state === "unmatched" ? json(503, { error: "email_not_registered_yet" }) : json(200, { state })
        }
        if (!receivingReady) return json(503, { error: "receiving_not_configured" })
        const routes = event.to!.filter(address => address.endsWith(`@${config.receiveDomain}`) && /^q-[a-f0-9]{48}@/.test(address))
        if (routes.length !== 1) return json(200, { state: "ignored" })
        const response = await Promise.race([
          fetcher(`https://api.resend.com/emails/receiving/${encodeURIComponent(event.emailId)}`, {
            headers: { Authorization: `Bearer ${config.resendApiKey}` }, redirect: "error", signal: controller.signal,
          }), deadline,
        ])
        if (!response.ok) { void response.body?.cancel().catch(() => {}); return json(503, { error: "received_email_unavailable" }) }
        if (Number(response.headers.get("Content-Length")) > maxReceivedEmailBytes) { void response.body?.cancel().catch(() => {}); return json(503, { error: "received_email_too_large" }) }
        const bytes = await Promise.race([limitedBytes(response.body, maxReceivedEmailBytes, controller.signal), deadline])
        const received: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
        if (!record(received) || received.id !== event.emailId || mailbox(received.from) !== event.from ||
          !Array.isArray(received.to) || !received.to.some(value => mailbox(value) === routes[0])) return json(503, { error: "received_email_mismatch" })
        const content = plainContent(received.text) || plainContent(received.html, true)
        if (!content) return json(200, { state: "ignored" })
        const state = await backend.recordReply({ eventId, receivedEmailId: event.emailId, recipient: routes[0], from: event.from!, content, occurredAt: event.occurredAt, headers: safeReplyHeaders(received.headers) })
        return json(200, { state })
      } catch { return json(503, { error: "event_processing_unavailable" }) }
    } finally { clearTimeout(timer) }
  }
}
