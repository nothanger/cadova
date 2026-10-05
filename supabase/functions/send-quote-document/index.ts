import { createClient } from "npm:@supabase/supabase-js@2.112.4"
import {
  createQuoteDocumentHandler,
  DocumentSendRequestError,
  type CleanupClaim,
  type DocumentClaim,
  type DocumentJob,
  type DocumentProviderPayload,
  type DocumentSendBackend,
} from "./handler.ts"
import { maxPdfBytes, readLimitedBytes, validStoragePath } from "./validation.ts"
import { prepareQuoteEmailLinks } from "../_shared/quote-email-links.ts"

const url = Deno.env.get("SUPABASE_URL")
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
if (!url || !serviceKey || !anonKey)
  throw new Error("Document sending backend configuration is missing")
const authOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
}
const db = createClient(url, serviceKey, { auth: authOptions })

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args)
  if (error) throw new Error("Document sending backend operation failed")
  return data as T
}
function leaseArguments(claim: DocumentClaim) {
  return { p_job_id: claim.id, p_lease_token: claim.lease_token }
}
function cleanupArguments(claim: CleanupClaim) {
  return { p_id: claim.id, p_lease_token: claim.lease_token }
}

const backend: DocumentSendBackend = {
  async verifyToken(token) {
    const { data, error } = await db.auth.getUser(token)
    if (error && (!error.status || error.status >= 500))
      throw new Error("Authentication unavailable")
    return error ? null : data.user ? { id: data.user.id } : null
  },
  async requestSend(token, input) {
    // The caller's real JWT remains on the user RPC: service_role is never used
    // to authorize a quote, select its recipient, or create a send request.
    const caller = createClient(url, anonKey, {
      auth: authOptions,
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data, error } = await caller.rpc("request_quote_initial_send", {
      p_quote_id: input.quoteId,
      p_recipient: input.recipientEmail,
      p_subject: input.subject,
      p_body: input.message,
      p_retry_failed: input.retry,
    })
    if (error) {
      // Match only fixed server messages; details and arbitrary SQL text stay private.
      if (error.code === "42501")
        throw new DocumentSendRequestError("send_not_allowed", 403)
      if (error.code === "22023")
        throw new DocumentSendRequestError("invalid_request", 400)
      if (error.code === "23514") {
        const expected = new Map([
          ["Ce devis a déjà été envoyé.", "already_sent"],
          ["Un autre envoi de ce devis est déjà en cours.", "send_in_progress"],
          ["Cet envoi reste à vérifier.", "delivery_unknown"],
          ["Ajoutez le PDF du devis avant de l’envoyer.", "document_missing"],
          [
            "Ajoutez une adresse de réponse dans les paramètres de l’entreprise.",
            "reply_address_missing",
          ],
        ] as const)
        const code = expected.get(error.message as Parameters<typeof expected.get>[0])
        if (code) throw new DocumentSendRequestError(code, 409)
      }
      throw new DocumentSendRequestError("send_unavailable", 503)
    }
    return data as DocumentJob
  },
  claim: (id, actorId, seconds) =>
    rpc<DocumentClaim>("claim_quote_initial_send", {
      p_job_id: id,
      p_actor_id: actorId,
      p_lease_seconds: seconds,
    }),
  prepareLinks: (claim, publicUrl, replyDomain) =>
    prepareQuoteEmailLinks(rpc, serviceKey, "initial", claim, publicUrl, replyDomain),
  async download(path) {
    if (!validStoragePath(path)) throw new Error("Invalid document path")
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new Error("Document request timed out"))
      }, 15000)
    })
    try {
      const endpoint = `${url}/storage/v1/object/quote-documents/${path.split("/").map(encodeURIComponent).join("/")}`
      const response = await Promise.race([
        fetch(endpoint, {
          redirect: "error",
          signal: controller.signal,
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
        }),
        deadline,
      ])
      const length = Number(response.headers.get("Content-Length"))
      if (!response.ok || (Number.isFinite(length) && length > maxPdfBytes)) {
        await response.body?.cancel().catch(() => {})
        throw new Error("Document is unavailable")
      }
      return {
        bytes: await Promise.race([
          readLimitedBytes(response.body, maxPdfBytes, controller.signal),
          deadline,
        ]),
        mimeType: response.headers.get("Content-Type") ?? "",
      }
    } finally {
      clearTimeout(timer!)
    }
  },
  persist: (claim, payload, hash) =>
    rpc<{ payload: DocumentProviderPayload; first_attempt_at: string }>(
      "persist_quote_initial_payload",
      { ...leaseArguments(claim), p_payload: payload, p_attachment_sha256: hash },
    ),
  async recordAcceptance(claim, id) {
    await rpc("record_quote_initial_acceptance", {
      ...leaseArguments(claim),
      p_provider_message_id: id,
    })
  },
  async complete(claim, id) {
    await rpc("complete_quote_initial_send", {
      ...leaseArguments(claim),
      p_provider_message_id: id,
    })
  },
  async fail(claim, code, ambiguous) {
    await rpc("fail_quote_initial_send", {
      ...leaseArguments(claim),
      p_error_code: code,
      p_ambiguous: ambiguous,
    })
  },
  consumeCleanupNonce: (nonce, issuedAt) =>
    rpc<boolean>("consume_quote_document_cleanup_nonce", {
      p_nonce: nonce,
      p_issued_at: issuedAt,
    }),
  claimCleanup: (size, seconds) =>
    rpc<CleanupClaim[]>("claim_quote_document_cleanup", {
      p_batch_size: size,
      p_lease_seconds: seconds,
    }),
  async removeDocument(path) {
    if (!validStoragePath(path)) throw new Error("Invalid document path")
    const { error } = await db.storage.from("quote-documents").remove([path])
    if (error) throw new Error("Document cleanup operation failed")
  },
  async completeCleanup(claim) {
    await rpc("complete_quote_document_cleanup", cleanupArguments(claim))
  },
  async failCleanup(claim) {
    await rpc("fail_quote_document_cleanup", cleanupArguments(claim))
  },
}

const allowedOrigins = new Set([
  "https://cadova.fr",
  "https://www.cadova.fr",
  ...["localhost", "127.0.0.1"].flatMap((host) =>
    [5173, 4173, 8443, 8446].map((port) => `http://${host}:${port}`),
  ),
])
try {
  const app = new URL(Deno.env.get("APP_URL") ?? "https://www.cadova.fr")
  if (app.protocol === "https:" && !app.username && !app.password)
    allowedOrigins.add(app.origin)
} catch {
  /* A malformed APP_URL does not broaden CORS. */
}

Deno.serve(
  createQuoteDocumentHandler(backend, {
    schedulerSecret: Deno.env.get("QUOTE_FOLLOWUP_SCHEDULER_SECRET"),
    resendApiKey: Deno.env.get("RESEND_API_KEY"),
    resendFrom: Deno.env.get("RESEND_FROM"),
    emailEnabled: Deno.env.get("QUOTE_FOLLOWUP_EMAIL_ENABLED") === "true",
    allowedOrigins: Array.from(allowedOrigins),
    publicUrl: Deno.env.get("CADOVA_PUBLIC_URL"),
    replyEmailEnabled: Deno.env.get("QUOTE_REPLY_EMAIL_ENABLED") === "true",
    receiveDomain: Deno.env.get("RESEND_RECEIVE_DOMAIN"),
  }),
)
