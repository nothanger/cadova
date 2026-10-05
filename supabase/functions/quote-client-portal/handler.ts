import {
  bearerToken,
  isEmail,
  maxPdfBytes,
  readLimitedBytes,
  validFilename,
  validPdf,
  validStoragePath,
} from "../send-quote-document/validation.ts"
import {
  createPortalToken,
  hashNetworkIdentifier,
  hashPortalToken,
  portalTokenPattern,
  portalUuidPattern,
  validMessage,
} from "./validation.ts"

export type PortalMemberAction = "inspect" | "create" | "revoke" | "member_reply"
export type PortalResponseKind = "question" | "accepted" | "refused"
export interface PortalMemberInput {
  quoteId: string
  tokenHash?: string
  expiresAt?: string
  message?: string
  nonce?: string
}
export interface PortalPublicInput {
  action: "view" | "respond" | "download"
  kind?: PortalResponseKind
  message?: string
  nonce?: string
  confirmed?: boolean
}
export interface PortalBackend {
  verifyToken(token: string): Promise<{ id: string } | null>
  member(
    token: string,
    action: PortalMemberAction,
    input: PortalMemberInput,
  ): Promise<unknown>
  consumeRate(key: string, limit: number, seconds: number): Promise<boolean>
  access(tokenHash: string, input: PortalPublicInput): Promise<unknown>
  download(path: string): Promise<{ bytes: Uint8Array; mimeType: string }>
}
export class PortalRequestError extends Error {
  constructor(
    readonly code:
      | "invalid_request"
      | "not_allowed"
      | "rate_limited"
      | "decision_not_allowed"
      | "nonce_conflict",
    readonly status: 400 | 403 | 409 | 429,
  ) {
    super(code)
  }
}
export interface PortalConfig {
  rateSecret: string
  allowedOrigins?: string[]
}
interface Dependencies {
  now?: () => number
  randomToken?: () => string
  timeoutMs?: number
}
interface PortalLink {
  id: string
  expires_at: string
  revoked_at: string | null
  created_at: string
}
interface PortalMessage {
  id: string
  author: "client" | "company"
  kind: PortalResponseKind | "message"
  content: string
  created_at: string
}
const defaults = [
  "https://cadova.fr",
  "https://www.cadova.fr",
  ...["localhost", "127.0.0.1"].flatMap((host) =>
    [5173, 4173, 8443, 8446, 8461].map((port) => `http://${host}:${port}`),
  ),
]
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
const instant = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value))
const boundedString = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length <= max && value.length > 0
function linkProjection(value: unknown): PortalLink | null {
  if (value === null) return null
  if (
    !record(value) ||
    !portalUuidPattern.test(String(value.id)) ||
    !instant(value.expires_at) ||
    !instant(value.created_at) ||
    (value.revoked_at !== null && !instant(value.revoked_at))
  )
    throw new Error("Invalid portal metadata")
  return {
    id: String(value.id),
    expires_at: value.expires_at,
    revoked_at: value.revoked_at as string | null,
    created_at: value.created_at,
  }
}
function messageProjection(value: unknown): PortalMessage[] {
  if (!Array.isArray(value) || value.length > 100)
    throw new Error("Invalid portal conversation")
  return value.map((item: unknown) => {
    if (
      !record(item) ||
      !portalUuidPattern.test(String(item.id)) ||
      !["client", "company"].includes(String(item.author)) ||
      !["question", "accepted", "refused", "message"].includes(String(item.kind)) ||
      !boundedString(item.content, 2000) ||
      !instant(item.created_at)
    )
      throw new Error("Invalid portal conversation")
    return {
      id: String(item.id),
      author: item.author as PortalMessage["author"],
      kind: item.kind as PortalMessage["kind"],
      content: item.content,
      created_at: item.created_at,
    }
  })
}
function memberProjection(value: unknown) {
  if (!record(value)) throw new Error("Invalid member portal response")
  return {
    link: linkProjection(value.link),
    messages: messageProjection(value.messages),
  }
}
function publicProjection(value: unknown) {
  if (!record(value) || !record(value.quote))
    throw new Error("Invalid public portal response")
  const quote = value.quote
  if (
    !boundedString(quote.reference, 200) ||
    !boundedString(quote.company_name, 300) ||
    !boundedString(quote.client_name, 300) ||
    !Number.isSafeInteger(quote.amount_cents) ||
    Number(quote.amount_cents) < 0 ||
    !["sent", "accepted", "refused"].includes(String(quote.status)) ||
    (quote.expires_at !== null && !instant(quote.expires_at)) ||
    typeof quote.document_available !== "boolean" ||
    !instant(value.link_expires_at) ||
    typeof value.can_respond !== "boolean"
  )
    throw new Error("Invalid public quote")
  return {
    quote: {
      reference: quote.reference,
      company_name: quote.company_name,
      company_email: isEmail(quote.company_email) ? quote.company_email : null,
      client_name: quote.client_name,
      amount_cents: Number(quote.amount_cents),
      status: String(quote.status),
      expires_at: quote.expires_at as string | null,
      document_available: quote.document_available,
    },
    link_expires_at: value.link_expires_at,
    can_respond: value.can_respond,
    messages: messageProjection(value.messages),
  }
}

