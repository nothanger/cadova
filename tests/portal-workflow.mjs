import assert from "node:assert/strict"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { chromium } from "playwright-core"
import AxeBuilder from "@axe-core/playwright"

const artifacts = new URL("../.cache/portal-workflow/", import.meta.url).pathname
await mkdir(artifacts, { recursive: true })
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:8462"
const config = `${artifacts}vite.stable.config.mjs`
await writeFile(
  config,
  `import { mergeConfig } from "vite"; import original from "../../vite.config.ts"; export default mergeConfig(original, { cacheDir: ".cache/vite/portal-workflow", server: { hmr: false } });`,
)
const server = process.env.TEST_BASE_URL
  ? null
  : spawn("pnpm", ["dev", "--port", "8462", "--config", config], {
      stdio: "ignore",
      detached: true,
      env: {
        ...process.env,
        VITE_SUPABASE_URL: "https://portal-fixture.example.test",
        VITE_SUPABASE_ANON_KEY: "fixture-public-anon",
      },
    })
const fixture = (
  await readFile(new URL("./fixtures/supabase.mjs", import.meta.url), "utf8")
).replace(
  "let session = options.session ? { user } : null",
  "let session = options.session ? { user, access_token: 'fixture-jwt' } : null",
)
const token = "A".repeat(43)
const newToken = "B".repeat(43)
const pdf = await readFile(new URL("./fixtures/document-text.pdf", import.meta.url))
let checks = 0
const errors = []
let browser
function check(actual, expected, description) {
  assert.deepEqual(actual, expected, description)
  checks++
}

