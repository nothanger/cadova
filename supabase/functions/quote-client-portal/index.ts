import { createClient } from "npm:@supabase/supabase-js@2.112.4"
import {
  createQuoteClientPortalHandler,
  PortalRequestError,
  type PortalBackend,
} from "./handler.ts"
import {
  maxPdfBytes,
  readLimitedBytes,
  validStoragePath,
} from "../send-quote-document/validation.ts"

const url = Deno.env.get("SUPABASE_URL")
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
if (!url || !serviceKey || !anonKey)
  throw new Error("Portal backend configuration is missing")
const authOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
}
const db = createClient(url, serviceKey, { auth: authOptions })
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await db.rpc(name, args)
  if (error) throw new Error("Portal backend operation failed")
  return data
}
const backend: PortalBackend = {
  async verifyToken(token) {
    const { data, error } = await db.auth.getUser(token)
    if (error && (!error.status || error.status >= 500))
      throw new Error("Authentication unavailable")
    return error ? null : data.user ? { id: data.user.id } : null
  },
  async member(token, action, input) {
    const caller = createClient(url, anonKey, {
      auth: authOptions,
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const name = {
      inspect: "inspect_quote_client_link",
      create: "create_quote_client_link",
      revoke: "revoke_quote_client_links",
      member_reply: "reply_quote_client_message",
    }[action]
    const args: Record<string, unknown> = { p_quote_id: input.quoteId }
    if (action === "create") {
      args.p_token_hash = input.tokenHash
      args.p_expires_at = input.expiresAt
    }
    if (action === "member_reply") {
      args.p_message = input.message
      args.p_nonce = input.nonce
    }
    const { data, error } = await caller.rpc(name, args)
    if (error) {
      if (error.code === "42501") throw new PortalRequestError("not_allowed", 403)
      if (error.code === "22023") throw new PortalRequestError("invalid_request", 400)
      if (error.code === "54000") throw new PortalRequestError("rate_limited", 429)
      if (error.code === "23505" && error.message === "nonce_conflict")
        throw new PortalRequestError("nonce_conflict", 409)
      if (error.code === "23514" && error.message === "decision_not_allowed")
        throw new PortalRequestError("decision_not_allowed", 409)
      throw new Error("Portal member operation failed")
    }
    return data
  },
  consumeRate: (key, limit, seconds) =>
    rpc("consume_quote_client_rate", {
      p_key: key,
      p_limit: limit,
      p_seconds: seconds,
    }),
  access: (hash, input) =>
    rpc("use_quote_client_link", {
      p_token_hash: hash,
      p_action: input.action,
      p_kind: input.kind ?? null,
      p_message: input.message ?? null,
      p_nonce: input.nonce ?? null,
      p_confirmed: input.confirmed ?? false,
    }),
  async download(path) {
    if (!validStoragePath(path)) throw new Error("Invalid document path")
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch(
        `${url}/storage/v1/object/authenticated/quote-documents/${path}`,
        {
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
          signal: controller.signal,
          redirect: "error",
        },
      )
      const length = response.headers.get("Content-Length")
      if (!response.ok || (length !== null && Number(length) > maxPdfBytes)) {
        void response.body?.cancel()
        throw new Error("Document unavailable")
      }
      return {
        bytes: await readLimitedBytes(response.body, maxPdfBytes, controller.signal),
        mimeType: response.headers.get("Content-Type") ?? "",
      }
    } finally {
      clearTimeout(timer)
    }
  },
}
Deno.serve(createQuoteClientPortalHandler(backend, { rateSecret: serviceKey }))
