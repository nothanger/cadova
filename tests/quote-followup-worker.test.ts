import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"
import { portalTextSuffix } from "../supabase/functions/_shared/quote-email-links.ts"
import {
  buildFollowupEmail,
  createQuoteFollowupHandler,
  type ClaimedFollowupJob,
  type FollowupServiceStatus,
  type FollowupWorkerConfig,
  type PreparedFollowupSend,
  type ProviderEmailPayload,
  type QuoteFollowupBackend,
} from "../supabase/functions/send-quote-followups/handler.ts"
import {
  hasSchedulerAuthorization,
  isEmailAddress,
  isEmailSender,
  publicHttpsUrl,
} from "../supabase/functions/send-quote-followups/validation.ts"

const instant = Date.parse("2026-10-17T12:00:00Z")
const secret = "scheduler-test-secret-" + "a".repeat(40)
const config: FollowupWorkerConfig = {
  schedulerSecret: secret,
  emailEnabled: true,
  resendApiKey: "re_test_key_never_live",
  resendFrom: "Cadova <suivi@example.test>",
}
const job: ClaimedFollowupJob = {
  id: "10000000-0000-4000-8000-000000000001",
  lease_token: "20000000-0000-4000-8000-000000000001",
  attempts: 1,
  first_attempt_at: null,
  provider_message_id: null,
}
const portalUrl = `https://www.cadova.fr/devis/suivi#token=${"b".repeat(43)}`

class Backend implements QuoteFollowupBackend {
  calls: string[] = []
  failures: { code: string; ambiguous: boolean }[] = []
  jobs = [{ ...job }]
  failAt = ""
  nonces = new Set<string>()
  consumedProofs: { nonce: string; issuedAt: number }[] = []
  payload: ProviderEmailPayload | null = null
  firstAttempt = new Date(instant).toISOString()
  linkUrl = portalUrl
  replyRoute = `q-${"b".repeat(48)}@replies.cadova.fr`
  replyDomains: (string | undefined)[] = []
  prepared: PreparedFollowupSend = {
    allowed: true,
    recipient_email: "client@example.test",
    reply_to: "contact@example.test",
    sender: config.resendFrom,
    subject: "Votre devis DEV-001",
    body: "Bonjour Camille,\n\nAvez-vous pu consulter le devis DEV-001 ?\n\nAtelier de test",
    company_name: "Atelier de test",
    first_attempt_at: null,
  }
  mark(name: string) {
    this.calls.push(name)
    if (this.failAt === name) throw new Error("private-database-details")
  }
  async consumeSchedulerNonce(nonce: string, issuedAt: number) {
    this.mark("nonce")
    if (this.nonces.has(nonce)) return false
    this.nonces.add(nonce)
    this.consumedProofs.push({ nonce, issuedAt })
    return true
  }
  async setServiceStatus(
    enabled: boolean,
    configured: boolean,
    status: FollowupServiceStatus,
  ) {
    this.mark(`health:${enabled}:${configured}:${status}`)
  }
  async claim(size: number, lease: number) {
    this.mark(`claim:${size}:${lease}`)
    return this.jobs
  }
  async prepare() {
    this.mark("prepare")
    return {
      ...this.prepared,
      provider_payload: this.payload ? structuredClone(this.payload) : null,
      first_attempt_at: this.payload
        ? this.firstAttempt
        : this.prepared.first_attempt_at,
    }
  }
  async prepareLinks(
    claim: ClaimedFollowupJob,
    publicUrl: string,
    replyDomain?: string,
  ) {
    this.mark("links")
    assert.equal(claim.lease_token, job.lease_token)
    assert.equal(publicUrl, "https://www.cadova.fr")
    this.replyDomains.push(replyDomain)
    return {
      portalUrl: this.linkUrl,
      ...(replyDomain ? { replyTo: this.replyRoute } : {}),
    }
  }
  async persistPayload(_job: ClaimedFollowupJob, payload: ProviderEmailPayload) {
    this.mark("persist")
    this.payload ??= structuredClone(payload)
    return {
      payload: structuredClone(this.payload),
      first_attempt_at: this.firstAttempt,
    }
  }
  async recordAcceptance(_job: ClaimedFollowupJob, id: string) {
    this.mark("accept")
    this.jobs[0].provider_message_id = id
  }
  async complete() {
    this.mark("complete")
    this.jobs = []
  }
  async fail(_job: ClaimedFollowupJob, code: string, ambiguous: boolean) {
    this.mark("fail")
    this.failures.push({ code, ambiguous })
  }
}

