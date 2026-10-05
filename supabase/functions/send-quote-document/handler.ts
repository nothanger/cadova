import {
  bearerToken,
  encodeBase64,
  escapeHtml,
  idempotencyWindowMs,
  isEmail,
  isSender,
  maxPdfBytes,
  readLimitedBytes,
  sha256,
  uuidPattern,
  validBase64Pdf,
  validFilename,
  validPdf,
  validStoragePath,
  verifyCleanupProof,
} from "./validation.ts"

export interface DocumentSendInput {
  quoteId: string
  recipientEmail: string
  subject: string
  message: string
  retry: boolean
}
export interface DocumentJob {
  id: string
  quote_id?: string
  status: string
  attempts?: number
  first_attempt_at?: string | null
  provider_message_id?: string | null
  sent_at?: string | null
  last_error_code?: string | null
  created_at?: string
  recipient_email?: string
  subject?: string
  body?: string
}
export interface DocumentProviderPayload {
  from: string
  to: string
  reply_to: string
  subject: string
  text: string
  html: string
  attachments: { filename: string; content_type: "application/pdf"; content: string }[]
}
export interface DocumentClaim extends DocumentJob {
  allowed: boolean
  reason?: string
  lease_token?: string
  recipient_email?: string
  reply_to?: string
  subject?: string
  body?: string
  company_name?: string
  document_path?: string
  file_name?: string
  size_bytes?: number
  mime_type?: string
  attachment_sha256?: string | null
  provider_payload?: DocumentProviderPayload | null
}
export interface CleanupClaim {
  id: string
  storage_path: string
  lease_token: string
}
export interface DocumentSendBackend {
  verifyToken(token: string): Promise<{ id: string } | null>
  requestSend(token: string, input: DocumentSendInput): Promise<DocumentJob>
  claim(jobId: string, actorId: string, leaseSeconds: number): Promise<DocumentClaim>
  download(path: string): Promise<{ bytes: Uint8Array; mimeType: string }>
  persist(
    claim: DocumentClaim,
    payload: DocumentProviderPayload,
    hash: string,
  ): Promise<{ payload: DocumentProviderPayload; first_attempt_at: string }>
  recordAcceptance(claim: DocumentClaim, providerId: string): Promise<void>
  complete(claim: DocumentClaim, providerId: string): Promise<void>
  fail(claim: DocumentClaim, code: string, ambiguous: boolean): Promise<void>
  consumeCleanupNonce(nonce: string, issuedAt: number): Promise<boolean>
  claimCleanup(batchSize: number, leaseSeconds: number): Promise<CleanupClaim[]>
  removeDocument(path: string): Promise<void>
  completeCleanup(claim: CleanupClaim): Promise<void>
  failCleanup(claim: CleanupClaim): Promise<void>
}
export interface DocumentSendConfig {
  schedulerSecret?: string
  resendApiKey?: string
  resendFrom?: string
  emailEnabled: boolean
  allowedOrigins?: string[]
}
interface Dependencies {
  fetch?: typeof globalThis.fetch
  now?: () => number
  timeoutMs?: number
}

export type DocumentRequestErrorCode =
  | "send_not_allowed"
  | "invalid_request"
  | "already_sent"
  | "send_in_progress"
  | "document_missing"
  | "reply_address_missing"
  | "delivery_unknown"
  | "send_unavailable"
export class DocumentSendRequestError extends Error {
  constructor(
    readonly code: DocumentRequestErrorCode,
    readonly status: 400 | 403 | 409 | 503,
  ) {
    super(code)
    this.name = "DocumentSendRequestError"
  }
}

