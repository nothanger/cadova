import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"
import { createResendEventHandler, type EmailEventBackend, type EmailEventConfig } from "../supabase/functions/resend-events/handler.ts"
import { limitedBytes, mailbox, plainContent, safeReplyHeaders, validReceiveDomain } from "../supabase/functions/resend-events/validation.ts"

const now = Date.parse("2026-10-05T12:00:00.000Z")
const key = Buffer.from("webhook-test-only-key-material")
const secret = `whsec_${key.toString("base64")}`
const route = `q-${"a".repeat(48)}@replies.cadova.test`
const settings: EmailEventConfig = { webhookSecret: secret, resendApiKey: "re_test_private", receivingEnabled: true, receiveDomain: "replies.cadova.test" }
const event = (type = "email.delivered") => ({ type, created_at: new Date(now).toISOString(), data: { email_id: "provider-message-1", from: "Client <client@example.test>", to: [route] } })

class Backend implements EmailEventBackend {
  calls: string[] = []
  deliveries: Parameters<EmailEventBackend["processDelivery"]>[0][] = []
  replies: Parameters<EmailEventBackend["recordReply"]>[0][] = []
  deliveryState: "applied" | "duplicate" | "unmatched" = "applied"
  replyState: "applied" | "duplicate" | "ignored" = "applied"
  failure = false
  async setServiceStatus(delivery: boolean, receiving: boolean) { this.calls.push(`status:${delivery}:${receiving}`); if (this.failure) throw new Error("database-secret") }
  async processDelivery(input: Parameters<EmailEventBackend["processDelivery"]>[0]) { this.calls.push("delivery"); this.deliveries.push(input); return this.deliveryState }
  async recordReply(input: Parameters<EmailEventBackend["recordReply"]>[0]) { this.calls.push("reply"); this.replies.push(input); return this.replyState }
}

function signedRequest(value: unknown, options: { timestamp?: number; eventId?: string; altered?: string; signature?: string; raw?: string } = {}) {
  const raw = options.raw ?? JSON.stringify(value)
  const eventId = options.eventId ?? "msg_test_webhook_1"
  const timestamp = options.timestamp ?? now / 1000
  const signature = options.signature ?? `v1,${createHmac("sha256", key).update(`${eventId}.${timestamp}.${raw}`).digest("base64")}`
  return new Request("https://project.test/functions/v1/resend-events", { method: "POST", headers: { "svix-id": eventId, "svix-timestamp": String(timestamp), "svix-signature": signature }, body: options.altered ?? raw })
}

function provider(value: unknown = { id: "provider-message-1", from: "client@example.test", to: [route], text: "Bonjour, pouvez-vous préciser le délai ?", headers: { "in-reply-to": "<message@example.test>" } }, status = 200) {
  const requests: { url: string; options?: RequestInit }[] = []
  return { requests, fetcher: (async (url, options) => { requests.push({ url: String(url), options }); return new Response(JSON.stringify(value), { status }) }) as typeof fetch }
}

test("signature Svix vérifie le corps brut exact, accepte signatures multiples et refuse corps altéré", async () => {
  const backend = new Backend()
  const handler = createResendEventHandler(backend, settings, { now: () => now })
  const whitespace = `  ${JSON.stringify(event())}\n`
  assert.equal((await handler(signedRequest(event(), { raw: whitespace }))).status, 200)
  assert.equal(backend.deliveries[0].status, "delivered")
  const valid = signedRequest(event()).headers.get("svix-signature")!
  assert.equal((await handler(signedRequest(event(), { signature: `v1,${Buffer.alloc(32).toString("base64")} ${valid}` }))).status, 200)
  const rejected = new Backend()
  assert.equal((await createResendEventHandler(rejected, settings, { now: () => now })(signedRequest(event(), { altered: JSON.stringify(event("email.bounced")) }))).status, 401)
  assert.deepEqual(rejected.calls, [])
})

test("fenêtre anti-rejeu cinq minutes et signatures absentes/malformées échouent avant DB", async () => {
  for (const offset of [-301, 301]) {
    const backend = new Backend()
    const response = await createResendEventHandler(backend, settings, { now: () => now })(signedRequest(event(), { timestamp: now / 1000 + offset }))
    assert.equal(response.status, 401)
    assert.deepEqual(backend.calls, [])
  }
  for (const signature of ["", "v1,invalid", "v2,abc", `v1,${"x".repeat(2050)}`]) {
    const backend = new Backend()
    assert.equal((await createResendEventHandler(backend, settings, { now: () => now })(signedRequest(event(), { signature }))).status, 401)
    assert.deepEqual(backend.calls, [])
  }
})