function provider(status = 200, body: unknown = { id: "provider_email_1" }) {
  const requests: { url: string; headers: Headers; body: string }[] = []
  const fetcher: typeof fetch = async (url, init) => {
    requests.push({
      url: String(url),
      headers: new Headers(init?.headers),
      body: String(init?.body),
    })
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  }
  return { fetcher, requests }
}

const proofNonce = "abcdabcd-0000-4000-8000-000000000001"
function signedAuthorization(
  issuedAt = Math.floor(instant / 1000),
  nonce = proofNonce,
  key = secret,
) {
  const mac = createHmac("sha256", key).update(`run:${issuedAt}:${nonce}`).digest("hex")
  return `Bearer cadova-v1:${issuedAt}:${nonce}:${mac}`
}

async function invoke(
  backend = new Backend(),
  workerConfig = config,
  fetcher: typeof fetch = provider().fetcher,
  body: unknown = {},
  options: {
    authorization?: string
    method?: string
    now?: number
    timeoutMs?: number
  } = {},
) {
  const response = await createQuoteFollowupHandler(backend, workerConfig, {
    fetch: fetcher,
    now: () => options.now ?? instant,
    timeoutMs: options.timeoutMs,
  })(
    new Request("https://edge.example.test/send-quote-followups", {
      method: options.method ?? "POST",
      headers: { Authorization: options.authorization ?? `Bearer ${secret}` },
      ...(options.method === "GET"
        ? {}
        : { body: typeof body === "string" ? body : JSON.stringify(body) }),
    }),
  )
  return { response, data: await response.json() }
}

test("scheduler auth exacte, obligatoire, sans fallback service-role ni substring", async () => {
  for (const authorization of [
    "",
    `Bearer prefix${secret}`,
    `Bearer ${secret}suffix`,
    `token ${secret}`,
    `Bearer ${secret} extra`,
    "Bearer service-role-key",
  ]) {
    const backend = new Backend()
    const { response } = await invoke(
      backend,
      config,
      provider().fetcher,
      {},
      { authorization },
    )
    assert.equal(response.status, 401)
    assert.deepEqual(backend.calls, [])
  }
  for (const schedulerSecret of [undefined, "", "short"]) {
    const backend = new Backend()
    assert.equal(
      (await invoke(backend, { ...config, schedulerSecret })).response.status,
      503,
    )
    assert.deepEqual(backend.calls, [])
  }
  assert.equal(
    hasSchedulerAuthorization(
      new Request("https://test.invalid", {
        headers: { Authorization: "Bearer anything" },
      }),
      "",
    ),
    false,
  )
})

test("preuve HMAC valide consommée une seule fois avant toute réservation", async () => {
  const backend = new Backend()
  const sender = provider()
  const authorization = signedAuthorization()
  const first = await invoke(
    backend,
    config,
    sender.fetcher,
    { action: "run" },
    { authorization },
  )
  assert.equal(first.response.status, 200)
  assert.equal(first.data.sent, 1)
  assert.equal(backend.calls[0], "nonce")
  assert.deepEqual(backend.consumedProofs, [
    { nonce: proofNonce, issuedAt: Math.floor(instant / 1000) },
  ])
  const beforeReplay = backend.calls.length
  const replay = await invoke(
    backend,
    config,
    sender.fetcher,
    { action: "run" },
    { authorization },
  )
  assert.equal(replay.response.status, 409)
  assert.equal(replay.data.error, "scheduler_proof_already_used")
  assert.deepEqual(backend.calls.slice(beforeReplay), ["nonce"])
  assert.equal(sender.requests.length, 1)
  assert.ok(!JSON.stringify(first.data).includes(secret))
  assert.ok(!JSON.stringify(replay.data).includes(authorization))
})

test("signature HMAC altérée, mauvais secret ou nonce modifié refusés sans appel DB", async () => {
  const valid = signedAuthorization()
  const invalid = [
    signedAuthorization(undefined, undefined, "wrong-signing-key-" + "z".repeat(40)),
    valid.replace(proofNonce, "abcdabcd-0000-4000-8000-000000000002"),
    valid.slice(0, -64) + "0".repeat(64),
    valid + "suffix",
    valid.replace("abcdabcd", "ABCDABCD"),
  ]
  for (const authorization of invalid) {
    const backend = new Backend()
    const sender = provider()
    assert.equal(
      (
        await invoke(
          backend,
          config,
          sender.fetcher,
          { action: "run" },
          { authorization },
        )
      ).response.status,
      401,
    )
    assert.deepEqual(backend.calls, [])
    assert.equal(sender.requests.length, 0)
  }
})

