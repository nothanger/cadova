import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"
import { portalTextSuffix } from "../supabase/functions/_shared/quote-email-links.ts"
import {
  classifyDocumentProviderError,
  createQuoteDocumentHandler,
  DocumentSendRequestError,
  type CleanupClaim,
  type DocumentClaim,
  type DocumentJob,
  type DocumentProviderPayload,
  type DocumentSendBackend,
  type DocumentSendConfig,
  type DocumentSendInput,
} from "../supabase/functions/send-quote-document/handler.ts"
import {
  encodeBase64,
  idempotencyWindowMs,
  maxPdfBytes,
  readLimitedBytes,
  sha256,
  validBase64Pdf,
  validPdf,
} from "../supabase/functions/send-quote-document/validation.ts"

const instant = Date.parse("2026-10-04T12:00:00Z")
const actorId = "11111111-1111-4111-8111-111111111111"
const quoteId = "22222222-2222-4222-8222-222222222222"
const companyId = "33333333-3333-4333-8333-333333333333"
const documentId = "44444444-4444-4444-8444-444444444444"
const jobId = "55555555-5555-4555-8555-555555555555"
const lease = "66666666-6666-4666-8666-666666666666"
const cleanupId = "77777777-7777-4777-8777-777777777777"
const nonce = "88888888-8888-4888-8888-888888888888"
const pdf = new TextEncoder().encode(
  "%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF",
)
const path = `${companyId}/${actorId}/${documentId}.pdf`
const secret = "scheduler-test-only-" + "s".repeat(40)
const config: DocumentSendConfig = {
  emailEnabled: true,
  resendApiKey: "re_test_private",
  resendFrom: "Cadova <devis@example.test>",
  schedulerSecret: secret,
}
const input = {
  action: "send",
  quoteId,
  recipientEmail: "client@example.test",
  subject: "Votre devis",
  message: "Bonjour,\nVoici votre devis.",
  retry: false,
}
const cleanup: CleanupClaim = { id: cleanupId, storage_path: path, lease_token: lease }
const portalUrl = `https://www.cadova.fr/devis/suivi#token=${"a".repeat(43)}`
const initialJob: DocumentClaim = {
  id: jobId,
  quote_id: quoteId,
  status: "preparing",
  allowed: true,
  attempts: 0,
  first_attempt_at: null,
  provider_message_id: null,
  sent_at: null,
  created_at: new Date(instant).toISOString(),
  recipient_email: input.recipientEmail,
  reply_to: "artisan@example.test",
  subject: input.subject,
  body: input.message,
  company_name: "Atelier <&>",
  document_path: path,
  file_name: "Devis été.pdf",
  size_bytes: pdf.length,
  mime_type: "application/pdf",
}

