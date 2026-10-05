import assert from "node:assert/strict"
import test from "node:test"
import {
  createQuoteClientPortalHandler,
  PortalRequestError,
  type PortalBackend,
  type PortalMemberAction,
  type PortalMemberInput,
  type PortalPublicInput,
} from "../supabase/functions/quote-client-portal/handler.ts"
import {
  createPortalToken,
  hashPortalToken,
} from "../supabase/functions/quote-client-portal/validation.ts"

const actor = "11111111-1111-4111-8111-111111111111"
const quoteId = "22222222-2222-4222-8222-222222222222"
const linkId = "33333333-3333-4333-8333-333333333333"
const nonce = "44444444-4444-4444-8444-444444444444"
const token = "a".repeat(43)
const now = Date.parse("2026-10-05T12:00:00Z")
const timestamp = new Date(now).toISOString()
const expires = new Date(now + 86400000).toISOString()
const link = {
  id: linkId,
  created_at: timestamp,
  expires_at: expires,
  revoked_at: null,
}
const view = {
  quote: {
    reference: "DEV-1",
    company_name: "Atelier",
    company_email: null,
    client_name: "Client",
    amount_cents: 129900,
    status: "sent",
    expires_at: "2026-11-01",
    document_available: true,
  },
  link_expires_at: expires,
  can_respond: true,
  messages: [
    {
      id: nonce,
      author: "client",
      kind: "question",
      content: "Quand pouvez-vous intervenir ?",
      created_at: timestamp,
    },
  ],
}
const pdf = new TextEncoder().encode(
  "%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF",
)
const path = `${quoteId}/${actor}/${linkId}.pdf`
class Backend implements PortalBackend {
  calls: string[] = []
  identity: { id: string } | null = { id: actor }
  rate = true
  result: unknown = structuredClone(view)
  memberResult: unknown = { link, messages: [] }
  memberError: Error | null = null
  memberInput?: PortalMemberInput
  accessInput?: PortalPublicInput
  digest = ""
  document = { bytes: pdf, mimeType: "application/pdf" }
  async verifyToken(value: string) {
    this.calls.push("verify")
    assert.equal(value, "user-jwt")
    return this.identity
  }
  async member(value: string, action: PortalMemberAction, input: PortalMemberInput) {
    this.calls.push(action)
    assert.equal(value, "user-jwt")
    this.memberInput = input
    if (this.memberError) throw this.memberError
    return action === "create" ? link : this.memberResult
  }
  async consumeRate(key: string, limit: number, seconds: number) {
    assert.ok(key === "portal:global" || /^network:[a-f0-9]{64}$/.test(key))
    assert.ok(limit === 120 || limit === 2000)
    assert.equal(seconds, 60)
    this.calls.push("rate")
    return this.rate
  }
  async access(hash: string, input: PortalPublicInput) {
    this.calls.push("access")
    this.digest = hash
    this.accessInput = input
    return this.result
  }
  async download(value: string) {
    this.calls.push("download")
    assert.equal(value, path)
    return this.document
  }
}
function setup() {
  const backend = new Backend()
  const handler = createQuoteClientPortalHandler(
    backend,
    {
      rateSecret: "test-only-rate-secret-at-least-24",
      allowedOrigins: ["https://cadova.fr"],
    },
    { now: () => now, randomToken: () => token },
  )
  const request = (
    body: unknown,
    authenticated = false,
    origin: string | null = "https://cadova.fr",
  ) =>
    handler(
      new Request("https://edge.example.test/quote-client-portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(origin ? { Origin: origin } : {}),
          ...(authenticated ? { Authorization: "Bearer user-jwt" } : {}),
        },
        body: JSON.stringify(body),
      }),
    )
  return { backend, handler, request }
}
test("256-bit capability generation and hashing never retain plaintext in member RPC", async () => {
  const generated = new Set(Array.from({ length: 20 }, () => createPortalToken()))
  assert.equal(generated.size, 20)
  for (const value of generated) assert.match(value, /^[A-Za-z0-9_-]{43}$/)
  const { backend, request } = setup()
  const response = await request({ action: "create", quoteId }, true)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { link, token })
  assert.equal(backend.memberInput?.tokenHash, await hashPortalToken(token))
  assert.equal(
    backend.memberInput?.expiresAt,
    new Date(now + 30 * 86400000).toISOString(),
  )
  assert.ok(!JSON.stringify(backend.memberInput).includes(token))
})
test("public view strips private server fields, client contact and hashes", async () => {
  const { backend, request } = setup()
  backend.result = {
    ...view,
    notes: "PRIVATE",
    token_hash: "PRIVATE",
    quote: { ...view.quote, notes: "PRIVATE", email: "PRIVATE", company_id: "PRIVATE" },
    messages: view.messages.map((message) => ({
      ...message,
      created_by: "PRIVATE",
      nonce: "PRIVATE",
    })),
  }
  const response = await request({ action: "view", token })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), view)
  assert.equal(backend.digest, await hashPortalToken(token))
  assert.ok(!backend.calls.includes("verify"))
  assert.match(response.headers.get("Cache-Control")!, /no-store/)
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer")
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff")
})
test("public contact only exposes a valid business reply address", async () => {
  for (const companyEmail of [
    "contact+devis@example.test",
    "contact?tag@example.test",
    null,
    undefined,
    "client@example.test\r\nBcc: other@example.test",
    "javascript:alert(1)",
  ]) {
    const { backend, request } = setup()
    backend.result = {
      ...view,
      quote: {
        ...view.quote,
        company_email: companyEmail,
        email: "PRIVATE@example.test",
      },
    }
    const response = await request({ action: "view", token })
    assert.equal(response.status, 200)
    const projection = await response.json()
    assert.equal(
      projection.quote.company_email,
      typeof companyEmail === "string" &&
        companyEmail.endsWith("@example.test") &&
        !companyEmail.includes("\r")
        ? companyEmail
        : null,
    )
    assert.ok(!JSON.stringify(projection).includes("PRIVATE"))
  }
})
test("all management operations require a verified JWT", async () => {
  for (const action of ["inspect", "create", "revoke", "member_reply"]) {
    const { backend, request } = setup()
    const body = {
      action,
      quoteId,
      ...(action === "member_reply" ? { message: "Bonjour", nonce } : {}),
    }
    assert.equal((await request(body)).status, 401)
    assert.equal(backend.calls.length, 0)
    backend.identity = null
    assert.equal((await request(body, true)).status, 401)
    assert.deepEqual(backend.calls, ["verify"])
  }
})
test("member RPC receives caller JWT and cross-tenant denial stays bounded", async () => {
  const { backend, request } = setup()
  backend.memberError = new PortalRequestError("not_allowed", 403)
  const response = await request({ action: "inspect", quoteId }, true)
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { errorCode: "not_allowed" })
  assert.deepEqual(backend.memberInput, { quoteId })
})
test("member inspect strips hashes, private message metadata, and never recovers token", async () => {
  const { backend, request } = setup()
  backend.memberResult = {
    link: { ...link, token_hash: "PRIVATE", token: "PRIVATE" },
    messages: [{ ...view.messages[0], nonce: "PRIVATE", created_by: "PRIVATE" }],
  }
  const response = await request({ action: "inspect", quoteId }, true)
  assert.deepEqual(await response.json(), { link, messages: view.messages })
})
test("malformed input and cross-origin requests never access any data", async () => {
  const invalid = [
    null,
    [],
    { action: "create", quoteId, expiresInDays: 91 },
    { action: "create", quoteId, tokenHash: "bad" },
    { action: "respond", token, kind: "accepted", nonce, confirmed: false },
    {
      action: "respond",
      token,
      kind: "question",
      nonce,
      confirmed: true,
      message: "\u0000bad",
    },
    {
      action: "respond",
      token,
      kind: "question",
      nonce,
      confirmed: true,
      message: "a".repeat(2001),
    },
  ]
  for (const body of invalid) {
    const { backend, request } = setup()
    const result = await request(body, true)
    assert.equal(result.status, 400)
    assert.equal(backend.calls.length, 0)
  }
  const { backend, request } = setup()
  assert.equal(
    (await request({ action: "view", token }, false, "https://evil.example")).status,
    403,
  )
  assert.equal(backend.calls.length, 0)
})
test("stale, revoked, absent and malformed capabilities all produce the same unavailable response", async () => {
  const { backend, request } = setup()
  backend.result = { errorCode: "link_unavailable", details: "private database secret" }
  const revoked = await request({ action: "view", token })
  const malformed = await request({ action: "view", token: "bad" })
  assert.equal(revoked.status, 410)
  assert.equal(malformed.status, 410)
  assert.deepEqual(await revoked.json(), await malformed.json())
})
test("confirmed responses forward trimmed content and the original idempotency nonce", async () => {
  const { backend, request } = setup()
  const response = await request({
    action: "respond",
    token,
    kind: "question",
    message: "  Une question\nmerci  ",
    nonce,
    confirmed: true,
  })
  assert.equal(response.status, 200)
  assert.deepEqual(backend.accessInput, {
    action: "respond",
    kind: "question",
    message: "Une question\nmerci",
    nonce,
    confirmed: true,
  })
})
test("concurrent decisions, invalid nonce reuse and rate limits return actionable codes", async () => {
  for (const [code, status] of [
    ["decision_not_allowed", 409],
    ["nonce_conflict", 409],
    ["rate_limited", 429],
  ] as const) {
    const { backend, request } = setup()
    backend.result = { errorCode: code }
    const response = await request({
      action: "respond",
      token,
      kind: "accepted",
      nonce,
      confirmed: true,
    })
    assert.equal(response.status, status)
    assert.deepEqual(await response.json(), { errorCode: code })
    if (status === 429) assert.equal(response.headers.get("Retry-After"), "60")
  }
})
test("persistent service-side network limit runs before token lookup", async () => {
  const { backend, request } = setup()
  backend.rate = false
  const response = await request({ action: "view", token })
  assert.equal(response.status, 429)
  assert.deepEqual(backend.calls, ["rate"])
})
test("local burst limit prevents unbounded calls even before persistent rate RPC", async () => {
  const { backend, request } = setup()
  for (let index = 0; index < 120; index++)
    assert.equal((await request({ action: "view", token })).status, 200)
  const calls = backend.calls.length
  assert.equal((await request({ action: "view", token })).status, 429)
  assert.equal(backend.calls.length, calls)
})
test("PDF download never reveals storage paths or a durable signed URL", async () => {
  const { backend, request } = setup()
  backend.result = {
    storage_path: path,
    file_name: "Devis été.pdf",
    size_bytes: pdf.length,
    private: "PRIVATE",
  }
  const response = await request({ action: "download", token })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("Content-Type"), "application/pdf")
  assert.match(
    response.headers.get("Content-Disposition")!,
    /Devis%20%C3%A9t%C3%A9\.pdf/,
  )
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), pdf)
  let headerText = ""
  response.headers.forEach((value) => {
    headerText += value
  })
  assert.ok(!headerText.includes(path))
})