test("fenêtre HMAC de 300 secondes passées et 30 secondes futures, sans horloge renouvelée au replay", async () => {
  const second = Math.floor(instant / 1000)
  for (const [offset, accepted] of [
    [-301, false],
    [-300, true],
    [0, true],
    [30, true],
    [31, false],
  ] as const) {
    const backend = new Backend()
    const sender = provider()
    const { response } = await invoke(
      backend,
      { ...config, emailEnabled: false },
      sender.fetcher,
      { action: "run" },
      { authorization: signedAuthorization(second + offset) },
    )
    assert.equal(response.status, accepted ? 200 : 401)
    assert.equal(backend.consumedProofs.length, accepted ? 1 : 0)
    assert.equal(sender.requests.length, 0)
    assert.ok(!backend.calls.some((call) => call.startsWith("claim:")))
  }
})

test("preuve signée réservée à run, Bearer privé garde health sans consommation de nonce", async () => {
  const backend = new Backend()
  const sender = provider()
  const denied = await invoke(
    backend,
    config,
    sender.fetcher,
    { action: "health" },
    { authorization: signedAuthorization() },
  )
  assert.equal(denied.response.status, 401)
  assert.equal(denied.data.error, "unauthorized_action")
  assert.deepEqual(backend.calls, [])
  const healthy = await invoke(backend, config, sender.fetcher, { action: "health" })
  assert.equal(healthy.response.status, 200)
  assert.equal(backend.consumedProofs.length, 0)
  assert.equal(sender.requests.length, 0)
})

test("run désactivé consomme sa preuve, synchronise le statut et ne prend aucun job", async () => {
  const backend = new Backend()
  const sender = provider()
  const candidate = { ...config, emailEnabled: false, resendApiKey: undefined }
  const authorization = signedAuthorization()
  const { data } = await invoke(
    backend,
    candidate,
    sender.fetcher,
    { action: "run" },
    { authorization },
  )
  assert.equal(data.claimed, 0)
  assert.equal(data.sent, 0)
  assert.deepEqual(backend.calls, [
    "nonce",
    "health:false:false:email_configuration_missing",
  ])
  assert.equal(
    (
      await invoke(
        backend,
        candidate,
        sender.fetcher,
        { action: "run" },
        { authorization },
      )
    ).response.status,
    409,
  )
  assert.equal(sender.requests.length, 0)
})

test("échec de stockage du nonce refuse tout statut, job ou email", async () => {
  const backend = new Backend()
  backend.failAt = "nonce"
  const sender = provider()
  const { response, data } = await invoke(
    backend,
    config,
    sender.fetcher,
    { action: "run" },
    { authorization: signedAuthorization() },
  )
  assert.equal(response.status, 503)
  assert.equal(data.error, "scheduler_proof_unavailable")
  assert.deepEqual(backend.calls, ["nonce"])
  assert.equal(sender.requests.length, 0)
})

test("POST uniquement et JSON borné, sans réservation pour demande invalide", async () => {
  for (const body of ["invalid-json", [], { action: "send" }, "x".repeat(1025)]) {
    const backend = new Backend()
    assert.equal(
      (await invoke(backend, config, provider().fetcher, body)).response.status,
      400,
    )
    assert.deepEqual(backend.calls, [])
  }
  const backend = new Backend()
  assert.equal(
    (await invoke(backend, config, provider().fetcher, {}, { method: "GET" })).response
      .status,
    405,
  )
  assert.deepEqual(backend.calls, [])
})

test("health et configuration absente/désactivée ne consomment aucun job ni n’envoient d’email", async () => {
  for (const candidate of [
    config,
    { ...config, emailEnabled: false },
    { ...config, resendApiKey: undefined },
    { ...config, resendFrom: undefined },
    { ...config, resendFrom: "bad\r\nBcc: hidden@example.test" },
  ]) {
    for (const action of ["health", "run"]) {
      if (candidate === config && action === "run") continue
      const backend = new Backend()
      const sender = provider()
      const { response, data } = await invoke(backend, candidate, sender.fetcher, {
        action,
      })
      assert.equal(response.status, 200)
      assert.equal(data.claimed, 0)
      assert.equal(data.sent, 0)
      assert.equal(backend.calls.length, 1)
      assert.ok(backend.calls[0].startsWith("health:"))
      assert.equal(sender.requests.length, 0)
      assert.ok(!JSON.stringify(data).includes("re_test_key"))
      assert.ok(!JSON.stringify(data).includes("@example.test"))
    }
  }
})