class Backend implements DocumentSendBackend {
  calls: string[] = []
  job = structuredClone(initialJob)
  actor: { id: string } | null = { id: actorId }
  failure = ""
  requestFailure: DocumentSendRequestError | null = null
  forcedClaim: Partial<DocumentClaim> = {}
  file = { bytes: pdf, mimeType: "application/pdf" }
  payload: DocumentProviderPayload | null = null
  firstAttempt: string | null = null
  failures: { code: string; ambiguous: boolean }[] = []
  inputs: DocumentSendInput[] = []
  hashes: string[] = []
  held = false
  cleanupClaims: CleanupClaim[] = [cleanup]
  removed: string[] = []
  nonces = new Set<string>()
  linkUrl = portalUrl
  replyRoute = `q-${"a".repeat(48)}@replies.cadova.fr`
  replyDomains: (string | undefined)[] = []
  visit(name: string) {
    this.calls.push(name)
    if (this.failure === name) throw new Error("private-database-error@example.test")
  }
  async verifyToken(token: string) {
    this.visit("verify")
    assert.equal(token, "valid-user-jwt")
    return this.actor
  }
  async requestSend(token: string, value: DocumentSendInput): Promise<DocumentJob> {
    this.visit("request")
    assert.equal(token, "valid-user-jwt")
    this.inputs.push(value)
    if (this.requestFailure) throw this.requestFailure
    if (value.retry && this.job.status === "delivery_unknown")
      this.job.status = "preparing"
    return structuredClone(this.job)
  }
  async claim(id: string, user: string, seconds: number): Promise<DocumentClaim> {
    this.visit("claim")
    assert.equal(id, jobId)
    assert.equal(user, actorId)
    assert.equal(seconds, 300)
    if (this.held)
      return { ...structuredClone(this.job), allowed: false, reason: "in_progress" }
    this.held = true
    this.job.status = "processing"
    this.job.attempts =
      (this.job.attempts ?? 0) + (this.job.provider_message_id ? 0 : 1)
    return {
      ...structuredClone(this.job),
      lease_token: lease,
      provider_payload: this.payload ? structuredClone(this.payload) : null,
      first_attempt_at: this.firstAttempt,
      ...this.forcedClaim,
    }
  }
  async download(value: string) {
    this.visit("download")
    assert.equal(value, path)
    return this.file
  }
  async prepareLinks(claim: DocumentClaim, publicUrl: string, replyDomain?: string) {
    this.visit("links")
    assert.equal(claim.lease_token, lease)
    assert.equal(publicUrl, "https://www.cadova.fr")
    this.replyDomains.push(replyDomain)
    return {
      portalUrl: this.linkUrl,
      ...(replyDomain ? { replyTo: this.replyRoute } : {}),
    }
  }
  async persist(claim: DocumentClaim, payload: DocumentProviderPayload, hash: string) {
    this.visit("persist")
    assert.equal(claim.lease_token, lease)
    this.hashes.push(hash)
    this.payload ??= structuredClone(payload)
    this.firstAttempt ??= new Date(instant).toISOString()
    this.job.first_attempt_at = this.firstAttempt
    return {
      payload: structuredClone(this.payload),
      first_attempt_at: this.firstAttempt,
    }
  }
  async recordAcceptance(claim: DocumentClaim, id: string) {
    this.visit("accept")
    assert.equal(claim.lease_token, lease)
    this.job.provider_message_id = id
  }
  async complete(claim: DocumentClaim, id: string) {
    this.visit("complete")
    assert.equal(claim.lease_token, lease)
    assert.equal(id, this.job.provider_message_id)
    this.job.status = "sent"
    this.job.sent_at = new Date(instant).toISOString()
    this.held = false
  }
  async fail(claim: DocumentClaim, code: string, ambiguous: boolean) {
    this.visit("fail")
    assert.equal(claim.lease_token, lease)
    this.failures.push({ code, ambiguous })
    if (!this.job.provider_message_id)
      this.job.status = ambiguous ? "delivery_unknown" : "failed"
    this.job.last_error_code = code
    this.held = false
  }
  async consumeCleanupNonce(value: string, issuedAt: number) {
    this.visit("nonce")
    assert.ok(Number.isInteger(issuedAt))
    if (this.nonces.has(value)) return false
    this.nonces.add(value)
    return true
  }
  async claimCleanup(size: number, seconds: number) {
    this.visit("cleanup_claim")
    assert.equal(size, 20)
    assert.equal(seconds, 300)
    return structuredClone(this.cleanupClaims)
  }
  async removeDocument(value: string) {
    this.visit("remove")
    this.removed.push(value)
  }
  async completeCleanup(value: CleanupClaim) {
    this.visit("cleanup_complete")
    assert.equal(value.lease_token, lease)
  }
  async failCleanup(value: CleanupClaim) {
    this.visit("cleanup_fail")
    assert.equal(value.lease_token, lease)
  }
}

function provider(status = 200, value: unknown = { id: "provider-accepted-id" }) {
  const requests: { url: string; headers: Headers; body: string }[] = []
  const fetcher: typeof fetch = async (url, options) => {
    requests.push({
      url: String(url),
      headers: new Headers(options?.headers),
      body: String(options?.body),
    })
    return new Response(JSON.stringify(value), { status })
  }
  return { fetcher, requests }
}
async function invoke(
  backend = new Backend(),
  settings = config,
  fetcher = provider().fetcher,
  body: unknown = input,
  options: {
    authorization?: string
    origin?: string
    method?: string
    now?: number
    timeoutMs?: number
  } = {},
) {
  const method = options.method ?? "POST"
  const response = await createQuoteDocumentHandler(backend, settings, {
    fetch: fetcher,
    now: () => options.now ?? instant,
    timeoutMs: options.timeoutMs,
  })(
    new Request("https://project.example.test/functions/v1/send-quote-document", {
      method,
      headers: {
        Authorization: options.authorization ?? "Bearer valid-user-jwt",
        ...(options.origin ? { Origin: options.origin } : {}),
      },
      ...(["GET", "OPTIONS"].includes(method)
        ? {}
        : { body: typeof body === "string" ? body : JSON.stringify(body) }),
    }),
  )
  const data = response.status === 204 ? null : await response.json()
  return { response, data }
}
function cleanupProof(
  issuedAt = Math.floor(instant / 1000),
  key = secret,
  namespace = "quote-documents-cleanup",
  version = "cadova-documents-v1",
) {
  return `Bearer ${version}:${issuedAt}:${nonce}:${createHmac("sha256", key).update(`${namespace}:${issuedAt}:${nonce}`).digest("hex")}`
}