const defaultOrigins = [
  "https://cadova.fr",
  "https://www.cadova.fr",
  ...["localhost", "127.0.0.1"].flatMap((host) =>
    [5173, 4173, 8443, 8446].map((port) => `http://${host}:${port}`),
  ),
]
const statuses = new Set([
  "preparing",
  "queued",
  "processing",
  "sent",
  "failed",
  "cancelled",
  "delivery_unknown",
])
function safeJob(job: DocumentJob): DocumentJob {
  return {
    id: job.id,
    ...(job.quote_id ? { quote_id: job.quote_id } : {}),
    status: job.status,
    ...(Number.isInteger(job.attempts) ? { attempts: job.attempts } : {}),
    first_attempt_at: job.first_attempt_at ?? null,
    provider_message_id: job.provider_message_id ?? null,
    sent_at: job.sent_at ?? null,
    last_error_code: job.last_error_code ?? null,
    ...(typeof job.created_at === "string" ? { created_at: job.created_at } : {}),
    ...(typeof job.recipient_email === "string"
      ? { recipient_email: job.recipient_email }
      : {}),
    ...(typeof job.subject === "string" ? { subject: job.subject } : {}),
    ...(typeof job.body === "string" ? { body: job.body } : {}),
  }
}
function stateFor(job: DocumentJob) {
  return job.status === "sent"
    ? "sent"
    : job.status === "delivery_unknown"
      ? "delivery_unknown"
      : ["failed", "cancelled"].includes(job.status)
        ? "failed"
        : "processing"
}
function validJob(job: DocumentJob) {
  return job && uuidPattern.test(job.id) && statuses.has(job.status)
}
function providerId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,200}$/.test(value)
}
function validPayload(payload: DocumentProviderPayload) {
  return (
    payload &&
    Object.keys(payload).length === 7 &&
    isSender(payload.from) &&
    isEmail(payload.to) &&
    isEmail(payload.reply_to) &&
    typeof payload.subject === "string" &&
    payload.subject.trim().length > 0 &&
    payload.subject.length <= 160 &&
    !/[\x00-\x1f\x7f]/.test(payload.subject) &&
    typeof payload.text === "string" &&
    payload.text.trim().length > 0 &&
    payload.text.length <= 4000 &&
    !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(payload.text) &&
    typeof payload.html === "string" &&
    payload.html.length <= 30000 &&
    payload.html.length > 0 &&
    Array.isArray(payload.attachments) &&
    payload.attachments.length === 1 &&
    payload.attachments[0] !== null &&
    typeof payload.attachments[0] === "object" &&
    !Array.isArray(payload.attachments[0]) &&
    Object.keys(payload.attachments[0]).length === 3 &&
    payload.attachments[0].content_type === "application/pdf" &&
    validFilename(payload.attachments[0].filename) &&
    validBase64Pdf(payload.attachments[0].content)
  )
}

/** Only bounded classifications survive: provider messages may contain addresses. */
export function classifyDocumentProviderError(status: number, data: unknown) {
  const value =
    data && typeof data === "object"
      ? (data as { name?: unknown; message?: unknown })
      : null
  const name = typeof value?.name === "string" ? value.name : ""
  const message =
    typeof value?.message === "string" ? value.message.slice(0, 2000).toLowerCase() : ""
  if (status >= 500) return { code: "provider_server_error", ambiguous: true }
  if (status === 409)
    return {
      code:
        name === "invalid_idempotent_request"
          ? "provider_payload_mismatch"
          : "provider_concurrent_request",
      ambiguous: true,
    }
  if (status === 429)
    return {
      code:
        name === "rate_limit_exceeded"
          ? "provider_rate_limited"
          : "provider_quota_exceeded",
      ambiguous: false,
    }
  if (status === 403 && name === "validation_error") {
    if (
      /domain[^\n]{0,300}(?:not verified|isn't verified)|domain not verified/.test(
        message,
      )
    )
      return { code: "provider_domain_not_verified", ambiguous: false }
    if (/only send testing emails|resend\.dev|from[^\n]{0,100}domain/.test(message))
      return { code: "provider_sender_not_allowed", ambiguous: false }
  }
  if (name === "restricted_api_key" || name === "invalid_permission")
    return { code: "provider_restricted_key", ambiguous: false }
  if (name === "suspended_api_key")
    return { code: "provider_suspended_key", ambiguous: false }
  if (name === "invalid_api_key" || name === "missing_api_key")
    return { code: "provider_authentication_failed", ambiguous: false }
  if (status === 401)
    return { code: "provider_authentication_failed", ambiguous: false }
  if (status === 403) return { code: "provider_permission_denied", ambiguous: false }
  return { code: "provider_rejected", ambiguous: false }
}