test("un état service indisponible refuse la prise de jobs", async () => {
  const backend = new Backend()
  backend.failAt = "health:true:true:ready"
  const { response, data } = await invoke(backend)
  assert.equal(response.status, 503)
  assert.equal(data.error, "service_status_unavailable")
  assert.equal(backend.calls.length, 1)
  assert.ok(!JSON.stringify(data).includes("private-database"))
})

test("envoi valide : snapshot avant HTTP, Reply-To entreprise, clé stable, historique après acceptation", async () => {
  const backend = new Backend()
  const sender = provider()
  const { response, data } = await invoke(backend, config, sender.fetcher)
  assert.equal(response.status, 200)
  assert.equal(data.sent, 1)
  assert.deepEqual(backend.calls, [
    "health:true:true:ready",
    "claim:5:180",
    "prepare",
    "links",
    "persist",
    "accept",
    "complete",
  ])
  assert.equal(sender.requests.length, 1)
  const request = sender.requests[0]
  assert.equal(request.url, "https://api.resend.com/emails")
  assert.equal(
    request.headers.get("Idempotency-Key"),
    `cadova-quote-followup-${job.id}`,
  )
  assert.equal(request.headers.get("Authorization"), `Bearer ${config.resendApiKey}`)
  const payload = JSON.parse(request.body)
  assert.equal(payload.to, "client@example.test")
  assert.equal(payload.reply_to, "contact@example.test")
  assert.equal(payload.from, config.resendFrom)
  assert.equal(payload.text, backend.prepared.body + portalTextSuffix(portalUrl))
  assert.ok(payload.html.includes(`href="${portalUrl}"`))
  assert.ok(payload.html.includes("<br>"))
  assert.ok(!JSON.stringify(data).includes("client@example.test"))
})

test("une pause, réponse ou expiration revalidée empêche tout HTTP", async () => {
  for (const reason of [
    "paused",
    "response_received",
    "accepted",
    "refused",
    "expired",
  ]) {
    const backend = new Backend()
    backend.prepared = { allowed: false, reason }
    const sender = provider()
    const { data } = await invoke(backend, config, sender.fetcher)
    assert.equal(data.skipped, 1)
    assert.equal(sender.requests.length, 0)
    assert.ok(!backend.calls.includes("persist"))
    assert.ok(!backend.calls.includes("accept"))
  }
})

test("adresses et sujets invalides bloqués avant HTTP", async () => {
  for (const invalid of [
    { recipient_email: "bad\nBcc: x@example.test" },
    { reply_to: "Entreprise <reply@example.test>" },
    { sender: "unconfigured" },
    { subject: "Titre\r\nCc: bad@example.test" },
    { body: "\0bad" },
  ]) {
    const backend = new Backend()
    Object.assign(backend.prepared, invalid)
    const sender = provider()
    await invoke(backend, config, sender.fetcher)
    assert.equal(sender.requests.length, 0)
    assert.deepEqual(backend.failures, [
      { code: "invalid_job_payload", ambiguous: false },
    ])
  }
})

test("contenu utilisateur échappé en HTML, texte conservé, aucun lien HTML interprété", () => {
  const body = `<a href="javascript:alert(1)">ouvrir</a> & 'notes'\r\n<script>bad()</script>`
  const rendered = buildFollowupEmail("Atelier <img src=x onerror=bad()>", body)
  assert.equal(rendered.text, body)
  assert.ok(!rendered.html.includes("<script>"))
  assert.ok(!rendered.html.includes("<a href="))
  assert.ok(!rendered.html.includes("<img"))
  assert.ok(rendered.html.includes("&lt;script&gt;"))
  assert.ok(rendered.html.includes("&amp;"))
  assert.ok(rendered.html.includes("&#39;notes&#39;"))
})