// These tests never construct a real Supabase connection or contact an email provider.
test("authentification utilisateur obligatoire avant demande d’envoi ou téléchargement", async () => {
  for (const authorization of [
    "",
    "Basic value",
    "Bearer token extra",
    "Bearer " + "x".repeat(8193),
  ]) {
    const backend = new Backend()
    const sender = provider()
    const { response } = await invoke(backend, config, sender.fetcher, input, {
      authorization,
    })
    assert.equal(response.status, 401)
    assert.deepEqual(backend.calls, [])
    assert.equal(sender.requests.length, 0)
  }
  const backend = new Backend()
  backend.actor = null
  assert.equal((await invoke(backend)).response.status, 401)
  assert.deepEqual(backend.calls, ["verify"])
  const unavailable = new Backend()
  unavailable.failure = "verify"
  assert.equal((await invoke(unavailable)).response.status, 503)
  assert.deepEqual(unavailable.calls, ["verify"])
})

test("refus RPC pour entreprise étrangère bloque tous les appels privilégiés", async () => {
  const backend = new Backend()
  backend.failure = "request"
  const sender = provider()
  const { response, data } = await invoke(backend, config, sender.fetcher)
  assert.equal(response.status, 403)
  assert.equal(data.error, "send_not_allowed")
  assert.deepEqual(backend.calls, ["verify", "request"])
  assert.equal(sender.requests.length, 0)
  assert.ok(!JSON.stringify(data).includes("private-database"))
})

test("les refus métier connus donnent un code utile sans exposer le message SQL", async () => {
  for (const [code, status] of [
    ["already_sent", 409],
    ["send_in_progress", 409],
    ["document_missing", 409],
    ["reply_address_missing", 409],
    ["delivery_unknown", 409],
    ["send_unavailable", 503],
  ] as const) {
    const backend = new Backend()
    backend.requestFailure = new DocumentSendRequestError(code, status)
    const sender = provider()
    const { response, data } = await invoke(backend, config, sender.fetcher)
    assert.equal(response.status, status)
    assert.equal(data.error, code)
    assert.deepEqual(backend.calls, ["verify", "request"])
    assert.equal(sender.requests.length, 0)
  }
})

test("CORS accepte les deux domaines et les ports de développement explicitement autorisés", async () => {
  for (const origin of [
    "https://cadova.fr",
    "https://www.cadova.fr",
    "http://localhost:8443",
    "http://127.0.0.1:8446",
  ]) {
    const backend = new Backend()
    const { response } = await invoke(backend, config, provider().fetcher, null, {
      origin,
      method: "OPTIONS",
    })
    assert.equal(response.status, 204)
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin)
    assert.equal(response.headers.get("Vary"), "Origin")
    assert.deepEqual(backend.calls, [])
  }
  for (const origin of [
    "https://cadova.fr.evil.test",
    "null",
    "https://other.test",
    "http://localhost:9999",
  ]) {
    const backend = new Backend()
    const { response } = await invoke(backend, config, provider().fetcher, input, {
      origin,
    })
    assert.equal(response.status, 403)
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null)
    assert.deepEqual(backend.calls, [])
  }
})

test("requêtes malformées, trop longues ou avec champs supplémentaires refusées sans effet", async () => {
  for (const body of [
    "not-json",
    [],
    null,
    { ...input, companyId },
    { ...input, quoteId: "other" },
    { ...input, recipientEmail: "bad\r\nBcc: x@example.test" },
    { ...input, subject: "hello\nBCC" },
    { ...input, subject: "x".repeat(161) },
    { ...input, message: "x".repeat(4001) },
    { ...input, message: "\0message" },
    { ...input, retry: "yes" },
    "x".repeat(16385),
  ]) {
    const backend = new Backend()
    assert.equal(
      (await invoke(backend, config, provider().fetcher, body)).response.status,
      400,
    )
    assert.deepEqual(backend.calls, [])
  }
  const backend = new Backend()
  assert.equal(
    (await invoke(backend, config, provider().fetcher, input, { method: "GET" }))
      .response.status,
    405,
  )
  assert.deepEqual(backend.calls, [])
})