test("network churn cannot grow an isolate past its fixed bucket budget", async () => {
  const { backend, handler } = setup()
  for (let index = 0; index < 2000; index++) {
    const response = await handler(
      new Request("https://edge.example.test", {
        method: "POST",
        headers: { "x-forwarded-for": `network-${index}` },
        body: JSON.stringify({ action: "view", token }),
      }),
    )
    assert.equal(response.status, 200)
  }
  const calls = backend.calls.length
  const response = await handler(
    new Request("https://edge.example.test", {
      method: "POST",
      headers: { "x-forwarded-for": "one-more-network" },
      body: JSON.stringify({ action: "view", token }),
    }),
  )
  assert.equal(response.status, 429)
  assert.equal(backend.calls.length, calls)
})
test("missing, oversized, corrupted or substituted PDF never escapes", async () => {
  for (const scenario of ["missing", "path", "size", "content", "type"]) {
    const { backend, request } = setup()
    backend.result = {
      storage_path: path,
      file_name: "Devis.pdf",
      size_bytes: pdf.length,
    }
    if (scenario === "missing") backend.result = { errorCode: "document_unavailable" }
    if (scenario === "path")
      backend.result = {
        storage_path: "../../private",
        file_name: "Devis.pdf",
        size_bytes: pdf.length,
      }
    if (scenario === "size")
      backend.result = {
        storage_path: path,
        file_name: "Devis.pdf",
        size_bytes: 20 * 1024 * 1024,
      }
    if (scenario === "content")
      backend.document = {
        bytes: new TextEncoder().encode("private-file"),
        mimeType: "application/pdf",
      }
    if (scenario === "type") backend.document = { bytes: pdf, mimeType: "text/html" }
    assert.equal((await request({ action: "download", token })).status, 404)
  }
})
test("large and broken body streams fail before authentication or token lookup", async () => {
  const { backend, handler } = setup()
  const response = await handler(
    new Request("https://edge.example.test", {
      method: "POST",
      body: "x".repeat(8193),
    }),
  )
  assert.equal(response.status, 400)
  assert.equal(backend.calls.length, 0)
})
test("unclassified backend errors are never reflected", async () => {
  const { backend, request } = setup()
  backend.memberError = new Error("PRIVATE token secret")
  const response = await request({ action: "inspect", quoteId }, true)
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { errorCode: "portal_unavailable" })
})