test("tous statuts reflètent livraison réelle, ouverture et clic ignorés", async () => {
  for (const [type, status] of [["email.sent", "accepted"], ["email.delivery_delayed", "delayed"], ["email.delivered", "delivered"], ["email.bounced", "bounced"], ["email.failed", "failed"], ["email.complained", "complained"]]) {
    const backend = new Backend()
    assert.equal((await createResendEventHandler(backend, settings, { now: () => now })(signedRequest(event(type)))).status, 200)
    assert.equal(backend.deliveries[0].status, status)
  }
  for (const type of ["email.opened", "email.clicked"]) {
    const backend = new Backend()
    const response = await createResendEventHandler(backend, settings, { now: () => now })(signedRequest(event(type)))
    assert.deepEqual(await response.json(), { state: "ignored" })
    assert.deepEqual(backend.calls, [])
  }
})

test("doublon acquitté, provider inconnu réessayable et erreurs internes non divulguées", async () => {
  for (const [state, status] of [["duplicate", 200], ["unmatched", 503]] as const) {
    const backend = new Backend(); backend.deliveryState = state
    assert.equal((await createResendEventHandler(backend, settings, { now: () => now })(signedRequest(event()))).status, status)
  }
  const backend = new Backend(); backend.failure = true
  const response = await createResendEventHandler(backend, settings, { now: () => now })(signedRequest(event()))
  assert.equal(response.status, 503)
  assert.ok(!(await response.text()).includes("database-secret"))
})

test("réception désactivée préserve indisponibilité et n'appelle jamais API receiving", async () => {
  for (const config of [{ ...settings, receivingEnabled: false }, { ...settings, receiveDomain: undefined }, { ...settings, receiveDomain: "https://evil.test" }, { ...settings, resendApiKey: undefined }]) {
    const backend = new Backend(); const remote = provider()
    const response = await createResendEventHandler(backend, config, { now: () => now, fetcher: remote.fetcher })(signedRequest(event("email.received")))
    assert.equal(response.status, 503)
    assert.equal(backend.calls[0], "status:true:false")
    assert.equal(remote.requests.length, 0)
  }
})

test("réponse signée récupère contenu privé depuis API fixe, utilise adresse opaque et jamais le sujet", async () => {
  const backend = new Backend(); const remote = provider()
  const value = { ...event("email.received"), subject: "autre-devis-UUID" }
  const response = await createResendEventHandler(backend, settings, { now: () => now, fetcher: remote.fetcher })(signedRequest(value))
  assert.equal(response.status, 200)
  assert.equal(remote.requests[0].url, "https://api.resend.com/emails/receiving/provider-message-1")
  assert.equal(remote.requests[0].options?.redirect, "error")
  assert.deepEqual(backend.replies[0], { eventId: "msg_test_webhook_1", receivedEmailId: "provider-message-1", recipient: route, from: "client@example.test", content: "Bonjour, pouvez-vous préciser le délai ?", occurredAt: new Date(now).toISOString(), headers: { "in-reply-to": "<message@example.test>" } })
})

test("métadonnées receiving doivent correspondre à signature: autre sender/id/destinataire refusés", async () => {
  for (const received of [
    { id: "different", from: "client@example.test", to: [route], text: "Bonjour" },
    { id: "provider-message-1", from: "attacker@example.test", to: [route], text: "Bonjour" },
    { id: "provider-message-1", from: "client@example.test", to: ["other@replies.cadova.test"], text: "Bonjour" },
  ]) {
    const backend = new Backend()
    assert.equal((await createResendEventHandler(backend, settings, { now: () => now, fetcher: provider(received).fetcher })(signedRequest(event("email.received")))).status, 503)
    assert.equal(backend.replies.length, 0)
  }
  const backend = new Backend()
  assert.equal((await createResendEventHandler(backend, settings, { now: () => now, fetcher: provider({}, 401).fetcher })(signedRequest(event("email.received")))).status, 503)
  assert.equal(backend.replies.length, 0)
})

test("corps HTML et contrôles sont convertis en texte borné; headers arbitraires non persistés", async () => {
  const backend = new Backend()
  const remote = provider({ id: "provider-message-1", from: "client@example.test", to: [route], html: "<style>bad</style><script>secret()</script><p>Bonjour &amp; merci\u0000\u202e</p>", headers: { "In-Reply-To": "<ok>\r\n", Authorization: "secret", "message-id": "x".repeat(3000) } })
  assert.equal((await createResendEventHandler(backend, settings, { now: () => now, fetcher: remote.fetcher })(signedRequest(event("email.received")))).status, 200)
  assert.equal(backend.replies[0].content, "Bonjour & merci")
  assert.equal(backend.replies[0].headers["in-reply-to"], "<ok>")
  assert.equal(backend.replies[0].headers["message-id"].length, 2000)
  assert.equal(backend.replies[0].headers.Authorization, undefined)
  assert.equal(plainContent("x".repeat(5000)).length, 4000)
})