test("configuration absente ou désactivée : aucun job, document ou email", async () => {
  for (const settings of [
    { ...config, emailEnabled: false },
    { ...config, resendApiKey: undefined },
    { ...config, resendApiKey: "has spaces" },
    { ...config, resendFrom: "sender\r\nBcc: x@example.test" },
  ]) {
    const backend = new Backend()
    const sender = provider()
    const { response, data } = await invoke(backend, settings, sender.fetcher)
    assert.equal(response.status, 503)
    assert.equal(data.error, "email_configuration_missing")
    assert.deepEqual(backend.calls, ["verify"])
    assert.equal(sender.requests.length, 0)
    assert.ok(!JSON.stringify(data).includes("re_test_private"))
  }
})

test("PDF privé : snapshot durable avant fournisseur puis acceptation avant finalisation métier", async () => {
  const backend = new Backend()
  const sender = provider()
  const { response, data } = await invoke(backend, config, sender.fetcher)
  assert.equal(response.status, 200)
  assert.equal(data.state, "sent")
  assert.deepEqual(backend.calls, [
    "verify",
    "request",
    "claim",
    "download",
    "links",
    "persist",
    "accept",
    "complete",
  ])
  assert.equal(sender.requests.length, 1)
  const request = sender.requests[0]
  const payload = JSON.parse(request.body)
  assert.equal(request.url, "https://api.resend.com/emails")
  assert.equal(request.headers.get("Idempotency-Key"), `cadova-quote-initial-${jobId}`)
  assert.equal(payload.to, input.recipientEmail)
  assert.equal(payload.reply_to, "artisan@example.test")
  assert.equal(payload.text, input.message + portalTextSuffix(portalUrl))
  assert.ok(payload.html.includes(`href="${portalUrl}"`))
  assert.equal(payload.attachments[0].content_type, "application/pdf")
  assert.equal(payload.attachments[0].filename, "Devis été.pdf")
  assert.deepEqual(
    Buffer.from(payload.attachments[0].content, "base64"),
    Buffer.from(pdf),
  )
  assert.deepEqual(backend.hashes, [await sha256(pdf)])
  assert.ok(payload.html.includes("Atelier &lt;&amp;&gt;"))
  assert.ok(payload.html.includes("<br>"))
  assert.equal(data.job.recipient_email, input.recipientEmail)
  assert.equal(data.job.first_attempt_at, new Date(instant).toISOString())
  assert.equal(data.job.created_at, initialJob.created_at)
  assert.equal(data.job.provider_message_id, "provider-accepted-id")
  for (const privateField of [
    "provider_payload",
    "lease_token",
    "document_path",
    "reply_to",
  ])
    assert.ok(!(privateField in data.job))
  assert.ok(!JSON.stringify(data).includes(config.resendApiKey!))
  assert.ok(!JSON.stringify(data).includes(encodeBase64(pdf)))
})

test("état déjà envoyé ou échec non relancé reste sans téléchargement et sans HTTP", async () => {
  for (const status of ["sent", "cancelled", "failed", "delivery_unknown"]) {
    const backend = new Backend()
    backend.job.status = status
    const sender = provider()
    const { data } = await invoke(backend, config, sender.fetcher)
    assert.equal(
      data.state,
      status === "sent"
        ? "sent"
        : status === "delivery_unknown"
          ? "delivery_unknown"
          : "failed",
    )
    assert.deepEqual(backend.calls, ["verify", "request"])
    assert.equal(sender.requests.length, 0)
  }
})

test("réservations refusées, expirées ou incohérentes n’atteignent jamais le fournisseur", async () => {
  for (const forcedClaim of [
    { allowed: false, reason: "in_progress" },
    { allowed: false, reason: "actor_unavailable" },
    { lease_token: "invalid" },
    { attempts: 6 },
    { id: quoteId },
  ]) {
    const backend = new Backend()
    backend.forcedClaim = forcedClaim
    const sender = provider()
    await invoke(backend, config, sender.fetcher)
    assert.equal(sender.requests.length, 0)
    assert.ok(!backend.calls.includes("download"))
    assert.ok(!backend.calls.includes("persist"))
  }
  const backend = new Backend()
  backend.failure = "claim"
  assert.equal((await invoke(backend)).response.status, 503)
})

test("double clic concurrent : le second appel voit la réservation et aucun second email n’est soumis", async () => {
  const backend = new Backend()
  let arrive!: () => void
  const arrived = new Promise<void>((resolve) => {
    arrive = resolve
  })
  let release!: (value: Response) => void
  const pending = new Promise<Response>((resolve) => {
    release = resolve
  })
  let providerCalls = 0
  const fetcher: typeof fetch = async () => {
    providerCalls++
    arrive()
    return pending
  }
  const first = invoke(backend, config, fetcher)
  await arrived
  const second = await invoke(backend, config, fetcher)
  assert.equal(second.data.state, "processing")
  assert.equal(second.data.error, "in_progress")
  assert.equal(providerCalls, 1)
  release(new Response(JSON.stringify({ id: "provider-accepted-id" })))
  assert.equal((await first).data.state, "sent")
  assert.equal(providerCalls, 1)
})

