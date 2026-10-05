import { createClient } from "npm:@supabase/supabase-js@2.112.4"
import { createResendEventHandler, type EmailEventBackend } from "./handler.ts"
import { validReceiveDomain } from "./validation.ts"

const url = Deno.env.get("SUPABASE_URL")
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
if (!url || !key) throw new Error("Email events backend configuration is missing")
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args)
  if (error) throw new Error("Email event operation failed")
  return data as T
}
const backend: EmailEventBackend = {
  async setServiceStatus(deliveryReady, receivingReady) {
    await rpc("set_quote_email_tracking_status", { p_delivery_ready: deliveryReady, p_receiving_ready: receivingReady })
  },
  processDelivery: input => rpc("process_quote_email_delivery", {
    p_event_id: input.eventId, p_provider_message_id: input.providerMessageId,
    p_status: input.status, p_occurred_at: input.occurredAt,
  }),
  recordReply: input => rpc("record_quote_email_reply", {
    p_event_id: input.eventId, p_received_email_id: input.receivedEmailId,
    p_recipient: input.recipient, p_from: input.from, p_content: input.content,
    p_occurred_at: input.occurredAt, p_headers: input.headers,
  }),
}
const config = {
  webhookSecret: Deno.env.get("RESEND_WEBHOOK_SECRET"),
  resendApiKey: Deno.env.get("RESEND_API_KEY"),
  receiveDomain: Deno.env.get("RESEND_RECEIVE_DOMAIN"),
  receivingEnabled: Deno.env.get("QUOTE_REPLY_EMAIL_ENABLED") === "true",
}
// Turning this flag on is an operator action after receiving DNS/domain setup.
// It never silently replaces an existing mailbox's MX records.
const signatureReady = typeof config.webhookSecret === "string" && /^whsec_[A-Za-z0-9+/]+={0,2}$/.test(config.webhookSecret)
await backend.setServiceStatus(signatureReady, signatureReady && config.receivingEnabled &&
  validReceiveDomain(config.receiveDomain) && typeof config.resendApiKey === "string" && /^re_[A-Za-z0-9_-]+$/.test(config.resendApiKey))
Deno.serve(createResendEventHandler(backend, config))
