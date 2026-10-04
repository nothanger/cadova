import {
  escapeHtml,
  verifySchedulerAuthorization,
  isEmailAddress,
  isEmailSender,
} from "./validation.ts"

export interface ClaimedFollowupJob {
  id: string
  lease_token: string
  attempts: number
  first_attempt_at: string | null
  provider_message_id: string | null
}

export interface PreparedFollowupSend {
  allowed: boolean
  reason?: string
  recipient_email?: string
  reply_to?: string
  sender?: string
  subject?: string
  body?: string
  company_name?: string
  first_attempt_at?: string | null
  provider_message_id?: string | null
}

export type FollowupServiceStatus = "ready" | "disabled" | "email_configuration_missing"

export interface ProviderEmailPayload {
  from: string
  to: string
  reply_to: string
  subject: string
  text: string
  html: string
}

export interface QuoteFollowupBackend {
  consumeSchedulerNonce(nonce: string, issuedAt: number): Promise<boolean>
  setServiceStatus(
    enabled: boolean,
    configured: boolean,
    status: FollowupServiceStatus,
  ): Promise<void>
  claim(batchSize: number, leaseSeconds: number): Promise<ClaimedFollowupJob[]>
  prepare(job: ClaimedFollowupJob, sender: string): Promise<PreparedFollowupSend>
  persistPayload(
    job: ClaimedFollowupJob,
    payload: ProviderEmailPayload,
  ): Promise<{ payload: ProviderEmailPayload; first_attempt_at: string }>
  recordAcceptance(job: ClaimedFollowupJob, providerId: string): Promise<void>
  complete(job: ClaimedFollowupJob, providerId: string): Promise<void>
  fail(job: ClaimedFollowupJob, code: string, ambiguous: boolean): Promise<void>
}

export interface FollowupWorkerConfig {
  schedulerSecret?: string
  emailEnabled: boolean
  resendApiKey?: string
  resendFrom?: string
}

interface WorkerDependencies {
  fetch?: typeof globalThis.fetch
  now?: () => number
  timeoutMs?: number
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const idempotencyWindow = 23 * 60 * 60 * 1000
const maxAttempts = 5
const batchSize = 5
const leaseSeconds = 180

export function followupServiceState(config: FollowupWorkerConfig) {
  const configured = Boolean(
    config.resendApiKey &&
    config.resendApiKey.length >= 8 &&
    !/\s/.test(config.resendApiKey) &&
    isEmailSender(config.resendFrom),
  )
  return {
    enabled: config.emailEnabled && configured,
    configured,
    status: (!configured
      ? "email_configuration_missing"
      : config.emailEnabled
        ? "ready"
        : "disabled") as FollowupServiceStatus,
  }
}

export function buildFollowupEmail(companyName: string, body: string) {
  const htmlText = body.replace(/\r\n?/g, "\n")
  return {
    text: body,
    html: `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;font-family:Arial,sans-serif;color:#0b1020"><main style="max-width:600px;margin:auto"><p style="margin:0 0 24px;font-size:14px;color:#596176">${escapeHtml(companyName)}</p><div style="font-size:16px;line-height:1.6;overflow-wrap:anywhere">${escapeHtml(htmlText).replace(/\n/g, "<br>")}</div></main></body></html>`,
  }
}

function validPreparedEmail(value: PreparedFollowupSend) {
  return (
    isEmailAddress(value.recipient_email) &&
    isEmailAddress(value.reply_to) &&
    isEmailSender(value.sender) &&
    typeof value.subject === "string" &&
    value.subject.trim().length > 0 &&
    value.subject.length <= 300 &&
    !/[\x00-\x1f\x7f]/.test(value.subject) &&
    typeof value.body === "string" &&
    value.body.trim().length > 0 &&
    value.body.length <= 12000 &&
    !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value.body) &&
    typeof value.company_name === "string" &&
    value.company_name.trim().length > 0 &&
    value.company_name.length <= 300
  )
}

function validProviderId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 200 &&
    /^[a-zA-Z0-9_-]+$/.test(value)
  )
}