test("documents absents, falsifiés, type MIME incorrect et fichiers trop grands sont bloqués", async () => {
  for (const variant of [
    "mime",
    "magic",
    "size",
    "oversize",
    "path",
    "filename",
    "missing",
  ]) {
    const backend = new Backend()
    const sender = provider()
    if (variant === "mime") backend.file.mimeType = "text/html"
    if (variant === "magic") backend.file.bytes = new TextEncoder().encode("<html>")
    if (variant === "size") backend.forcedClaim.size_bytes = pdf.length + 1
    if (variant === "oversize") backend.forcedClaim.size_bytes = maxPdfBytes + 1
    if (variant === "path")
      backend.forcedClaim.document_path = `../other/${documentId}.pdf`
    if (variant === "filename") backend.forcedClaim.file_name = "../../secret.pdf"
    if (variant === "missing") backend.failure = "download"
    const { data } = await invoke(backend, config, sender.fetcher)
    assert.equal(data.state, "failed")
    assert.equal(sender.requests.length, 0)
    assert.ok(!backend.calls.includes("persist"))
  }
})

test("PDF de 10 Mo autorisé, limite dépassée ou base64 non canonique refusés", async () => {
  const bytes = new Uint8Array(maxPdfBytes)
  bytes.set(pdf)
  assert.equal(validPdf(bytes, "application/pdf; charset=binary"), true)
  assert.equal(validBase64Pdf(encodeBase64(bytes)), true)
  const tooBig = new Uint8Array(maxPdfBytes + 1)
  tooBig.set(pdf)
  assert.equal(validPdf(tooBig, "application/pdf"), false)
  assert.equal(validBase64Pdf(encodeBase64(tooBig)), false)
  assert.equal(validBase64Pdf(encodeBase64(pdf) + "\n"), false)
  assert.equal(validBase64Pdf(encodeBase64(new TextEncoder().encode("<html>"))), false)
  assert.equal(validBase64Pdf({ content: "JVBERi0=" }), false)
})

test("lecture bornée arrête et annule le flux dès dépassement", async () => {
  let cancelled = false
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(11))
    },
    cancel() {
      cancelled = true
    },
  })
  await assert.rejects(readLimitedBytes(stream, 10), /limit/)
  assert.equal(cancelled, true)
})

test("annulation d’un flux bloqué libère la lecture même si la source ne confirme pas cancel", async () => {
  let cancelled = false
  const controller = new AbortController()
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true
      return new Promise<void>(() => {})
    },
  })
  const reading = readLimitedBytes(stream, 100, controller.signal)
  controller.abort()
  await assert.rejects(reading, /aborted/)
  assert.equal(cancelled, true)
  assert.equal(stream.locked, false)
})

test("une requête entrante qui reste bloquée expire avant tout appel backend", async () => {
  const backend = new Backend()
  let cancelled = false
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("{"))
    },
    cancel() {
      cancelled = true
    },
  })
  const request = new Request(
    "https://project.example.test/functions/v1/send-quote-document",
    { method: "POST", body: stream, duplex: "half" } as RequestInit,
  )
  const response = await createQuoteDocumentHandler(backend, config, { timeoutMs: 5 })(
    request,
  )
  assert.equal(response.status, 400)
  assert.equal(cancelled, true)
  assert.deepEqual(backend.calls, [])
})

test("snapshot refusé ou lease perdue avant persistance : aucun appel email", async () => {
  const backend = new Backend()
  backend.failure = "persist"
  const sender = provider()
  const { data } = await invoke(backend, config, sender.fetcher)
  assert.equal(data.error, "send_snapshot_changed")
  assert.equal(data.state, "failed")
  assert.equal(sender.requests.length, 0)
})