test("un retry conserve octets, clé et premier instant, même après modification du rendu/déploiement", async () => {
  const backend = new Backend()
  const firstSender = provider(500, { message: "private-provider-detail" })
  await invoke(backend, config, firstSender.fetcher)
  assert.deepEqual(backend.failures, [
    { code: "provider_server_error", ambiguous: true },
  ])
  backend.jobs[0].attempts = 2
  backend.prepared.body =
    "Un nouveau rendu ne doit pas changer le payload déjà transmis."
  backend.prepared.company_name = "Autre nom après mise à jour"
  const secondSender = provider()
  await invoke(
    backend,
    { ...config, resendFrom: "Cadova <nouveau@example.test>" },
    secondSender.fetcher,
    {},
    { now: instant + 60000 },
  )
  assert.equal(firstSender.requests[0].body, secondSender.requests[0].body)
  assert.equal(
    firstSender.requests[0].headers.get("Idempotency-Key"),
    secondSender.requests[0].headers.get("Idempotency-Key"),
  )
  assert.equal(backend.firstAttempt, new Date(instant).toISOString())
})

test("acceptation déjà enregistrée : finalisation sans email, même après expiration", async () => {
  const backend = new Backend()
  backend.jobs[0].provider_message_id = "provider_email_accepted"
  const sender = provider()
  const { data } = await invoke(
    backend,
    config,
    sender.fetcher,
    {},
    { now: instant + 48 * 60 * 60 * 1000 },
  )
  assert.equal(data.sent, 1)
  assert.equal(sender.requests.length, 0)
  assert.ok(!backend.calls.includes("prepare"))
  assert.ok(!backend.calls.includes("persist"))
  assert.ok(!backend.calls.includes("accept"))
  assert.ok(backend.calls.includes("complete"))
})

test("échec après acceptation : aucune deuxième transmission dans l’invocation, réconciliation ultérieure", async () => {
  const backend = new Backend()
  backend.failAt = "complete"
  const sender = provider()
  const first = await invoke(backend, config, sender.fetcher)
  assert.equal(sender.requests.length, 1)
  assert.equal(first.data.sent, 0)
  assert.equal(first.data.recording_pending, 1)
  assert.deepEqual(backend.failures, [
    { code: "provider_completion_failed", ambiguous: true },
  ])
  backend.failAt = ""
  const retrySender = provider()
  assert.equal((await invoke(backend, config, retrySender.fetcher)).data.sent, 1)
  assert.equal(retrySender.requests.length, 0)
})

test("réponse 2xx sans identifiant ou JSON invalide : résultat ambigu", async () => {
  for (const fetcher of [
    provider(200, {}).fetcher,
    (async () => new Response("not-json", { status: 200 })) as typeof fetch,
  ]) {
    const backend = new Backend()
    await invoke(backend, config, fetcher)
    assert.deepEqual(backend.failures, [
      { code: "provider_invalid_success", ambiguous: true },
    ])
    assert.ok(!backend.calls.includes("accept"))
    assert.ok(!backend.calls.includes("complete"))
  }
})

test("timeout et réseau interrompu gardent un résultat ambigu", async () => {
  const backend = new Backend()
  await invoke(backend, config, async () => {
    throw new Error("client@example.test secret")
  })
  assert.deepEqual(backend.failures, [
    { code: "provider_network_error", ambiguous: true },
  ])
  const stalled = new Backend()
  const started = Date.now()
  const { data } = await invoke(
    stalled,
    config,
    async () => new Promise<Response>(() => {}),
    {},
    { timeoutMs: 10 },
  )
  assert.ok(Date.now() - started < 500)
  assert.deepEqual(stalled.failures, [{ code: "provider_timeout", ambiguous: true }])
  assert.ok(!JSON.stringify(data).includes("client@example.test"))
})

test("deadline couvre aussi un body qui bloque après réception des headers", async () => {
  const backend = new Backend()
  const response = new Response("{}", { status: 200 })
  response.json = async () => new Promise(() => {})
  await invoke(backend, config, async () => response, {}, { timeoutMs: 10 })
  assert.deepEqual(backend.failures, [{ code: "provider_timeout", ambiguous: true }])
})

test("aucun nouvel envoi automatique à 23h ou au-delà de la fenêtre provider", async () => {
  for (const hours of [23, 24, 48]) {
    const backend = new Backend()
    backend.prepared.first_attempt_at = new Date(instant).toISOString()
    const sender = provider()
    await invoke(
      backend,
      config,
      sender.fetcher,
      {},
      { now: instant + hours * 60 * 60 * 1000 },
    )
    assert.equal(sender.requests.length, 0)
    assert.deepEqual(backend.failures, [
      { code: "idempotency_window_expired", ambiguous: true },
    ])
  }
})