function validProviderPayload(value: ProviderEmailPayload) {
  return (
    value &&
    isEmailSender(value.from) &&
    isEmailAddress(value.to) &&
    isEmailAddress(value.reply_to) &&
    typeof value.subject === "string" &&
    value.subject.length > 0 &&
    value.subject.length <= 300 &&
    !/[\x00-\x1f\x7f]/.test(value.subject) &&
    typeof value.text === "string" &&
    value.text.length > 0 &&
    value.text.length <= 12000 &&
    typeof value.html === "string" &&
    value.html.length > 0 &&
    value.html.length <= 30000 &&
    Object.keys(value).length === 6
  )
}

function retryWindowOpen(
  firstAttempt: string | null | undefined,
  attempts: number,
  now: number,
) {
  const started = firstAttempt ? Date.parse(firstAttempt) : Number.NaN
  return (
    Number.isFinite(started) &&
    started <= now &&
    now - started < idempotencyWindow &&
    attempts >= 1 &&
    attempts <= maxAttempts
  )
}

/** No provider payload, email address, token or database error is returned/logged. */
export function createQuoteFollowupHandler(
  backend: QuoteFollowupBackend,
  config: FollowupWorkerConfig,
  dependencies: WorkerDependencies = {},
) {
  const fetcher = dependencies.fetch ?? globalThis.fetch
  const now = dependencies.now ?? Date.now
  const timeoutMs = Math.max(1, Math.min(dependencies.timeoutMs ?? 15000, 15000))
  return async (request: Request): Promise<Response> => {
    const json = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), {
        status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      })
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405)
    if (!config.schedulerSecret || config.schedulerSecret.length < 32)
      return json({ error: "scheduler_not_configured" }, 503)
    const authorization = await verifySchedulerAuthorization(
      request,
      config.schedulerSecret,
      now(),
    )
    if (!authorization) return json({ error: "unauthorized" }, 401)
    let action = "run"
    try {
      const raw = await request.text()
      if (raw.length > 1024) return json({ error: "invalid_request" }, 400)
      const body: unknown = raw ? JSON.parse(raw) : {}
      if (!body || typeof body !== "object" || Array.isArray(body))
        return json({ error: "invalid_request" }, 400)
      const requested = (body as { action?: unknown }).action
      if (requested !== undefined && requested !== "run" && requested !== "health")
        return json({ error: "invalid_request" }, 400)
      if (requested === "health") action = "health"
    } catch {
      return json({ error: "invalid_request" }, 400)
    }
    if (authorization.kind === "signed") {
      if (action !== "run") return json({ error: "unauthorized_action" }, 401)
      try {
        if (
          !(await backend.consumeSchedulerNonce(
            authorization.nonce,
            authorization.issuedAt,
          ))
        ) {
          return json({ error: "scheduler_proof_already_used" }, 409)
        }
      } catch {
        return json({ error: "scheduler_proof_unavailable" }, 503)
      }
    }
    const service = followupServiceState(config)
    try {
      await backend.setServiceStatus(
        service.enabled,
        service.configured,
        service.status,
      )
    } catch {
      return json({ error: "service_status_unavailable", service }, 503)
    }
    // Health and missing/disabled mail configuration never reserve any jobs.
    if (action === "health" || !service.enabled)
      return json({ service, claimed: 0, sent: 0 })
    let jobs: ClaimedFollowupJob[]
    try {
      jobs = await backend.claim(batchSize, leaseSeconds)
      if (
        !Array.isArray(jobs) ||
        jobs.length > batchSize ||
        jobs.some(
          (job) =>
            !uuid.test(job.id) ||
            !uuid.test(job.lease_token) ||
            !Number.isInteger(job.attempts) ||
            job.attempts < 1 ||
            job.attempts > maxAttempts,
        )
      ) {
        return json({ error: "invalid_job_batch", service }, 503)
      }
    } catch {
      return json({ error: "jobs_unavailable", service }, 503)
    }
    const result = {
      service,
      claimed: jobs.length,
      sent: 0,
      skipped: 0,
      failed: 0,
      recording_pending: 0,
    }
    async function fail(job: ClaimedFollowupJob, code: string, ambiguous: boolean) {
      result.failed += 1
      try {
        await backend.fail(job, code, ambiguous)
      } catch {
        result.recording_pending += 1
      }
    }
    async function finish(
      job: ClaimedFollowupJob,
      providerId: string,
      alreadyRecorded = false,
    ) {
      try {
        if (!alreadyRecorded) await backend.recordAcceptance(job, providerId)
        await backend.complete(job, providerId)
        result.sent += 1
      } catch {
        result.recording_pending += 1
        await fail(job, "provider_completion_failed", true)
      }
    }
    for (const job of jobs) {
      // A confirmed acceptance is reconciled without another send, even after
      // a pause or expiration; complete must not schedule a cancelled sequence.
      if (validProviderId(job.provider_message_id)) {
        await finish(job, job.provider_message_id, true)
        continue
      }
      let prepared: PreparedFollowupSend
      try {
        prepared = await backend.prepare(job, config.resendFrom!)
      } catch {
        await fail(job, "prepare_failed", false)
        continue
      }
      if (!prepared || typeof prepared.allowed !== "boolean") {
        await fail(job, "invalid_job_payload", false)
        continue
      }
      if (!prepared.allowed) {
        result.skipped += 1
        continue
      }
      if (validProviderId(prepared.provider_message_id)) {
        await finish(job, prepared.provider_message_id, true)
        continue
      }
      if (!validPreparedEmail(prepared)) {
        await fail(job, "invalid_job_payload", false)
        continue
      }
      // An existing uncertain attempt must not be replayed outside the original
      // provider window. Persist establishes this time for the very first send.
      if (
        prepared.first_attempt_at &&
        !retryWindowOpen(prepared.first_attempt_at, job.attempts, now())
      ) {
        await fail(job, "idempotency_window_expired", true)
        continue
      }
      const content = buildFollowupEmail(prepared.company_name!, prepared.body!)
      const candidate: ProviderEmailPayload = {
        from: prepared.sender!,
        to: prepared.recipient_email!,
        reply_to: prepared.reply_to!,
        subject: prepared.subject!,
        ...content,
      }
      if (!validProviderPayload(candidate)) {
        await fail(job, "invalid_job_payload", false)
        continue
      }
      let persisted: { payload: ProviderEmailPayload; first_attempt_at: string }
      try {
        persisted = await backend.persistPayload(job, candidate)
      } catch {
        await fail(job, "prepare_failed", false)
        continue
      }
      if (!validProviderPayload(persisted?.payload)) {
        await fail(job, "invalid_job_payload", false)
        continue
      }
      if (!retryWindowOpen(persisted.first_attempt_at, job.attempts, now())) {
        await fail(job, "idempotency_window_expired", true)
        continue
      }
      const controller = new AbortController()
      let timer: ReturnType<typeof setTimeout>
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new Error("Provider request timed out"))
        }, timeoutMs)
      })
      let response: Response
      let providerData: unknown = null
      try {
        response = await Promise.race([
          fetcher("https://api.resend.com/emails", {
            method: "POST",
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${config.resendApiKey}`,
              "Content-Type": "application/json",
              "Idempotency-Key": `cadova-quote-followup-${job.id}`,
            },
            body: JSON.stringify(persisted.payload),
          }),
          deadline,
        ])
        try {
          providerData = await Promise.race([response.json(), deadline])
        } catch {
          if (controller.signal.aborted) throw new Error("Provider response timed out")
          // A malformed success is uncertain; never treat it as a known failure.
        }
      } catch {
        await fail(
          job,
          controller.signal.aborted ? "provider_timeout" : "provider_network_error",
          true,
        )
        continue
      } finally {
        clearTimeout(timer!)
      }
      const data =
        providerData && typeof providerData === "object"
          ? (providerData as { id?: unknown; name?: unknown })
          : null
      if (response.ok) {
        if (validProviderId(data?.id)) await finish(job, data.id)
        else await fail(job, "provider_invalid_success", true)
      } else if (response.status >= 500) {
        await fail(job, "provider_server_error", true)
      } else if (
        response.status === 409 &&
        data?.name === "concurrent_idempotent_requests"
      ) {
        await fail(job, "provider_concurrent_request", true)
      } else if (
        response.status === 409 &&
        data?.name === "invalid_idempotent_request"
      ) {
        await fail(job, "provider_payload_mismatch", true)
      } else if (response.status === 429 && data?.name === "rate_limit_exceeded") {
        await fail(job, "provider_rate_limited", false)
      } else if (response.status === 429) {
        await fail(job, "provider_quota_exceeded", false)
      } else if (response.status === 401 || response.status === 403) {
        await fail(job, "provider_authentication_failed", false)
      } else {
        await fail(job, "provider_rejected", false)
      }
    }
    return json(result)
  }
}