test("timeout suivi d’un retry explicite réutilise les mêmes octets et la même clé", async () => {
  const backend = new Backend()
  const first = provider(500, { message: "private-provider@example.test" })
  assert.equal(
    (await invoke(backend, config, first.fetcher)).data.state,
    "delivery_unknown",
  )
  const noRetry = provider()
  await invoke(backend, config, noRetry.fetcher)
  assert.equal(noRetry.requests.length, 0)
  backend.job.company_name = "Nom modifié"
  backend.file.bytes = new TextEncoder().encode("%PDF-changed")
  const second = provider()
  const { data } = await invoke(
    backend,
    { ...config, resendFrom: "Cadova <new@example.test>" },
    second.fetcher,
    { ...input, retry: true },
    { now: instant + 60000 },
  )
  assert.equal(data.state, "sent")
  assert.equal(first.requests[0].body, second.requests[0].body)
  assert.equal(
    first.requests[0].headers.get("Idempotency-Key"),
    second.requests[0].headers.get("Idempotency-Key"),
  )
  assert.equal(backend.calls.filter((call) => call === "download").length, 1)
  assert.equal(backend.calls.filter((call) => call === "persist").length, 1)
  assert.equal(data.job.attempts, 2)
  assert.equal(data.job.first_attempt_at, new Date(instant).toISOString())
})

test("acceptation enregistrée : réconciliation sans HTTP même après 23 heures", async () => {
  const backend = new Backend()
  backend.failure = "complete"
  const first = provider()
  const pending = await invoke(backend, config, first.fetcher)
  assert.equal(first.requests.length, 1)
  assert.equal(pending.data.job.provider_message_id, "provider-accepted-id")
  backend.failure = ""
  const second = provider()
  assert.equal(
    (
      await invoke(
        backend,
        config,
        second.fetcher,
        { ...input, retry: true },
        { now: instant + 48 * 3600000 },
      )
    ).data.state,
    "sent",
  )
  assert.equal(second.requests.length, 0)
  assert.equal(backend.calls.filter((call) => call === "accept").length, 1)
})

test("acceptation non enregistrée garde l’incertitude et ne soumet jamais un second email dans le même appel", async () => {
  const backend = new Backend()
  backend.failure = "accept"
  const sender = provider()
  const { data } = await invoke(backend, config, sender.fetcher)
  assert.equal(data.state, "delivery_unknown")
  assert.equal(data.error, "provider_completion_failed")
  assert.equal(sender.requests.length, 1)
  assert.ok(!backend.calls.includes("complete"))
  assert.equal(backend.payload?.to, input.recipientEmail)
})

test("snapshot gelé incohérent avec la demande : aucun email ne part vers un autre destinataire", async () => {
  const backend = new Backend()
  await invoke(backend, config, provider(500, {}).fetcher)
  backend.payload!.to = "different@example.test"
  const sender = provider()
  const { data } = await invoke(backend, config, sender.fetcher, {
    ...input,
    retry: true,
  })
  assert.equal(data.state, "delivery_unknown")
  assert.equal(data.error, "invalid_document")
  assert.equal(sender.requests.length, 0)
})

test("à 23 heures ou au-delà aucune nouvelle requête fournisseur ambiguë", async () => {
  for (const offset of [idempotencyWindowMs, idempotencyWindowMs + 1, 48 * 3600000]) {
    const backend = new Backend()
    backend.firstAttempt = new Date(instant).toISOString()
    const sender = provider()
    const { data } = await invoke(
      backend,
      config,
      sender.fetcher,
      { ...input, retry: true },
      { now: instant + offset },
    )
    assert.equal(data.state, "delivery_unknown")
    assert.equal(data.error, "idempotency_window_expired")
    assert.equal(sender.requests.length, 0)
  }
})

test("timeout couvre HTTP et lecture du corps, sans afficher les détails du fournisseur", async () => {
  const cases: (typeof fetch)[] = [
    async () => new Promise<Response>(() => {}),
    async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("{"))
          },
        }),
      ),
    async () => {
      throw new Error("network-private@example.test")
    },
  ]
  for (let index = 0; index < cases.length; index++) {
    const backend = new Backend()
    const started = Date.now()
    const { data } = await invoke(backend, config, cases[index], input, {
      timeoutMs: 5,
    })
    assert.ok(Date.now() - started < 1000)
    assert.equal(data.state, "delivery_unknown")
    assert.equal(
      data.error,
      index === 2 ? "provider_network_error" : "provider_timeout",
    )
    assert.ok(!JSON.stringify(data).includes("network-private"))
    assert.ok(!backend.calls.includes("accept"))
  }
})

test("succès HTTP sans identifiant fiable ou réponse trop grosse reste à vérifier", async () => {
  for (const fetcher of [
    provider(200, {}).fetcher,
    provider(200, { id: "<script>unsafe</script>" }).fetcher,
    provider(200, { id: "provider-id", body: "x".repeat(9000) }).fetcher,
    (async () => new Response("not-json")) as typeof fetch,
  ]) {
    const backend = new Backend()
    const { data } = await invoke(backend, config, fetcher)
    assert.equal(data.state, "delivery_unknown")
    assert.equal(data.error, "provider_invalid_success")
    assert.ok(!backend.calls.includes("complete"))
  }
})