export function createQuoteClientPortalHandler(
  backend: PortalBackend,
  config: PortalConfig,
  dependencies: Dependencies = {},
) {
  const origins = new Set(config.allowedOrigins ?? defaults)
  const now = dependencies.now ?? Date.now
  const randomToken = dependencies.randomToken ?? createPortalToken
  const localBuckets = new Map<string, { at: number; count: number }>()
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("Origin")
    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; sandbox",
      Vary: "Origin",
    }
    if (origin !== null && origins.has(origin)) {
      headers["Access-Control-Allow-Origin"] = origin
      headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
      headers["Access-Control-Allow-Headers"] =
        "authorization, apikey, content-type, x-client-info"
      headers["Access-Control-Expose-Headers"] = "Content-Disposition, Retry-After"
    }
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...headers, ...(status === 429 ? { "Retry-After": "60" } : {}) },
      })
    const failure = (code: string, status: number) => json({ errorCode: code }, status)
    if (origin !== null && !origins.has(origin))
      return failure("origin_not_allowed", 403)
    if (request.method === "OPTIONS")
      return origin !== null
        ? new Response(null, { status: 204, headers })
        : failure("origin_not_allowed", 403)
    if (request.method !== "POST") return failure("method_not_allowed", 405)
    let body: Record<string, unknown>
    const controller = new AbortController()
    const timer = setTimeout(
      () => controller.abort(),
      Math.min(5000, Math.max(1, dependencies.timeoutMs ?? 5000)),
    )
    try {
      const bytes = await readLimitedBytes(request.body, 8192, controller.signal)
      const parsed: unknown = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      )
      if (!record(parsed)) return failure("invalid_request", 400)
      body = parsed
    } catch {
      return failure("invalid_request", 400)
    } finally {
      clearTimeout(timer)
    }
    const memberAction = ["inspect", "create", "revoke", "member_reply"].includes(
      String(body.action),
    )
    if (memberAction) {
      const action = body.action as PortalMemberAction
      const keys =
        action === "create"
          ? ["action", "quoteId", "expiresInDays"]
          : action === "member_reply"
            ? ["action", "quoteId", "message", "nonce"]
            : ["action", "quoteId"]
      if (
        Object.keys(body).some((key) => !keys.includes(key)) ||
        typeof body.quoteId !== "string" ||
        !portalUuidPattern.test(body.quoteId) ||
        (action === "create" &&
          body.expiresInDays !== undefined &&
          (!Number.isInteger(body.expiresInDays) ||
            Number(body.expiresInDays) < 1 ||
            Number(body.expiresInDays) > 90)) ||
        (action === "member_reply" &&
          (!validMessage(body.message) ||
            typeof body.nonce !== "string" ||
            !portalUuidPattern.test(body.nonce)))
      )
        return failure("invalid_request", 400)
      const jwt = bearerToken(request)
      if (!jwt) return failure("unauthorized", 401)
      try {
        const actor = await backend.verifyToken(jwt)
        if (!actor || !portalUuidPattern.test(actor.id))
          return failure("unauthorized", 401)
        const input: PortalMemberInput = { quoteId: body.quoteId }
        let token: string | undefined
        if (action === "create") {
          token = randomToken()
          if (!portalTokenPattern.test(token)) return failure("portal_unavailable", 503)
          input.tokenHash = await hashPortalToken(token)
          input.expiresAt = new Date(
            now() + (Number(body.expiresInDays) || 30) * 86400000,
          ).toISOString()
        }
        if (action === "member_reply") {
          input.message = (body.message as string).trim()
          input.nonce = body.nonce as string
        }
        const result = await backend.member(jwt, action, input)
        if (action === "revoke") return json({ revoked: true })
        if (action === "create") {
          const link = linkProjection(result)
          if (!link) return failure("portal_unavailable", 503)
          return json({ link, token })
        }
        return json(memberProjection(result))
      } catch (error) {
        return error instanceof PortalRequestError
          ? failure(error.code, error.status)
          : failure("portal_unavailable", 503)
      }
    }
    if (!["view", "respond", "download"].includes(String(body.action)))
      return failure("invalid_request", 400)
    const allowed =
      body.action === "respond"
        ? ["action", "token", "kind", "message", "nonce", "confirmed"]
        : ["action", "token"]
    const token = body.token ?? bearerToken(request)
    if (
      Object.keys(body).some((key) => !allowed.includes(key)) ||
      typeof token !== "string" ||
      !portalTokenPattern.test(token)
    )
      return failure("link_unavailable", 410)
    if (
      body.action === "respond" &&
      (!["question", "accepted", "refused"].includes(String(body.kind)) ||
        body.confirmed !== true ||
        typeof body.nonce !== "string" ||
        !portalUuidPattern.test(body.nonce) ||
        (body.kind === "question" && !validMessage(body.message)) ||
        (body.message !== undefined && !validMessage(body.message)))
    )
      return failure("invalid_request", 400)
    if (!config.rateSecret || config.rateSecret.length < 24)
      return failure("portal_unavailable", 503)
    try {
      // The gateway supplies the forwarding header. Never retain or log it.
      const network = (
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for") ??
        "unknown"
      ).slice(0, 200)
      const networkHash = await hashNetworkIdentifier(network, config.rateSecret)
      const local = localBuckets.get(networkHash)
      const stamp = now()
      if (!local && localBuckets.size >= 2000) {
        for (const [key, bucket] of localBuckets)
          if (stamp - bucket.at >= 60000) localBuckets.delete(key)
        if (localBuckets.size >= 2000) return failure("rate_limited", 429)
      }
      if (!local || stamp - local.at >= 60000)
        localBuckets.set(networkHash, { at: stamp, count: 1 })
      else if (++local.count > 120) return failure("rate_limited", 429)
      if (
        !(await backend.consumeRate("portal:global", 2000, 60)) ||
        !(await backend.consumeRate(`network:${networkHash}`, 120, 60))
      )
        return failure("rate_limited", 429)
      const input: PortalPublicInput = {
        action: body.action as PortalPublicInput["action"],
      }
      if (input.action === "respond") {
        input.kind = body.kind as PortalResponseKind
        input.message =
          typeof body.message === "string" ? body.message.trim() : undefined
        input.nonce = body.nonce as string
        input.confirmed = true
      }
      const result = await backend.access(await hashPortalToken(token), input)
      if (record(result) && typeof result.errorCode === "string") {
        const status = {
          invalid_request: 400,
          link_unavailable: 410,
          rate_limited: 429,
          decision_not_allowed: 409,
          nonce_conflict: 409,
          document_unavailable: 404,
        }[result.errorCode]
        return status
          ? failure(result.errorCode, status)
          : failure("portal_unavailable", 503)
      }
      if (input.action !== "download") return json(publicProjection(result))
      if (
        !record(result) ||
        !validStoragePath(result.storage_path) ||
        !validFilename(result.file_name) ||
        !Number.isInteger(result.size_bytes) ||
        Number(result.size_bytes) < 5 ||
        Number(result.size_bytes) > maxPdfBytes
      )
        return failure("document_unavailable", 404)
      const document = await backend.download(result.storage_path)
      if (
        !validPdf(document.bytes, document.mimeType) ||
        document.bytes.length !== Number(result.size_bytes)
      )
        return failure("document_unavailable", 404)
      const filename = encodeURIComponent(result.file_name).replace(
        /['()*]/g,
        (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
      )
      return new Response(document.bytes as BodyInit, {
        status: 200,
        headers: {
          ...headers,
          "Content-Type": "application/pdf",
          "Content-Length": String(document.bytes.length),
          "Content-Disposition": `attachment; filename="devis.pdf"; filename*=UTF-8''${filename}`,
        },
      })
    } catch {
      return failure("portal_unavailable", 503)
    }
  }
}