test("destinataires non routés/ambiguës et contenu vide sont ignorés", async () => {
  const backend = new Backend(); const remote = provider()
  const other = event("email.received"); other.data.to = ["contact@cadova.test"]
  assert.equal((await createResendEventHandler(backend, settings, { now: () => now, fetcher: remote.fetcher })(signedRequest(other))).status, 200)
  assert.equal(remote.requests.length, 0)
  const ambiguous = event("email.received"); ambiguous.data.to.push(`q-${"b".repeat(48)}@replies.cadova.test`)
  await createResendEventHandler(backend, settings, { now: () => now, fetcher: remote.fetcher })(signedRequest(ambiguous))
  assert.equal(remote.requests.length, 0)
  const empty = provider({ id: "provider-message-1", from: "client@example.test", to: [route], text: "  " })
  await createResendEventHandler(backend, settings, { now: () => now, fetcher: empty.fetcher })(signedRequest(event("email.received")))
  assert.equal(backend.replies.length, 0)
})

test("bodies limités, JSON malformé et timeout ne provoquent aucun effet", async () => {
  for (const raw of ["not-json", "x".repeat(65537)]) {
    const backend = new Backend()
    assert.equal((await createResendEventHandler(backend, settings, { now: () => now })(signedRequest(null, { raw }))).status, 400)
    assert.deepEqual(backend.calls, [])
  }
  let cancelled = false
  const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; return new Promise<void>(() => {}) } })
  const request = new Request("https://project.test", { method: "POST", body: stream, duplex: "half" } as RequestInit)
  const backend = new Backend()
  assert.equal((await createResendEventHandler(backend, settings, { now: () => now, timeoutMs: 5 })(request)).status, 400)
  assert.equal(cancelled, true)
  assert.deepEqual(backend.calls, [])
  let largeCancelled = false
  await assert.rejects(limitedBytes(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(11)) }, cancel() { largeCancelled = true } }), 10), /limit/)
  assert.equal(largeCancelled, true)
})

test("validators rejettent injection header/domain et préfèrent texte simple", () => {
  assert.equal(mailbox("Client <CLIENT@example.test>"), "client@example.test")
  assert.equal(mailbox("client@example.test\r\nBcc:evil@test.test"), null)
  for (const email of ["client@example.test>", "Client <client@example.test", `${"x".repeat(65)}@example.test`]) assert.equal(mailbox(email), null)
  assert.equal(validReceiveDomain("replies.cadova.fr"), true)
  for (const domain of ["localhost", "replies.cadova.fr/", "replies.cadova.fr:443", "..cadova.fr", "https://cadova.fr"]) assert.equal(validReceiveDomain(domain), false)
  assert.deepEqual(safeReplyHeaders({ "X-Client": "ignored" }), {})
})

test("configuration absente, future data et id malformé refusés sans backend", async () => {
  const noSecret = new Backend()
  assert.equal((await createResendEventHandler(noSecret, { ...settings, webhookSecret: undefined })(signedRequest(event()))).status, 503)
  assert.deepEqual(noSecret.calls, [])
  for (const input of [
    { ...event(), created_at: new Date(now + 301000).toISOString() },
    { ...event(), data: { email_id: "../other" } },
    { ...event(), created_at: "not-a-date" },
  ]) {
    const backend = new Backend()
    assert.equal((await createResendEventHandler(backend, settings, { now: () => now })(signedRequest(input))).status, 400)
    assert.deepEqual(backend.calls, [])
  }
})

test("timeouts provider/bodyreceiving et responses tropgrosses sont retryables sansréponse enregistrée", async () => {
  for (const fetcher of [
    (async () => new Promise<Response>(() => {})) as typeof fetch,
    (async () => new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode("{")) } }))) as typeof fetch,
    provider({ id: "provider-message-1", html: "x".repeat(262145) }).fetcher,
  ]) {
    const backend = new Backend()
    const started = Date.now()
    const response = await createResendEventHandler(backend, settings, { now: () => now, fetcher, timeoutMs: 20 })(signedRequest(event("email.received")))
    assert.equal(response.status, 503)
    assert.ok(Date.now() - started < 1000)
    assert.equal(backend.replies.length, 0)
  }
})