try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(base)).ok) break
    } catch {
      /* server startup */
    }
    if (attempt === 59) throw new Error("Vite did not start")
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  })
  async function createPage(options = {}, width = 390) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
      acceptDownloads: true,
    })
    await context.addInitScript(
      (scenario) => {
        window.__scenario = scenario
      },
      { session: false, automation: true, ...options },
    )
    const calls = []
    const messages = []
    const nonces = new Set()
    let status = "sent"
    let link = options.ownerLink
      ? {
          id: "link-fixture",
          created_at: new Date().toISOString(),
          expires_at: "2027-01-01T12:00:00Z",
          revoked_at: null,
        }
      : null
    let ambiguous = false
    const view = () => ({
      quote: {
        reference: "TEST-001",
        company_name: "Entreprise de test",
        company_email: options.noCompanyEmail ? null : "contact+devis?tag@example.test",
        client_name: "Client de test",
        amount_cents: 125050,
        status,
        expires_at: "2026-12-31",
        document_available: options.document !== false,
      },
      link_expires_at: "2027-01-01T12:00:00Z",
      can_respond: options.expiredQuote ? false : true,
      messages,
    })
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url())
      if (
        ["http:", "https:"].includes(url.protocol) &&
        url.origin !== new URL(base).origin
      )
        return route.abort("blockedbyclient")
      return route.fallback()
    })
    await context.route("**/src/lib/supabase.ts", (route) =>
      route.fulfill({ contentType: "application/javascript", body: fixture }),
    )
    await context.route("**/functions/v1/quote-client-portal", async (route) => {
      const request = route.request()
      const body = request.postDataJSON()
      calls.push({
        ...body,
        authorization: request.headers().authorization,
        url: request.url(),
        referer: request.headers().referer,
      })
      const reply = (data, code = 200) =>
        route.fulfill({
          status: code,
          contentType: "application/json",
          body: JSON.stringify(data),
        })
      if (options.unavailable && body.token)
        return reply({ errorCode: "link_unavailable" }, 410)
      if (body.action === "view") return reply(view())
      if (body.action === "download")
        return route.fulfill({ contentType: "application/pdf", body: pdf })
      if (body.action === "respond") {
        check(body.confirmed, true, "Every client action is explicitly confirmed")
        check(/^[0-9a-f-]{36}$/.test(body.nonce), true, "Client send has a UUID nonce")
        if (!nonces.has(body.nonce)) {
          nonces.add(body.nonce)
          messages.push({
            id: body.nonce,
            author: "client",
            kind: body.kind,
            content: body.message,
            created_at: new Date().toISOString(),
          })
          if (body.kind !== "question") status = body.kind
        }
        if (options.ambiguous && !ambiguous) {
          ambiguous = true
          return route.abort("failed")
        }
        return reply(view())
      }
      check(
        request.headers().authorization,
        "Bearer fixture-jwt",
        "Member actions use the current session",
      )
      if (body.action === "inspect") return reply({ link, messages })
      if (body.action === "create") {
        link = {
          id: "new-link-fixture",
          created_at: new Date().toISOString(),
          expires_at: "2027-01-01T12:00:00Z",
          revoked_at: null,
        }
        return reply({ link, token: newToken })
      }
      if (body.action === "revoke") {
        if (link) link.revoked_at = new Date().toISOString()
        return reply({ revoked: true })
      }
      if (body.action === "member_reply") {
        messages.push({
          id: body.nonce,
          author: "company",
          kind: "message",
          content: body.message,
          created_at: new Date().toISOString(),
        })
        return reply({ link, messages })
      }
      return reply({ errorCode: "invalid_request" }, 400)
    })
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    page.on("pageerror", (error) => errors.push(error.message))
    return { page, calls, messages, context }
  }
  async function accessible(page) {
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze()
    check(
      violations.map((entry) => ({
        id: entry.id,
        nodes: entry.nodes.map((node) => node.target),
      })),
      [],
      "Portal is accessible",
    )
  }
  async function visit(page) {
    await page.goto(`${base}/devis/suivi#token=${token}`, { waitUntil: "networkidle" })
    await page.getByRole("heading", { name: "Votre devis TEST-001" }).waitFor()
  }
  async function overflow(page) {
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      "Portal does not overflow",
    )
  }

  for (const width of [320, 390, 768, 1440]) {
    const { page, calls, context } = await createPage({}, width)
    await visit(page)
    check(page.url().includes("/login"), false, "Client needs no account")
    check(
      calls[0].authorization,
      undefined,
      "Public portal never sends the signed-in session",
    )
    check(calls[0].url.includes(token), false, "Token stays out of request URL")
    check(calls[0].referer, undefined, "Portal calls do not send a referrer")
    check(
      (await page.getByText("1 250,50").count()) > 0 ||
        (await page.getByText(/1.*250,50/).count()) > 0,
      true,
      "Exact quote amount shown",
    )
    await overflow(page)
    check(
      await page
        .getByRole("link", { name: "Contacter l’entreprise" })
        .getAttribute("href"),
      `mailto:${encodeURIComponent("contact+devis?tag@example.test")}`,
      "Business contact is encoded without injecting mailto query fields",
    )
    await accessible(page)
    await page.screenshot({ path: `${artifacts}portal-${width}.png`, fullPage: true })
    await context.close()
  }
  const publicFlow = await createPage()
  await visit(publicFlow.page)
  const downloadPromise = publicFlow.page.waitForEvent("download")
  await publicFlow.page.getByRole("button", { name: "Consulter le PDF" }).click()
  check(
    (await downloadPromise).suggestedFilename(),
    "TEST-001.pdf",
    "Download uses quote filename",
  )
  await publicFlow.page
    .getByLabel("Votre question", { exact: false })
    .fill("Pouvez-vous préciser le délai ?")
  await publicFlow.page.getByRole("button", { name: "Envoyer ma question" }).click()
  await publicFlow.page
    .getByRole("status")
    .filter({ hasText: "Votre question a été transmise" })
    .waitFor()
  check(publicFlow.messages.length, 1, "Question appears in the conversation")
  await publicFlow.page
    .getByRole("button", { name: "Accepter le devis", exact: true })
    .click()
  check(
    await publicFlow.page
      .getByRole("button", { name: "Confirmer mon accord" })
      .isDisabled(),
    true,
    "Decision requires explicit confirmation",
  )
  await accessible(publicFlow.page)
  await publicFlow.page
    .getByLabel("J’ai consulté le devis et je confirme mon accord.")
    .check()
  await publicFlow.page.getByRole("button", { name: "Confirmer mon accord" }).click()
  await publicFlow.page
    .getByRole("status")
    .filter({ hasText: "Votre décision a été transmise" })
    .waitFor()
  check(
    await publicFlow.page
      .getByRole("button", { name: "Accepter le devis", exact: true })
      .count(),
    0,
    "Decided quote cannot be decided again",
  )
  check(publicFlow.messages.length, 2, "Question and decision remain visible")
  await publicFlow.context.close()

  const retry = await createPage({ ambiguous: true })
  await visit(retry.page)
  await retry.page
    .getByLabel("Votre question", { exact: false })
    .fill("Question test sans doublon")
  await retry.page.getByRole("button", { name: "Envoyer ma question" }).click()
  await retry.page.getByRole("alert").waitFor()
  await retry.page.getByRole("button", { name: "Envoyer ma question" }).click()
  await retry.page
    .getByRole("status")
    .filter({ hasText: "Votre question a été transmise" })
    .waitFor()
  const attempts = retry.calls.filter((call) => call.action === "respond")
  check(attempts.length, 2, "Interrupted response can be retried")
  check(attempts[0].nonce, attempts[1].nonce, "Retry reuses the same nonce")
  check(retry.messages.length, 1, "Retry cannot duplicate the question")
  await retry.context.close()

  const expired = await createPage({ unavailable: true })
  await expired.page.goto(`${base}/devis/suivi#token=${token}`, {
    waitUntil: "networkidle",
  })
  await expired.page.getByRole("heading", { name: "Devis indisponible" }).waitFor()
  check(
    await expired.page.getByRole("button", { name: "Accepter le devis" }).count(),
    0,
    "Unavailable link exposes no decision",
  )
  await accessible(expired.page)
  await expired.context.close()
  const incomplete = await createPage()
  await incomplete.page.goto(`${base}/devis/suivi#token=incorrect`, {
    waitUntil: "networkidle",
  })
  await incomplete.page.getByRole("heading", { name: "Devis indisponible" }).waitFor()
  check(incomplete.calls.length, 0, "Malformed token is rejected locally")
  await incomplete.context.close()

  const noContact = await createPage({ noCompanyEmail: true, expiredQuote: true })
  await visit(noContact.page)
  check(
    await noContact.page.getByRole("link", { name: "Contacter l’entreprise" }).count(),
    0,
    "No contact is invented when business address is missing",
  )
  check(
    await noContact.page.getByRole("button", { name: "Envoyer ma question" }).count(),
    0,
    "Expired quotes expose no question action",
  )
  await noContact.context.close()

  const owner = await createPage({ session: true, ownerLink: true })
  await owner.page.goto(`${base}/app/quotes/quote-test`, { waitUntil: "networkidle" })
  try {
    await owner.page.getByText("Lien de suivi actif", { exact: true }).waitFor()
  } catch (error) {
    await owner.page.screenshot({
      path: `${artifacts}owner-failure.png`,
      fullPage: true,
    })
    console.error("Owner portal diagnostic", {
      pathname: new URL(owner.page.url()).pathname,
      alerts: await owner.page.getByRole("alert").allTextContents(),
      actions: owner.calls.map((call) => call.action),
      browserErrors: errors,
    })
    throw error
  }
  check(
    await owner.page.getByLabel("Lien privé du suivi client").count(),
    0,
    "Previously generated link cannot be recovered",
  )
  await owner.page
    .getByRole("button", { name: "Créer un nouveau lien", exact: true })
    .click()
  check(
    owner.calls.filter((call) => call.action === "create").length,
    0,
    "Rotation waits for confirmation",
  )
  await owner.page
    .getByRole("button", { name: "Créer le nouveau lien", exact: true })
    .click()
  await owner.page.getByLabel("Lien privé du suivi client").waitFor()
  check(
    await owner.page.getByLabel("Lien privé du suivi client").inputValue(),
    `${base}/devis/suivi#token=${newToken}`,
    "New link is shared via fragment",
  )
  await owner.page
    .getByLabel("Votre réponse", { exact: true })
    .fill("La prestation est prévue la semaine prochaine.")
  await owner.page.getByRole("button", { name: "Publier la réponse" }).click()
  await owner.page
    .getByText("Votre réponse est enregistrée dans les échanges du suivi client.", {
      exact: false,
    })
    .waitFor()
  check(
    owner.messages[0].author,
    "company",
    "Owner answer is added to public conversation",
  )
  await owner.page
    .getByRole("button", { name: "Désactiver les liens", exact: true })
    .click()
  await owner.page
    .getByRole("dialog")
    .getByRole("button", { name: "Désactiver les liens", exact: true })
    .click()
  await owner.page
    .getByText("Tous les liens de suivi de ce devis sont désactivés.")
    .waitFor()
  check(
    await owner.page.getByLabel("Lien privé du suivi client").count(),
    0,
    "Revoked URL is removed immediately",
  )
  await overflow(owner.page)
  await owner.context.close()
  check(errors, [], "No browser runtime errors")
  console.log(`${checks} portal browser checks passed`)
} finally {
  await browser?.close()
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM")
    } catch {
      /* already stopped */
    }
  }
}