test("erreurs Resend explicites : domaine, expéditeur, clé, quota, concurrence et refus", async () => {
  for (const [status, name, message, code, ambiguous] of [
    [
      403,
      "validation_error",
      "The cadova.example domain is not verified.",
      "provider_domain_not_verified",
      false,
    ],
    [
      403,
      "validation_error",
      "You can only send testing emails to your own email address",
      "provider_sender_not_allowed",
      false,
    ],
    [
      403,
      "restricted_api_key",
      "private@example.test",
      "provider_restricted_key",
      false,
    ],
    [403, "suspended_api_key", "private@example.test", "provider_suspended_key", false],
    [
      401,
      "invalid_api_key",
      "private@example.test",
      "provider_authentication_failed",
      false,
    ],
    [403, "unknown", "private@example.test", "provider_permission_denied", false],
    [
      429,
      "rate_limit_exceeded",
      "private@example.test",
      "provider_rate_limited",
      false,
    ],
    [
      429,
      "daily_quota_exceeded",
      "private@example.test",
      "provider_quota_exceeded",
      false,
    ],
    [
      409,
      "invalid_idempotent_request",
      "private@example.test",
      "provider_payload_mismatch",
      true,
    ],
    [
      409,
      "concurrent_idempotent_requests",
      "private@example.test",
      "provider_concurrent_request",
      true,
    ],
    [500, "internal_error", "private@example.test", "provider_server_error", true],
    [422, "validation_error", "private@example.test", "provider_rejected", false],
  ] as const) {
    const backend = new Backend()
    const sender = provider(status, { name, message })
    const { data } = await invoke(backend, config, sender.fetcher)
    assert.equal(data.error, code)
    assert.deepEqual(backend.failures, [{ code, ambiguous }])
    assert.equal(sender.requests.length, 1)
    assert.ok(!JSON.stringify(data).includes("private@example.test"))
    assert.ok(!backend.calls.includes("accept"))
  }
  assert.deepEqual(classifyDocumentProviderError(403, null), {
    code: "provider_permission_denied",
    ambiguous: false,
  })
})

test("nettoyage : preuve HMAC dédiée consommée une fois et seuls les chemins réservés sont supprimés", async () => {
  const backend = new Backend()
  const sender = provider()
  const authorization = cleanupProof()
  const first = await invoke(
    backend,
    { ...config, emailEnabled: false },
    sender.fetcher,
    { action: "cleanup" },
    { authorization },
  )
  assert.equal(first.response.status, 200)
  assert.deepEqual(first.data, { removed: 1, pending: 0 })
  assert.deepEqual(backend.calls, [
    "nonce",
    "cleanup_claim",
    "remove",
    "cleanup_complete",
  ])
  assert.deepEqual(backend.removed, [path])
  const second = await invoke(
    backend,
    config,
    sender.fetcher,
    { action: "cleanup" },
    { authorization },
  )
  assert.equal(second.response.status, 409)
  assert.equal(second.data.error, "cleanup_proof_already_used")
  assert.equal(backend.removed.length, 1)
  assert.equal(sender.requests.length, 0)
})

test("nettoyage interdit avec JWT utilisateur, secret brut, preuve de relance ou signature invalide", async () => {
  for (const authorization of [
    "Bearer valid-user-jwt",
    `Bearer ${secret}`,
    cleanupProof(undefined, secret, "run", "cadova-v1"),
    cleanupProof(undefined, "wrong-private-key"),
    cleanupProof().replace(nonce, actorId),
  ]) {
    const backend = new Backend()
    assert.equal(
      (
        await invoke(
          backend,
          config,
          provider().fetcher,
          { action: "cleanup" },
          { authorization },
        )
      ).response.status,
      401,
    )
    assert.deepEqual(backend.calls, [])
  }
  const backend = new Backend()
  assert.equal(
    (
      await invoke(
        backend,
        config,
        provider().fetcher,
        { action: "cleanup", storage_path: path },
        { authorization: cleanupProof() },
      )
    ).response.status,
    400,
  )
  assert.deepEqual(backend.calls, [])
})

