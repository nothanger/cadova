import assert from "node:assert/strict"
import test from "node:test"
import {
  portalTextSuffix,
  prepareQuoteEmailLinks,
  quotePublicUrl,
  receiveDomain,
  validFrozenQuoteText,
  validQuotePortalUrl,
  type QuoteLinkRpc,
} from "../supabase/functions/_shared/quote-email-links.ts"

const signingKey = "test-only-signing-key-" + "x".repeat(40)
const job = {
  id: "10000000-0000-4000-8000-000000000001",
  lease_token: "20000000-0000-4000-8000-000000000001",
}

test("les liens email sont limités aux origines HTTPS Cadova et aux tokens opaques", () => {
  assert.equal(quotePublicUrl(undefined), "https://www.cadova.fr")
  assert.equal(quotePublicUrl("https://cadova.fr/"), "https://cadova.fr")
  for (const url of [
    "http://cadova.fr",
    "https://127.0.0.1",
    "https://localhost",
    "https://evil.test",
    "https://cadova.fr.evil.test",
    "https://user:password@cadova.fr",
    "https://cadova.fr/path",
    "https://cadova.fr/?token=x",
    "https://cadova.fr/#x",
    "https://www.cadova.fr\n",
  ])
    assert.equal(quotePublicUrl(url), null)
  const portal = `https://www.cadova.fr/devis/suivi#token=${"a".repeat(43)}`
  assert.equal(validQuotePortalUrl(portal), true)
  for (const url of [
    portal + "&other=1",
    portal.replace("www.cadova.fr", "evil.test"),
    portal.replace("https:", "http:"),
    portal.replace("#token=", "?token="),
    portal.replace("devis/suivi", "redirect"),
    portal.slice(0, -1),
    portal + "\n",
  ])
    assert.equal(validQuotePortalUrl(url), false)
})

test("les retries dérivent le même token par job sans exposer la clé ni un UUID dans le lien", async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = []
  const rpc: QuoteLinkRpc = async <T>(name: string, args: Record<string, unknown>) => {
    calls.push({ name, args })
    return {
      token_hash: args.p_token_hash,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    } as T
  }
  const first = await prepareQuoteEmailLinks(
    rpc,
    signingKey,
    "initial",
    job,
    "https://www.cadova.fr",
  )
  const retry = await prepareQuoteEmailLinks(
    rpc,
    signingKey,
    "initial",
    job,
    "https://www.cadova.fr",
  )
  const followup = await prepareQuoteEmailLinks(
    rpc,
    signingKey,
    "followup",
    job,
    "https://www.cadova.fr",
  )
  assert.equal(first.portalUrl, retry.portalUrl)
  assert.notEqual(first.portalUrl, followup.portalUrl)
  assert.ok(validQuotePortalUrl(first.portalUrl))
  assert.ok(!first.portalUrl.includes(job.id) && !first.portalUrl.includes(signingKey))
  assert.equal(calls[0].name, "issue_quote_client_send_link")
  assert.equal(calls[0].args.p_lease_token, job.lease_token)
  assert.match(String(calls[0].args.p_token_hash), /^[a-f0-9]{64}$/)
  assert.equal(first.replyTo, undefined)
})

test("route de réponse reçue seulement après création de lien autorisée et sous bail identique", async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = []
  const route = `q-${"b".repeat(48)}@replies.cadova.fr`
  const rpc: QuoteLinkRpc = async <T>(name: string, args: Record<string, unknown>) => {
    calls.push({ name, args })
    return (
      name === "issue_quote_client_send_link"
        ? {
            token_hash: args.p_token_hash,
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          }
        : route
    ) as T
  }
  const links = await prepareQuoteEmailLinks(
    rpc,
    signingKey,
    "followup",
    job,
    "https://www.cadova.fr",
    "replies.cadova.fr",
  )
  assert.equal(links.replyTo, route)
  assert.equal(calls[1].name, "ensure_quote_send_reply_address")
  assert.equal(calls[1].args.p_job_id, job.id)
  assert.equal(calls[1].args.p_lease_token, job.lease_token)
  for (const domain of [
    "localhost",
    "127.0.0.1",
    "evil.test",
    "cadova.fr.evil.test",
    "https://cadova.fr",
    "replies.cadova.fr\r\nBcc:x",
    " cadova.fr",
    "a..cadova.fr",
  ])
    assert.equal(receiveDomain(domain), null)
})

test("lien expiré, incohérent ou service absent refuse l’enveloppe avant tout fournisseur", async () => {
  const unavailable: QuoteLinkRpc = async () => {
    throw new Error("private service failure")
  }
  await assert.rejects(
    prepareQuoteEmailLinks(
      unavailable,
      signingKey,
      "initial",
      job,
      "https://www.cadova.fr",
    ),
  )
  for (const value of [
    null,
    { token_hash: "wrong", expires_at: new Date(Date.now() + 86400000).toISOString() },
    { expires_at: "bad" },
  ]) {
    const rpc: QuoteLinkRpc = async <T>() => value as T
    await assert.rejects(
      prepareQuoteEmailLinks(rpc, signingKey, "initial", job, "https://www.cadova.fr"),
    )
  }
  let called = false
  const rpc: QuoteLinkRpc = async <T>() => {
    called = true
    return null as T
  }
  await assert.rejects(
    prepareQuoteEmailLinks(rpc, signingKey, "initial", job, "https://evil.test"),
  )
  assert.equal(called, false)
})

test("la réception désactivée en base conserve l’adresse de contact plutôt qu’un Reply-To sans réception", async () => {
  const rpc: QuoteLinkRpc = async <T>(name: string, args: Record<string, unknown>) =>
    (name === "issue_quote_client_send_link"
      ? {
          token_hash: args.p_token_hash,
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        }
      : null) as T
  const links = await prepareQuoteEmailLinks(
    rpc,
    signingKey,
    "initial",
    job,
    "https://www.cadova.fr",
    "replies.cadova.fr",
  )
  assert.equal(links.replyTo, undefined)
  assert.ok(validQuotePortalUrl(links.portalUrl))
})

test("la validation gelée accepte le message ancien ou le CTA exact et refuse une URL substituée", () => {
  const body = "Bonjour, voici le devis."
  const url = `https://www.cadova.fr/devis/suivi#token=${"a".repeat(43)}`
  const html = `<a href="${url}">Consulter mon devis</a>`
  assert.equal(validFrozenQuoteText(body, body, "ancien HTML"), true)
  assert.equal(validFrozenQuoteText(body, body + portalTextSuffix(url), html), true)
  assert.equal(
    validFrozenQuoteText(
      body,
      body + portalTextSuffix(url),
      html.replace("www.cadova.fr", "evil.test"),
    ),
    false,
  )
  assert.equal(
    validFrozenQuoteText(body, body + portalTextSuffix(url) + "autre texte", html),
    false,
  )
})