test("conflit concurrent, conflit payload, rate limit et quota traités distinctement", async () => {
  for (const [status, name, code, ambiguous] of [
    [409, "concurrent_idempotent_requests", "provider_concurrent_request", true],
    [409, "invalid_idempotent_request", "provider_payload_mismatch", true],
    [429, "rate_limit_exceeded", "provider_rate_limited", false],
    [429, "daily_quota_exceeded", "provider_quota_exceeded", false],
    [429, "monthly_quota_exceeded", "provider_quota_exceeded", false],
    [401, "validation_error", "provider_authentication_failed", false],
    [403, "validation_error", "provider_authentication_failed", false],
    [422, "validation_error", "provider_rejected", false],
  ] as const) {
    const backend = new Backend()
    const sender = provider(status, { name, message: "private-provider-detail" })
    const { data } = await invoke(backend, config, sender.fetcher)
    assert.deepEqual(backend.failures, [{ code, ambiguous }])
    assert.equal(sender.requests.length, 1)
    assert.ok(!JSON.stringify(data).includes("private-provider-detail"))
  }
})

test("batch et nombre de tentatives bornés avant tout HTTP", async () => {
  for (const variant of ["too_many", "invalid_lease", "sixth_attempt"]) {
    const backend = new Backend()
    if (variant === "too_many")
      backend.jobs = Array.from({ length: 6 }, () => ({ ...job }))
    if (variant === "invalid_lease") backend.jobs[0].lease_token = "untrusted"
    if (variant === "sixth_attempt") backend.jobs[0].attempts = 6
    const sender = provider()
    assert.equal((await invoke(backend, config, sender.fetcher)).response.status, 503)
    assert.equal(sender.requests.length, 0)
  }
})

test("validation réutilisable du sender et de l’URL publique empêche les injections", () => {
  assert.equal(isEmailAddress("contact+cadova@example.test"), true)
  assert.equal(isEmailAddress("name@example.test\r\nBcc: hidden@example.test"), false)
  assert.equal(isEmailSender("Cadova <suivi@example.test>"), true)
  assert.equal(
    isEmailSender("Cadova\r\nBcc: hidden@example.test <suivi@example.test>"),
    false,
  )
  assert.equal(publicHttpsUrl("https://cadova.fr/"), "https://cadova.fr")
  for (const value of [
    "javascript:alert(1)",
    "http://cadova.fr",
    "https://user:password@cadova.fr",
    "https://cadova.fr/#bad",
    "https://cadova.fr/?quote=<script>",
  ])
    assert.equal(publicHttpsUrl(value), null)
})

test("relance refuse un portail indisponible ou externe avant persistance et HTTP", async () => {
  for (const variant of ["unavailable", "external"]) {
    const backend = new Backend()
    if (variant === "unavailable") backend.failAt = "links"
    else backend.linkUrl = portalUrl.replace("www.cadova.fr", "evil.test")
    const sender = provider()
    await invoke(backend, config, sender.fetcher)
    assert.equal(sender.requests.length, 0)
    assert.equal(backend.payload, null)
    assert.deepEqual(backend.failures, [
      { code: "client_link_unavailable", ambiguous: false },
    ])
  }
})

test("relance opt-in réception conserve le même contenu et ne recrée pas de lien à la reprise", async () => {
  const backend = new Backend()
  const first = provider(500, { name: "server_error" })
  await invoke(
    backend,
    { ...config, replyEmailEnabled: true, receiveDomain: "replies.cadova.fr" },
    first.fetcher,
  )
  assert.equal(JSON.parse(first.requests[0].body).reply_to, backend.replyRoute)
  backend.jobs[0].attempts = 2
  backend.failAt = "links"
  const retry = provider()
  await invoke(
    backend,
    { ...config, replyEmailEnabled: false },
    retry.fetcher,
    {},
    { now: instant + 60000 },
  )
  assert.equal(first.requests[0].body, retry.requests[0].body)
  assert.equal(backend.calls.filter((call) => call === "links").length, 1)
  assert.equal(backend.calls.filter((call) => call === "persist").length, 1)
})

test("une origine publique non fiable désactive le worker sans prendre de jobs", async () => {
  const backend = new Backend()
  const sender = provider()
  const { data } = await invoke(
    backend,
    { ...config, publicUrl: "https://evil.test" },
    sender.fetcher,
  )
  assert.equal(data.service.configured, false)
  assert.equal(sender.requests.length, 0)
  assert.ok(!backend.calls.some((call) => call.startsWith("claim:")))
})