export function createQuoteDocumentHandler(
  backend: DocumentSendBackend,
  config: DocumentSendConfig,
  dependencies: Dependencies = {},
) {
  const fetcher = dependencies.fetch ?? globalThis.fetch
  const now = dependencies.now ?? Date.now
  const timeoutMs = Math.max(1, Math.min(dependencies.timeoutMs ?? 15000, 15000))
  const origins = new Set(config.allowedOrigins ?? defaultOrigins)
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("Origin")
    const allowedOrigin = origin !== null && origins.has(origin)
    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      Vary: "Origin",
    }
    if (allowedOrigin) {
      headers["Access-Control-Allow-Origin"] = origin
      headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
      headers["Access-Control-Allow-Headers"] =
        "authorization, apikey, content-type, x-client-info"
    }
    const json = (value: unknown, status = 200) => {
      const data =
        value && typeof value === "object" && "errorCode" in value
          ? { ...value, error: (value as { errorCode: unknown }).errorCode }
          : value
      return new Response(JSON.stringify(data), { status, headers })
    }
    if (origin !== null && !allowedOrigin)
      return json({ errorCode: "origin_not_allowed" }, 403)
    if (request.method === "OPTIONS")
      return allowedOrigin
        ? new Response(null, { status: 204, headers })
        : json({ errorCode: "origin_not_allowed" }, 403)
    if (request.method !== "POST") return json({ errorCode: "method_not_allowed" }, 405)
    let body: Record<string, unknown>
    const inputController = new AbortController()
    const inputTimer = setTimeout(() => inputController.abort(), timeoutMs)
    try {
      const bytes = await readLimitedBytes(request.body, 16384, inputController.signal)
      const parsed: unknown = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      )
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        return json({ errorCode: "invalid_request" }, 400)
      body = parsed as Record<string, unknown>
    } catch {
      return json({ errorCode: "invalid_request" }, 400)
    } finally {
      clearTimeout(inputTimer)
    }
    if (body.action === "cleanup") {
      if (Object.keys(body).length !== 1)
        return json({ errorCode: "invalid_request" }, 400)
      const proof = await verifyCleanupProof(request, config.schedulerSecret, now())
      if (!proof) return json({ errorCode: "unauthorized" }, 401)
      try {
        if (!(await backend.consumeCleanupNonce(proof.nonce, proof.issuedAt)))
          return json({ errorCode: "cleanup_proof_already_used" }, 409)
      } catch {
        return json({ errorCode: "cleanup_unavailable" }, 503)
      }
      let claims: CleanupClaim[]
      try {
        claims = await backend.claimCleanup(20, 300)
      } catch {
        return json({ errorCode: "cleanup_unavailable" }, 503)
      }
      if (
        !Array.isArray(claims) ||
        claims.length > 20 ||
        claims.some(
          (claim) =>
            !uuidPattern.test(claim.id) ||
            !uuidPattern.test(claim.lease_token) ||
            !validStoragePath(claim.storage_path),
        )
      )
        return json({ errorCode: "cleanup_unavailable" }, 503)
      let removed = 0
      let pending = 0
      for (const claim of claims) {
        try {
          await backend.removeDocument(claim.storage_path)
          await backend.completeCleanup(claim)
          removed++
        } catch {
          pending++
          await backend.failCleanup(claim).catch(() => {})
        }
      }
      return json({ removed, pending })
    }
    if (
      body.action !== "send" ||
      Object.keys(body).some(
        (key) =>
          ![
            "action",
            "quoteId",
            "recipientEmail",
            "subject",
            "message",
            "retry",
          ].includes(key),
      ) ||
      typeof body.quoteId !== "string" ||
      !uuidPattern.test(body.quoteId) ||
      !isEmail(body.recipientEmail) ||
      typeof body.subject !== "string" ||
      !body.subject.trim() ||
      body.subject.length > 160 ||
      /[\x00-\x1f\x7f]/.test(body.subject) ||
      typeof body.message !== "string" ||
      !body.message.trim() ||
      body.message.length > 4000 ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(body.message) ||
      (body.retry !== undefined && typeof body.retry !== "boolean")
    )
      return json({ errorCode: "invalid_request" }, 400)
    const token = bearerToken(request)
    if (!token) return json({ errorCode: "unauthorized" }, 401)
    let actor: { id: string } | null
    try {
      actor = await backend.verifyToken(token)
    } catch {
      return json({ errorCode: "authentication_unavailable" }, 503)
    }
    if (!actor || !uuidPattern.test(actor.id))
      return json({ errorCode: "unauthorized" }, 401)
    if (
      !config.emailEnabled ||
      !config.resendApiKey ||
      config.resendApiKey.length < 8 ||
      /\s/.test(config.resendApiKey) ||
      !isSender(config.resendFrom)
    )
      return json({ errorCode: "email_configuration_missing" }, 503)
    let job: DocumentJob
    try {
      job = await backend.requestSend(token, {
        quoteId: body.quoteId,
        recipientEmail: body.recipientEmail,
        subject: body.subject,
        message: body.message,
        retry: body.retry === true,
      })
    } catch (error) {
      return error instanceof DocumentSendRequestError
        ? json({ errorCode: error.code }, error.status)
        : json({ errorCode: "send_not_allowed" }, 403)
    }
    if (!validJob(job)) return json({ errorCode: "send_unavailable" }, 503)
    if (
      ["sent", "cancelled"].includes(job.status) ||
      (["failed", "delivery_unknown"].includes(job.status) && body.retry !== true)
    )
      return json({
        state: stateFor(job),
        job: safeJob(job),
        ...(job.last_error_code ? { errorCode: job.last_error_code } : {}),
      })
    let claim: DocumentClaim
    try {
      claim = await backend.claim(job.id, actor.id, 300)
    } catch {
      return json(
        { state: "processing", job: safeJob(job), errorCode: "send_unavailable" },
        503,
      )
    }
    if (!validJob(claim) || claim.id !== job.id || typeof claim.allowed !== "boolean")
      return json(
        { state: "processing", job: safeJob(job), errorCode: "send_unavailable" },
        503,
      )
    if (!claim.allowed)
      return json({
        state: stateFor(claim),
        job: safeJob(claim),
        ...(claim.reason ? { errorCode: claim.reason } : {}),
      })
    if (
      !claim.lease_token ||
      !uuidPattern.test(claim.lease_token) ||
      !Number.isInteger(claim.attempts) ||
      claim.attempts! < 1 ||
      claim.attempts! > 5
    )
      return json(
        { state: "processing", job: safeJob(job), errorCode: "send_unavailable" },
        503,
      )
    const failure = async (code: string, ambiguous: boolean) => {
      let recorded = true
      try {
        await backend.fail(claim, code, ambiguous)
      } catch {
        recorded = false
      }
      return json({
        state: ambiguous ? "delivery_unknown" : recorded ? "failed" : "processing",
        job: safeJob({
          ...claim,
          status: ambiguous ? "delivery_unknown" : recorded ? "failed" : "processing",
          last_error_code: code,
        }),
        errorCode: code,
      })
    }
    const finish = async (id: string, known = false) => {
      try {
        if (!known) await backend.recordAcceptance(claim, id)
        claim.provider_message_id = id
        await backend.complete(claim, id)
        return json({
          state: "sent",
          job: safeJob({
            ...claim,
            status: "sent",
            provider_message_id: id,
            sent_at: new Date(now()).toISOString(),
            last_error_code: null,
          }),
        })
      } catch {
        return failure("provider_completion_failed", true)
      }
    }
    if (providerId(claim.provider_message_id))
      return finish(claim.provider_message_id, true)
    if (claim.first_attempt_at) {
      const first = Date.parse(claim.first_attempt_at)
      if (
        !Number.isFinite(first) ||
        first > now() ||
        now() - first >= idempotencyWindowMs
      )
        return failure("idempotency_window_expired", true)
    }
    let payload = claim.provider_payload
    let firstAttempt = claim.first_attempt_at
    if (!payload) {
      if (
        !isEmail(claim.recipient_email) ||
        !isEmail(claim.reply_to) ||
        !claim.subject ||
        !claim.body ||
        !claim.company_name ||
        !validFilename(claim.file_name) ||
        !validStoragePath(claim.document_path) ||
        !Number.isInteger(claim.size_bytes) ||
        claim.size_bytes! < 5 ||
        claim.size_bytes! > maxPdfBytes ||
        claim.mime_type !== "application/pdf"
      )
        return failure("invalid_document", false)
      let document: { bytes: Uint8Array; mimeType: string }
      try {
        document = await backend.download(claim.document_path)
      } catch {
        return failure("document_unavailable", false)
      }
      if (
        !validPdf(document.bytes, document.mimeType) ||
        document.bytes.length !== claim.size_bytes
      )
        return failure("invalid_document", false)
      const hash = await sha256(document.bytes)
      const html = `<!doctype html><html lang="fr"><body><p>${escapeHtml(claim.company_name)}</p><div>${escapeHtml(claim.body).replace(/\r\n?/g, "\n").replace(/\n/g, "<br>")}</div></body></html>`
      const candidate: DocumentProviderPayload = {
        from: config.resendFrom,
        to: claim.recipient_email,
        reply_to: claim.reply_to,
        subject: claim.subject,
        text: claim.body,
        html,
        attachments: [
          {
            filename: claim.file_name,
            content_type: "application/pdf",
            content: encodeBase64(document.bytes),
          },
        ],
      }
      if (!validPayload(candidate)) return failure("invalid_document", false)
      try {
        const saved = await backend.persist(claim, candidate, hash)
        payload = saved.payload
        firstAttempt = saved.first_attempt_at
        claim.first_attempt_at = firstAttempt
      } catch {
        return failure("send_snapshot_changed", false)
      }
    }
    if (
      !validPayload(payload) ||
      payload.to !== claim.recipient_email ||
      payload.reply_to !== claim.reply_to ||
      payload.subject !== claim.subject ||
      payload.text !== claim.body ||
      payload.attachments[0].filename !== claim.file_name
    )
      return failure("invalid_document", Boolean(firstAttempt))
    const first = firstAttempt ? Date.parse(firstAttempt) : Number.NaN
    if (
      !Number.isFinite(first) ||
      first > now() ||
      now() - first >= idempotencyWindowMs
    )
      return failure("idempotency_window_expired", true)
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new Error("Provider timeout"))
      }, timeoutMs)
    })
    let response: Response
    let providerData: unknown = null
    try {
      response = await Promise.race([
        fetcher("https://api.resend.com/emails", {
          method: "POST",
          redirect: "error",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${config.resendApiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `cadova-quote-initial-${claim.id}`,
          },
          body: JSON.stringify(payload),
        }),
        deadline,
      ])
      try {
        providerData = JSON.parse(
          new TextDecoder().decode(
            await Promise.race([
              readLimitedBytes(response.body, 8192, controller.signal),
              deadline,
            ]),
          ),
        )
      } catch {
        if (controller.signal.aborted) throw new Error("Provider timeout")
      }
    } catch {
      return failure(
        controller.signal.aborted ? "provider_timeout" : "provider_network_error",
        true,
      )
    } finally {
      clearTimeout(timer!)
    }
    if (response.ok) {
      const id =
        providerData && typeof providerData === "object"
          ? (providerData as { id?: unknown }).id
          : null
      return providerId(id) ? finish(id) : failure("provider_invalid_success", true)
    }
    const error = classifyDocumentProviderError(response.status, providerData)
    return failure(error.code, error.ambiguous)
  }
}