test("preuve de nettoyage bornée dans le temps et indisponibilité nonce fermée", async () => {
  for (const [offset, accepted] of [
    [-301, false],
    [-300, true],
    [30, true],
    [31, false],
  ] as const) {
    const backend = new Backend()
    const { response } = await invoke(
      backend,
      config,
      provider().fetcher,
      { action: "cleanup" },
      { authorization: cleanupProof(Math.floor(instant / 1000) + offset) },
    )
    assert.equal(response.status, accepted ? 200 : 401)
  }
  const backend = new Backend()
  backend.failure = "nonce"
  assert.equal(
    (
      await invoke(
        backend,
        config,
        provider().fetcher,
        { action: "cleanup" },
        { authorization: cleanupProof() },
      )
    ).response.status,
    503,
  )
  assert.deepEqual(backend.calls, ["nonce"])
})

test("nettoyage borne la taille du lot et refuse chemins ou leases non valides avant suppression", async () => {
  for (const claims of [
    Array.from({ length: 21 }, () => cleanup),
    [{ ...cleanup, storage_path: "../someone/file.pdf" }],
    [{ ...cleanup, lease_token: "invalid" }],
  ]) {
    const backend = new Backend()
    backend.cleanupClaims = claims
    const { response } = await invoke(
      backend,
      config,
      provider().fetcher,
      { action: "cleanup" },
      { authorization: cleanupProof() },
    )
    assert.equal(response.status, 503)
    assert.deepEqual(backend.removed, [])
  }
})

test("un échec de suppression est remis en attente et ne bloque pas le reste du lot", async () => {
  const backend = new Backend()
  backend.failure = "remove"
  const { data } = await invoke(
    backend,
    config,
    provider().fetcher,
    { action: "cleanup" },
    { authorization: cleanupProof() },
  )
  assert.deepEqual(data, { removed: 0, pending: 1 })
  assert.ok(backend.calls.includes("cleanup_fail"))
  assert.ok(!backend.calls.includes("cleanup_complete"))
})

test("lien portail indisponible ou non fiable : aucun email ni snapshot fournisseur", async () => {
  for (const variant of ["unavailable", "external", "query_token"]) {
    const backend = new Backend()
    if (variant === "unavailable") backend.failure = "links"
    if (variant === "external")
      backend.linkUrl = portalUrl.replace("www.cadova.fr", "evil.test")
    if (variant === "query_token")
      backend.linkUrl = portalUrl.replace("#token=", "?token=")
    const sender = provider()
    const { data } = await invoke(backend, config, sender.fetcher)
    assert.equal(sender.requests.length, 0)
    assert.equal(data.errorCode, "client_link_unavailable")
    assert.equal(backend.payload, null)
  }
})

test("réception email activée explicitement, contact entreprise sinon et aucun routage arbitraire", async () => {
  for (const options of [
    { receiveDomain: "replies.cadova.fr" },
    { replyEmailEnabled: false, receiveDomain: "replies.cadova.fr" },
    { replyEmailEnabled: true, receiveDomain: "evil.test" },
    { replyEmailEnabled: true, receiveDomain: "replies.cadova.fr" },
  ]) {
    const backend = new Backend()
    const sender = provider()
    await invoke(backend, { ...config, ...options }, sender.fetcher)
    const enabled =
      options.replyEmailEnabled === true &&
      options.receiveDomain === "replies.cadova.fr"
    assert.equal(
      JSON.parse(sender.requests[0].body).reply_to,
      enabled ? backend.replyRoute : initialJob.reply_to,
    )
    assert.deepEqual(backend.replyDomains, [enabled ? "replies.cadova.fr" : undefined])
  }
})

test("retry initial garde lien et Reply-To gelés malgré changements de configuration et service indisponible", async () => {
  const backend = new Backend()
  const first = provider(500, { name: "server_error" })
  await invoke(
    backend,
    { ...config, replyEmailEnabled: true, receiveDomain: "replies.cadova.fr" },
    first.fetcher,
  )
  backend.failure = "links"
  backend.linkUrl = portalUrl.replace("a", "z")
  const retry = provider()
  await invoke(
    backend,
    {
      ...config,
      resendFrom: "Cadova <changed@example.test>",
      replyEmailEnabled: false,
    },
    retry.fetcher,
    { ...input, retry: true },
    { now: instant + 60000 },
  )
  assert.equal(first.requests[0].body, retry.requests[0].body)
  assert.equal(backend.calls.filter((call) => call === "links").length, 1)
})

test("ancien envoi incertain sans snapshot est bloqué avant lien ou email", async () => {
  const backend = new Backend()
  backend.firstAttempt = new Date(instant).toISOString()
  const sender = provider()
  const { data } = await invoke(backend, config, sender.fetcher)
  assert.equal(data.errorCode, "send_snapshot_missing")
  assert.equal(sender.requests.length, 0)
  assert.ok(!backend.calls.includes("links"))
})
