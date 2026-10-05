import { createClient } from "npm:@supabase/supabase-js@2.112.4"
import {
  createQuoteFollowupHandler,
  type ClaimedFollowupJob,
  type PreparedFollowupSend,
  type ProviderEmailPayload,
  type QuoteFollowupBackend,
} from "./handler.ts"
import { prepareQuoteEmailLinks } from "../_shared/quote-email-links.ts"

const url = Deno.env.get("SUPABASE_URL")
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
if (!url || !serviceKey)
  throw new Error("Quote followup backend configuration is missing")
const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args)
  if (error) throw new Error("Quote followup backend operation failed")
  return data as T
}
function jobArguments(job: ClaimedFollowupJob) {
  return { p_job_id: job.id, p_lease_token: job.lease_token }
}
const backend: QuoteFollowupBackend = {
  consumeSchedulerNonce: (nonce, issuedAt) =>
    rpc<boolean>("consume_quote_followup_scheduler_nonce", {
      p_nonce: nonce,
      p_issued_at: issuedAt,
    }),
  async setServiceStatus(enabled, configured, status) {
    await rpc("set_quote_followup_service_status", {
      p_enabled: enabled,
      p_configured: configured,
      p_status_code: status,
    })
  },
  claim: (batchSize, leaseSeconds) =>
    rpc<ClaimedFollowupJob[]>("claim_quote_followup_jobs", {
      p_batch_size: batchSize,
      p_lease_seconds: leaseSeconds,
    }),
  prepare: (job, sender) =>
    rpc<PreparedFollowupSend>("prepare_quote_followup_send", {
      ...jobArguments(job),
      p_sender: sender,
    }),
  prepareLinks: (job, publicUrl, replyDomain) =>
    prepareQuoteEmailLinks(rpc, serviceKey, "followup", job, publicUrl, replyDomain),
  persistPayload: (job, payload) =>
    rpc<{ payload: ProviderEmailPayload; first_attempt_at: string }>(
      "persist_quote_followup_payload",
      { ...jobArguments(job), p_payload: payload },
    ),
  async recordAcceptance(job, providerId) {
    await rpc("record_quote_followup_provider_acceptance", {
      ...jobArguments(job),
      p_provider_message_id: providerId,
    })
  },
  async complete(job, providerId) {
    await rpc("complete_quote_followup_job", {
      ...jobArguments(job),
      p_provider_message_id: providerId,
    })
  },
  async fail(job, code, ambiguous) {
    await rpc("fail_quote_followup_job", {
      ...jobArguments(job),
      p_error_code: code,
      p_ambiguous: ambiguous,
    })
  },
}
Deno.serve(
  createQuoteFollowupHandler(backend, {
    schedulerSecret: Deno.env.get("QUOTE_FOLLOWUP_SCHEDULER_SECRET"),
    emailEnabled: Deno.env.get("QUOTE_FOLLOWUP_EMAIL_ENABLED") === "true",
    resendApiKey: Deno.env.get("RESEND_API_KEY"),
    resendFrom: Deno.env.get("RESEND_FROM"),
    publicUrl: Deno.env.get("CADOVA_PUBLIC_URL"),
    replyEmailEnabled: Deno.env.get("QUOTE_REPLY_EMAIL_ENABLED") === "true",
    receiveDomain: Deno.env.get("RESEND_RECEIVE_DOMAIN"),
  }),
)
