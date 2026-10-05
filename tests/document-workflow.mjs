import assert from "node:assert/strict"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { Buffer } from "node:buffer"
import { chromium } from "playwright-core"
import AxeBuilder from "@axe-core/playwright"

const fixtures = new URL("./fixtures/", import.meta.url)
const artifacts = new URL("../.cache/document-workflow/", import.meta.url).pathname
await mkdir(artifacts, { recursive: true })
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:8460"
const config = `${artifacts}vite.stable.config.mjs`
if (!process.env.TEST_BASE_URL) {
  // Parallel browser suites need separate Vite optimization caches. Reusing
  // node_modules/.vite causes one server to reload another server's open forms.
  await writeFile(
    config,
    `import { mergeConfig } from "vite";
import original from "../../vite.config.ts";
export default mergeConfig(original, { cacheDir: ".cache/vite/document-workflow", server: { hmr: false } });
`,
  )
}
const server = process.env.TEST_BASE_URL
  ? null
  : spawn("pnpm", ["dev", "--port", "8460", "--config", config], {
      stdio: "ignore",
      detached: true,
    })
const [baseFixture, documentFixture, pdf, photo, secondPdf] = await Promise.all([
  readFile(new URL("supabase.mjs", fixtures), "utf8"),
  readFile(new URL("document-supabase.mjs", fixtures), "utf8"),
  readFile(new URL("document-text.pdf", fixtures)),
  readFile(new URL("document-photo.png", fixtures)),
  readFile(new URL("document-second.pdf", fixtures)),
])
await mkdir(artifacts, { recursive: true })
let browser
let checks = 0
const pageErrors = []
const externalRequests = []
const diagnostics = new WeakMap()

function check(actual, expected, message) {
  assert.deepEqual(actual, expected, message)
  checks++
}

try {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      if ((await fetch(base)).ok) break
    } catch {
      /* startup */
    }
    if (attempt === 39) throw Error("Vite failed to start")
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  })

  async function pageFor(options = {}, width = 390) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    })
    await context.addInitScript(
      (value) => {
        window.__scenario = value
      },
      { session: true, empty: true, automation: true, ...options },
    )
    // Every external request is blocked, including any accidental live provider call.
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url())
      if (
        ["http:", "https:"].includes(url.protocol) &&
        url.origin !== new URL(base).origin
      ) {
        externalRequests.push(url.origin)
        return route.abort("blockedbyclient")
      }
      return route.fallback()
    })
    await context.route("**/__document-base-fixture.mjs", (route) =>
      route.fulfill({ contentType: "application/javascript", body: baseFixture }),
    )
    await context.route("**/src/lib/supabase.ts", (route) =>
      route.fulfill({ contentType: "application/javascript", body: documentFixture }),
    )
    await context.route("**/__document-input.pdf", (route) =>
      route.fulfill({ contentType: "application/pdf", body: pdf }),
    )
    await context.route("**/__document-input.png", (route) =>
      route.fulfill({ contentType: "image/png", body: photo }),
    )
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    page.on("pageerror", (error) => pageErrors.push(error.message))
    const entries = []
    diagnostics.set(page, entries)
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) entries.push(`navigation: ${frame.url()}`)
    })
    page.on("console", (message) => {
      if (message.text().includes("[vite]")) entries.push(message.text())
    })
    return page
  }

  async function visitNew(page) {
    await page.goto(`${base}/app/quotes/new`, { waitUntil: "networkidle" })
    await page.getByRole("heading", { name: "Nouveau devis", exact: true }).waitFor()
  }

  async function accessible(page) {
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze()
    check(
      violations.map((entry) => ({
        id: entry.id,
        targets: entry.nodes.map((node) => node.target),
      })),
      [],
      "Accessible document form",
    )
  }

  async function importPdf(page) {
    await page
      .getByLabel("Choisir le document du devis", { exact: true })
      .setInputFiles({
        name: "devis-test.pdf",
        mimeType: "application/pdf",
        buffer: pdf,
      })
    try {
      await page.waitForFunction(
        () => document.querySelector("#reference")?.value === "DEV2026-015",
        undefined,
        { timeout: 45000 },
      )
    } catch (error) {
      console.error("PDF import diagnostic:", {
        alerts: await page.getByRole("alert").allTextContents(),
        pageErrors,
        url: page.url(),
        lifecycle: diagnostics.get(page),
        status: await page.getByRole("status").allTextContents(),
      })
      await page.screenshot({ path: `${artifacts}import-failure.png`, fullPage: true })
      throw error
    }
    check(
      await page.locator("#amount").inputValue(),
      "1250.50",
      "The real PDF TTC, not HT, is extracted",
    )
    check(
      (await page.locator("#sent_at").count())
        ? await page.locator("#sent_at").inputValue()
        : "",
      "",
      "PDF issue date is never a send date",
    )
  }

  async function ownState(page) {
    return page.evaluate(() => ({
      clients: window.__testStore.clients.filter(
        (entry) => entry.company_id === "company-test",
      ),
      quotes: window.__testStore.quotes.filter(
        (entry) => entry.company_id === "company-test",
      ),
      documents: window.__testStore.quote_documents,
      calls: window.__documentCalls,
      storedFiles: window.__documentFiles.size,
      initialJobs: window.__testStore.quote_initial_send_jobs,
      events: window.__testStore.quote_events,
      notifications: window.__testStore.notifications,
    }))
  }

  // Real reader verification: PDF.js text extraction, local OCR and conversion.
  const readerPage = await pageFor({}, 1280)
  await visitNew(readerPage)
  for (const [path, name, type] of [
    ["/__document-input.pdf", "devis.pdf", "application/pdf"],
    ["/__document-input.png", "photo.png", "image/png"],
  ]) {
    const result = await readerPage.evaluate(
      async ({ path, name, type }) => {
        const { prepareQuoteDocument } =
          await import("/src/features/quotes/import/documentReader.ts")
        const bytes = await (await fetch(path)).arrayBuffer()
        const output = await prepareQuoteDocument(
          new window.File([bytes], name, { type }),
        )
        return {
          fields: output.fields,
          warnings: output.warnings,
          type: output.pdf.type,
          signature: await output.pdf.slice(0, 5).text(),
          previewType: output.preview.type,
          size: output.pdf.size,
        }
      },
      { path, name, type },
    )
    check(
      result.fields.reference,
      "DEV2026-015",
      `${name}: reference from real document`,
    )
    check(result.fields.amount, "1250.50", `${name}: correct TTC`)
    check(
      result.fields.clientEmail,
      "client@example.test",
      `${name}: client email, not issuer email`,
    )
    check(result.fields.clientName, "Ethan Noto", `${name}: client name`)
    check(
      result.fields.clientPhone?.replace(/\D/g, ""),
      "0612345678",
      `${name}: client phone`,
    )
    check(result.fields.expiresAt, "2026-11-04", `${name}: explicit validity date`)
    check(result.type, "application/pdf", `${name}: persisted PDF format`)
    check(result.signature, "%PDF-", `${name}: actual PDF bytes`)
    check(
      Object.hasOwn(result.fields, "sent_at"),
      false,
      `${name}: no invented send date`,
    )
    assert.ok(result.size > 100 && result.previewType.startsWith("image/"))
    checks++
    console.log(`PASS: real extraction ${name}`)
  }
  const refusal = await readerPage.evaluate(async () => {
    const { prepareQuoteDocument } =
      await import("/src/features/quotes/import/documentReader.ts")
    try {
      await prepareQuoteDocument(
        new window.File(["plain text disguised as a PDF"], "invalid.pdf", {
          type: "application/pdf",
        }),
      )
    } catch (error) {
      return error.message
    }
    return null
  })
  assert.match(refusal, /Format non reconnu/)
  checks++
  const limits = await readerPage.evaluate(async () => {
    const { prepareQuoteDocument } =
      await import("/src/features/quotes/import/documentReader.ts")
    const controller = new window.AbortController()
    controller.abort()
    const outcomes = []
    for (const [file, options] of [
      [
        new window.File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf", {
          type: "application/pdf",
        }),
        {},
      ],
      [
        new window.File(["%PDF-test"], "cancelled.pdf", { type: "application/pdf" }),
        { signal: controller.signal },
      ],
    ]) {
      try {
        await prepareQuoteDocument(file, options)
        outcomes.push(null)
      } catch (error) {
        outcomes.push({ name: error.name, message: error.message })
      }
    }
    return outcomes
  })
  assert.match(limits[0].message, /dépasse 10 Mo/)
  checks++
  check(limits[1].name, "AbortError", "Cancelled reader does not continue importing")
  await readerPage.context().close()

  // A real PDF with conflicting totals and recipients never chooses values for
  // the user. Corrections are compared to the original and saved as a draft.
  const uncertain = await pageFor()
  await visitNew(uncertain)
  const { PDFDocument } = await import("pdf-lib")
  const conflictingPdf = await PDFDocument.create()
  const conflictingPage = conflictingPdf.addPage([595, 842])
  ;[
    "Devis DEV-REVIEW-101",
    "Client : Claire Martin",
    "claire@example.test",
    "compta@example.test",
    "Objet : travaux",
    "Total TTC : 1200,00 EUR",
    "Total TTC : 1400,00 EUR",
    "Validite : 30 jours",
  ].forEach((line, index) =>
    conflictingPage.drawText(line, { x: 40, y: 780 - index * 22, size: 12 }),
  )
  await uncertain
    .getByLabel("Choisir le document du devis", { exact: true })
    .setInputFiles({
      name: "ambiguous.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await conflictingPdf.save()),
    })
  await uncertain.waitForFunction(
    () => document.querySelector("#reference")?.value === "DEV-REVIEW-101",
  )
  check(
    await uncertain.locator("#amount").inputValue(),
    "",
    "Contradictory totals stay empty",
  )
  check(
    await uncertain.locator("#client_email").inputValue(),
    "",
    "Conflicting recipient addresses stay empty",
  )
  check(
    await uncertain.locator("#expires_at").inputValue(),
    "",
    "A validity duration is never guessed into a date",
  )
  check(
    await uncertain.getByText("À vérifier", { exact: true }).count(),
    3,
    "Only uncertain required information and explicit validity are flagged",
  )
  await uncertain
    .getByRole("button", { name: "Comparer montant ttc au document", exact: true })
    .click()
  const sourcePassages = await uncertain
    .locator("#quote-document-comparison")
    .textContent()
  check(
    sourcePassages.includes("1200,00") && sourcePassages.includes("1400,00"),
    true,
    "Both original totals are available for comparison",
  )
  await uncertain.getByRole("button", { name: "Retour au champ", exact: true }).click()
  await uncertain.locator("#amount").fill("1400,00")
  await uncertain.locator("#client_email").fill("claire@example.test")
  await uncertain.locator("#expires_at").fill("2026-11-04")
  check(
    await uncertain.getByText("À vérifier", { exact: true }).count(),
    0,
    "Manual corrections resolve the review flags",
  )
  check(
    await uncertain.getByText("Vérifié", { exact: true }).count(),
    3,
    "Corrected information is marked verified",
  )
  await accessible(uncertain)
  await uncertain
    .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
    .click()
  await uncertain
    .getByRole("heading", { name: "DEV-REVIEW-101", exact: true })
    .waitFor()
  const correctedState = await ownState(uncertain)
  check(
    correctedState.quotes.at(-1).amount_cents,
    140000,
    "The reviewed amount is stored exactly",
  )
  check(
    correctedState.calls.filter((call) => call.type === "edge").length,
    0,
    "Reviewing and saving never sends an email",
  )
  await uncertain.context().close()

  // A user with no clients can import, confirm and create one client + draft.
  for (const width of [320, 390, 1280]) {
    const page = await pageFor({}, width)
    await visitNew(page)
    await importPdf(page)
    await page.getByRole("button", { name: "Nouveau client", exact: true }).click()
    check(
      await page.locator("#client_name").inputValue(),
      "Ethan Noto",
      "Imported client name",
    )
    check(
      await page.getByLabel("Email du client", { exact: true }).inputValue(),
      "client@example.test",
      "Imported recipient",
    )
    await page
      .getByRole("button", { name: "Comparer montant ttc au document", exact: true })
      .click()
    check(
      (await page.locator("#quote-document-comparison").textContent()).includes(
        "1 250,50",
      ),
      true,
      "Review exposes the real TTC source passage",
    )
    check(
      (await page.locator("details").getAttribute("open")) !== null,
      true,
      "Comparison opens the source document",
    )
    await page.getByRole("button", { name: "Retour au champ", exact: true }).click()
    check(
      await page
        .locator("#amount")
        .evaluate((input) => input === document.activeElement),
      true,
      "Source comparison returns keyboard focus to the amount",
    )
    await page
      .getByRole("button", { name: "Confirmer montant ttc", exact: true })
      .click()
    check(
      await page.getByText("Vérifié", { exact: true }).count(),
      1,
      "An imported amount can be explicitly reviewed",
    )
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      `No overflow at ${width}px`,
    )
    await accessible(page)
    await page.screenshot({ path: `${artifacts}import-${width}.png`, fullPage: true })
    await page
      .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
      .click()
    await page.getByRole("heading", { name: "DEV2026-015", exact: true }).waitFor()
    const state = await ownState(page)
    check(state.clients.length, 1, "One new client")
    check(state.quotes.length, 1, "One saved quote")
    check(state.quotes[0].status, "draft", "Import stays a draft")
    check(state.quotes[0].sent_at, null, "No initial send recorded by import")
    check(state.quotes[0].amount_cents, 125050, "Amount stored as cents")
    check(state.documents.length, 1, "One document attached")
    check(
      state.calls.filter((call) => call.type === "edge").length,
      0,
      "Import never sends email",
    )
    await page.context().close()
    console.log(`PASS: draft import ${width}px`)
  }

  async function draftFor(page) {
    await visitNew(page)
    await importPdf(page)
    await page
      .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
      .click()
    await page.getByRole("heading", { name: "DEV2026-015", exact: true }).waitFor()
    await page.locator("#quote-recipient").waitFor()
    check(
      await page.locator("#quote-recipient").inputValue(),
      "client@example.test",
      "Confirmed imported contact becomes the suggested recipient",
    )
  }

  async function previewSend(page, name = "Vérifier avant d’envoyer") {
    await page.getByRole("button", { name, exact: true }).click()
    await page.getByRole("dialog").waitFor()
    check(
      (await ownState(page)).calls.filter((call) => call.type === "edge").length,
      0,
      "Preview never sends email",
    )
    check(
      await page
        .getByRole("dialog")
        .getByText("client@example.test", { exact: true })
        .count(),
      1,
      "Preview names the confirmed recipient",
    )
    await accessible(page)
  }

  // Explicit preview and final confirmation, PDF download and single send at all widths.
  for (const width of [320, 390, 1280]) {
    const sending = await pageFor({ documentSendDelay: 300 }, width)
    await draftFor(sending)
    const downloadEvent = sending.waitForEvent("download")
    await sending.getByRole("button", { name: "Télécharger", exact: true }).click()
    const download = await downloadEvent
    check(
      download.suggestedFilename(),
      "devis-test.pdf",
      "Private download preserves original PDF name",
    )
    check(
      await readFile(await download.path()),
      pdf,
      "Private download preserves every original PDF byte",
    )
    await previewSend(sending)
    check(
      await sending.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      `Send preview has no overflow at ${width}px`,
    )
    await sending.screenshot({
      path: `${artifacts}send-preview-${width}.png`,
      fullPage: true,
    })
    await sending
      .getByRole("button", { name: "Revenir au message", exact: true })
      .click()
    check(
      (await ownState(sending)).initialJobs.length,
      0,
      "Closing preview creates no send job",
    )
    await sending
      .getByRole("button", { name: "Vérifier avant d’envoyer", exact: true })
      .click()
    await sending
      .getByRole("button", { name: "Envoyer le devis", exact: true })
      .evaluate((button) => {
        button.click()
        button.click()
      })
    await sending
      .getByRole("status")
      .filter({ hasText: "Le service email a accepté" })
      .waitFor()
    const sentState = await ownState(sending)
    check(
      sentState.calls.filter((call) => call.type === "edge").length,
      1,
      "Final double click sends one request",
    )
    check(sentState.initialJobs.length, 1, "One initial send job")
    check(sentState.quotes[0].status, "sent", "Accepted send updates quote status")
    check(
      sentState.initialJobs[0].recipient_email,
      "client@example.test",
      "Send uses explicitly previewed recipient",
    )
    check(
      sentState.events.filter((entry) => entry.event_type === "sent").length,
      1,
      "One persisted sent event",
    )
    check(
      await sending.getByText("Devis envoyé", { exact: true }).count(),
      1,
      "Accepted initial send appears once in the visible history",
    )
    check(
      sentState.notifications.filter((entry) => entry.type === "quote_sent").length,
      1,
      "One sent notification",
    )
    check(
      await sending
        .getByRole("button", { name: "Vérifier avant d’envoyer", exact: true })
        .count(),
      0,
      "Sent quote cannot send its initial email again",
    )
    check(
      sentState.calls.filter((call) => call.name === "set_quote_followup_automation")
        .length,
      0,
      "Initial send never silently enables automatic follow-ups",
    )
    await accessible(sending)
    await sending.context().close()
    console.log(`PASS: preview and send ${width}px`)
  }

  // Known provider rejection remains a draft; an explicit retry reuses the same job.
  const rejected = await pageFor({ documentSendMode: "failed" })
  await draftFor(rejected)
  await previewSend(rejected)
  await rejected.getByRole("button", { name: "Envoyer le devis", exact: true }).click()
  await rejected.getByRole("status").filter({ hasText: "domaine d’envoi" }).waitFor()
  const rejectedState = await ownState(rejected)
  check(
    rejectedState.quotes[0].status,
    "draft",
    "Provider refusal never marks quote sent",
  )
  check(
    rejectedState.quotes[0].sent_at,
    null,
    "Provider refusal never invents a send date",
  )
  check(
    rejectedState.events.filter((entry) => entry.event_type === "sent").length,
    0,
    "No sent event for a rejected send",
  )
  await rejected
    .getByRole("button", { name: "Vérifier et réessayer", exact: true })
    .click()
  await rejected.getByRole("button", { name: "Envoyer le devis", exact: true }).click()
  await rejected
    .getByRole("status")
    .filter({ hasText: "Le service email a accepté" })
    .waitFor()
  const retriedState = await ownState(rejected)
  check(retriedState.initialJobs.length, 1, "Explicit retry uses one initial job")
  check(
    retriedState.initialJobs[0].attempts,
    2,
    "Explicit retry records its second attempt",
  )
  check(
    retriedState.calls.filter((call) => call.type === "edge")[1].body.retry,
    true,
    "Retry is explicit at API boundary",
  )
  await rejected.context().close()

  // An ambiguous send freezes recipient/message, refreshes without sending and resumes safely.
  const ambiguous = await pageFor({ documentSendMode: "unknown" })
  await draftFor(ambiguous)
  await previewSend(ambiguous)
  await ambiguous.getByRole("button", { name: "Envoyer le devis", exact: true }).click()
  await ambiguous
    .getByRole("status")
    .filter({ hasText: "L’envoi reste à confirmer" })
    .waitFor()
  check(
    await ambiguous.locator("#quote-recipient").isDisabled(),
    true,
    "Unknown delivery freezes recipient",
  )
  check(
    await ambiguous.locator("#quote-message").isDisabled(),
    true,
    "Unknown delivery freezes original message",
  )
  check(
    (await ownState(ambiguous)).quotes[0].status,
    "draft",
    "Unknown result never claims the quote was sent",
  )
  await ambiguous
    .getByRole("button", { name: "Actualiser l’état", exact: true })
    .click()
  check(
    (await ownState(ambiguous)).calls.filter((call) => call.type === "edge").length,
    1,
    "Metadata refresh never sends another email",
  )
  await ambiguous
    .getByRole("button", { name: "Vérifier et reprendre l’envoi", exact: true })
    .click()
  await ambiguous
    .getByRole("button", { name: "Reprendre cet envoi", exact: true })
    .click()
  await ambiguous
    .getByRole("status")
    .filter({ hasText: "Le service email a accepté" })
    .waitFor()
  const resumedState = await ownState(ambiguous)
  check(
    resumedState.initialJobs.length,
    1,
    "Ambiguous reconciliation uses the original job",
  )
  const ambiguousCalls = resumedState.calls.filter((call) => call.type === "edge")
  check(
    { ...ambiguousCalls[1].body, retry: false },
    ambiguousCalls[0].body,
    "Ambiguous retry keeps the identical original payload",
  )
  await ambiguous.context().close()

  // After the provider deduplication window, ambiguity cannot trigger a fresh send.
  const expired = await pageFor({
    documentSendMode: "unknown",
    documentFirstAttemptAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  })
  await draftFor(expired)
  await previewSend(expired)
  await expired.getByRole("button", { name: "Envoyer le devis", exact: true }).click()
  await expired
    .getByText("Contactez l’administrateur pour vérifier cet envoi", { exact: false })
    .waitFor()
  check(
    await expired
      .getByRole("button", { name: "Vérifier et reprendre l’envoi", exact: true })
      .count(),
    0,
    "Expired ambiguous send has no resend button",
  )
  check(
    (await ownState(expired)).calls.filter((call) => call.type === "edge").length,
    1,
    "Expired ambiguity never starts a new email",
  )
  await expired.context().close()

  // Even a lost HTTP response is resolved by persisted state, not a second send.
  const lostResponse = await pageFor({ documentSendResponseFailure: true })
  await draftFor(lostResponse)
  await previewSend(lostResponse)
  await lostResponse
    .getByRole("button", { name: "Envoyer le devis", exact: true })
    .click()
  await lostResponse
    .getByRole("status")
    .filter({ hasText: "Le service email a accepté" })
    .waitFor()
  check(
    (await ownState(lostResponse)).calls.filter((call) => call.type === "edge").length,
    1,
    "Lost response reconciles state with no duplicate send",
  )
  await lostResponse.context().close()

  for (const options of [{ automationConfigured: false }, { serviceReady: false }]) {
    const unavailable = await pageFor(options)
    await draftFor(unavailable)
    check(
      await unavailable
        .getByRole("button", { name: "Vérifier avant d’envoyer", exact: true })
        .isDisabled(),
      true,
      "Sending requires reply address and available email service",
    )
    check(
      (await ownState(unavailable)).calls.filter((call) => call.type === "edge").length,
      0,
      "Missing configuration never attempts sending",
    )
    await unavailable.context().close()
  }

  // Replacing a scanned document discards only untouched inferred values.
  for (const options of [{}, { empty: false }]) {
    const replacement = await pageFor(options)
    await visitNew(replacement)
    await importPdf(replacement)
    await replacement
      .getByRole("button", { name: "Retirer le document", exact: true })
      .click()
    check(
      await replacement.locator("#reference").inputValue(),
      "",
      "Removing the first document clears its inferred reference",
    )
    check(
      await replacement.locator("#amount").inputValue(),
      "",
      "Removing the first document clears its inferred amount",
    )
    check(
      await replacement.locator("#expires_at").inputValue(),
      "",
      "Removing the first document clears its inferred expiry",
    )
    if (options.empty === false)
      check(
        await replacement.locator("#client_id").inputValue(),
        "",
        "Removing the first document clears its inferred existing-client selection",
      )
    else
      check(
        await replacement.locator("#client_email").inputValue(),
        "",
        "Removing the first document clears its inferred new-client email",
      )
    await replacement
      .getByLabel("Choisir le document du devis", { exact: true })
      .setInputFiles({
        name: "second.pdf",
        mimeType: "application/pdf",
        buffer: secondPdf,
      })
    await replacement.waitForFunction(
      () => document.querySelector("#reference")?.value === "DEV2026-099",
      undefined,
      { timeout: 45000 },
    )
    check(
      await replacement.locator("#amount").inputValue(),
      "600.00",
      "The second PDF supplies its own TTC",
    )
    check(
      await replacement.locator("#expires_at").inputValue(),
      "2026-12-15",
      "The second PDF supplies its own expiry",
    )
    check(
      await replacement.locator("#client_name").inputValue(),
      "Claire Martin",
      "The second PDF supplies its own client",
    )
    check(
      await replacement.locator("#client_email").inputValue(),
      "claire@example.test",
      "The second PDF supplies its own recipient",
    )
    await replacement
      .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
      .click()
    await replacement
      .getByRole("heading", { name: "DEV2026-099", exact: true })
      .waitFor()
    const replacedState = await ownState(replacement)
    check(
      replacedState.quotes.at(-1).amount_cents,
      60000,
      "Saving second PDF uses second amount",
    )
    check(
      replacedState.documents[0].file_name,
      "second.pdf",
      "Saving second PDF stores matching attachment",
    )
    await replacement.context().close()
  }
  const kept = await pageFor()
  await visitNew(kept)
  await importPdf(kept)
  await kept.locator("#reference").fill("")
  await kept.locator("#reference").fill("DEV2026-015") // Retyping the same value is now user-confirmed.
  await kept.locator("#amount").fill("75,50")
  await kept.locator("#client_name").fill("Client validé")
  await kept.locator("#client_email").fill("confirmed@example.test")
  await kept.getByRole("button", { name: "Retirer le document", exact: true }).click()
  check(
    await kept.locator("#reference").inputValue(),
    "DEV2026-015",
    "User-confirmed reference survives removal",
  )
  check(
    await kept.locator("#amount").inputValue(),
    "75,50",
    "Manually corrected amount survives removal",
  )
  check(
    await kept.locator("#client_email").inputValue(),
    "confirmed@example.test",
    "Manually confirmed recipient survives removal",
  )
  await kept.getByLabel("Choisir le document du devis", { exact: true }).setInputFiles({
    name: "second.pdf",
    mimeType: "application/pdf",
    buffer: secondPdf,
  })
  await kept
    .getByRole("button", { name: "Retirer le document", exact: true })
    .waitFor({ timeout: 45000 })
  check(
    await kept.locator("#reference").inputValue(),
    "DEV2026-015",
    "Replacing document preserves user-confirmed reference",
  )
  check(
    await kept.locator("#amount").inputValue(),
    "75,50",
    "Replacing document preserves manually corrected amount",
  )
  check(
    await kept.locator("#client_name").inputValue(),
    "Client validé",
    "Replacing document preserves manually selected client",
  )
  check(
    await kept.locator("#client_email").inputValue(),
    "confirmed@example.test",
    "Replacing document preserves manually confirmed recipient",
  )
  await kept.context().close()

  // An in-flight send from an old workspace cannot replace the current screen.
  const scopedSend = await pageFor({ admin: true, documentSendDelay: 1800 }, 1280)
  await scopedSend
    .context()
    .addInitScript(() =>
      window.sessionStorage.setItem("cadova.admin-company.user-test", "company-test"),
    )
  await draftFor(scopedSend)
  await scopedSend
    .getByRole("button", { name: "Vérifier avant d’envoyer", exact: true })
    .click()
  await scopedSend
    .getByRole("button", { name: "Envoyer le devis", exact: true })
    .click()
  await scopedSend
    .getByRole("link", { name: "Changer d’entreprise", exact: true })
    .evaluate((anchor) => anchor.click())
  await scopedSend
    .getByRole("heading", { name: "Administration", exact: true })
    .waitFor()
  await scopedSend.getByRole("button", { name: "Entreprises", exact: true }).click()
  await scopedSend
    .getByRole("button", { name: "Ouvrir l’entreprise Autre entreprise", exact: true })
    .click()
  await scopedSend
    .getByRole("heading", { name: "Tableau de bord", exact: true })
    .waitFor()
  await scopedSend.waitForFunction(
    () => window.__documentCalls.find((call) => call.type === "edge")?.completed,
  )
  check(
    await scopedSend.getByRole("heading", { name: "DEV2026-015", exact: true }).count(),
    0,
    "Old send response cannot navigate into a different workspace",
  )
  check(
    await scopedSend.getByRole("dialog").count(),
    0,
    "Old send preview never survives workspace change",
  )
  check(
    await scopedSend.evaluate(() =>
      window.__testStore.quotes.some(
        (quote) =>
          quote.company_id === "company-other" && quote.reference === "DEV2026-015",
      ),
    ),
    false,
    "Old send never writes a quote to the newly selected company",
  )
  await scopedSend.context().close()

  // Existing manually entered drafts can attach their original PDF later.
  const attachLater = await pageFor({ empty: false })
  await attachLater.goto(`${base}/app/quotes/draft-test`, { waitUntil: "networkidle" })
  await attachLater.getByRole("heading", { name: "TEST-002", exact: true }).waitFor()
  await attachLater
    .getByLabel("Ajouter le PDF du devis", { exact: true })
    .setInputFiles({
      name: "false.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("not a PDF"),
    })
  await attachLater
    .getByRole("alert")
    .filter({ hasText: "Choisissez un PDF valide" })
    .waitFor()
  check(
    (await ownState(attachLater)).storedFiles,
    0,
    "An invalid later attachment never uploads bytes",
  )
  await attachLater
    .getByLabel("Ajouter le PDF du devis", { exact: true })
    .setInputFiles({ name: "original.pdf", mimeType: "application/pdf", buffer: pdf })
  await attachLater
    .getByRole("button", { name: "Vérifier avant d’envoyer", exact: true })
    .waitFor()
  check(
    (await ownState(attachLater)).documents[0].quote_id,
    "draft-test",
    "Later attachment belongs to existing draft",
  )
  check(
    (await ownState(attachLater)).calls.filter((call) => call.type === "edge").length,
    0,
    "Attaching a PDF never sends it automatically",
  )
  await attachLater
    .getByRole("button", { name: "Vérifier avant d’envoyer", exact: true })
    .click()
  await attachLater
    .getByRole("button", { name: "Envoyer le devis", exact: true })
    .click()
  await attachLater
    .getByRole("status")
    .filter({ hasText: "Le service email a accepté" })
    .waitFor()
  check(
    (await ownState(attachLater)).initialJobs.length,
    1,
    "An existing draft can send the attached original PDF",
  )
  await attachLater.context().close()

  // Already sent is a record-only action: never call an email Edge function.
  const alreadySent = await pageFor()
  await visitNew(alreadySent)
  await importPdf(alreadySent)
  await alreadySent.getByRole("button", { name: "Déjà envoyé", exact: true }).click()
  await alreadySent.locator("#sent_at").fill("2026-10-03")
  await alreadySent
    .getByRole("button", { name: "Enregistrer le devis envoyé", exact: true })
    .click()
  await alreadySent.getByRole("heading", { name: "DEV2026-015", exact: true }).waitFor()
  const recorded = await ownState(alreadySent)
  check(recorded.quotes[0].status, "sent", "Already-sent status recorded")
  check(recorded.quotes[0].sent_at, "2026-10-03", "Confirmed historical send date")
  check(
    recorded.calls.filter((call) => call.type === "edge").length,
    0,
    "Already-sent never invokes email delivery",
  )
  check(recorded.initialJobs.length, 0, "Already-sent never creates initial email job")
  check(
    await alreadySent
      .getByRole("button", { name: "Vérifier avant d’envoyer", exact: true })
      .count(),
    0,
    "Already-sent quote has no initial send button",
  )
  await alreadySent.context().close()

  // Existing client matched by exact company-scoped email, without overwriting it.
  const matched = await pageFor({ empty: false })
  await visitNew(matched)
  await importPdf(matched)
  check(
    await matched.locator("#client_id").count(),
    0,
    "Exact email requires an explicit choice before selecting an existing client",
  )
  check(
    await matched.getByText("Même adresse email", { exact: true }).count(),
    1,
    "Suggestion explains the matching coordinate",
  )
  await matched
    .getByRole("button", { name: "Utiliser Client de test", exact: true })
    .click()
  check(
    await matched.locator("#client_id").inputValue(),
    "client-test",
    "Confirmed match selects the company client",
  )
  await matched
    .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
    .click()
  await matched.getByRole("heading", { name: "DEV2026-015", exact: true }).waitFor()
  const matchedState = await ownState(matched)
  check(matchedState.clients.length, 1, "Matching does not duplicate the client")
  check(
    matchedState.clients[0].name,
    "Client de test",
    "Existing client identity is preserved",
  )
  check(
    matchedState.quotes.at(-1).client_id,
    "client-test",
    "Saved quote uses confirmed matching client",
  )
  await matched.context().close()

  // Submit twice while the save is in flight: a single import request and file.
  const doubled = await pageFor({ documentDelay: 350 })
  await visitNew(doubled)
  await importPdf(doubled)
  await doubled
    .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
    .evaluate((button) => {
      button.click()
      button.click()
    })
  await doubled.getByRole("heading", { name: "DEV2026-015", exact: true }).waitFor()
  const doubledState = await ownState(doubled)
  check(
    doubledState.calls.filter((call) => call.name === "save_imported_quote").length,
    1,
    "Single save request despite double click",
  )
  check(
    doubledState.calls.filter((call) => call.type === "upload").length,
    1,
    "Single document upload",
  )
  check(doubledState.quotes.length, 1, "Single quote created")
  await doubled.context().close()

  // Reference collision must leave both client and quote counts unchanged.
  const duplicate = await pageFor({ empty: false })
  await visitNew(duplicate)
  await duplicate.evaluate(() =>
    window.__testStore.quotes.push({
      ...window.__testStore.quotes[0],
      id: "quote-duplicate-test",
      reference: "DEV2026-015",
    }),
  )
  await importPdf(duplicate)
  await duplicate.getByRole("button", { name: "Nouveau client", exact: true }).click()
  await duplicate.locator("#client_name").fill("Client qui ne doit pas être créé")
  await duplicate.locator("#client_email").fill("new-client@example.test")
  await duplicate.locator("#client_phone").fill("")
  await duplicate
    .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
    .click()
  await duplicate
    .getByRole("alert")
    .filter({ hasText: /référence.*existe déjà/i })
    .waitFor()
  const duplicateState = await ownState(duplicate)
  check(
    duplicateState.clients.length,
    1,
    "Duplicate reference never leaves an orphan client",
  )
  check(duplicateState.quotes.length, 3, "Duplicate reference never creates a quote")
  check(
    duplicateState.calls.filter((call) => call.type === "edge").length,
    0,
    "No email on duplicate reference",
  )
  await duplicate.context().close()

  // Recording a past send always requires a confirmed, non-future date.
  const dates = await pageFor()
  await visitNew(dates)
  await importPdf(dates)
  await dates.getByRole("button", { name: "Déjà envoyé", exact: true }).click()
  await dates
    .getByRole("button", { name: "Enregistrer le devis envoyé", exact: true })
    .click()
  await dates.getByRole("alert").filter({ hasText: "Indiquez la date" }).waitFor()
  check(
    (await ownState(dates)).calls.length,
    0,
    "No upload, save or email without confirmed sent date",
  )
  await dates.locator("#sent_at").fill("2099-01-01")
  await dates
    .getByRole("button", { name: "Enregistrer le devis envoyé", exact: true })
    .click()
  await dates
    .getByRole("alert")
    .filter({ hasText: "ne peut pas être dans le futur" })
    .waitFor()
  check(
    (await ownState(dates)).calls.length,
    0,
    "Future send date never records an already-sent quote",
  )
  await dates.getByRole("button", { name: "Déjà envoyé", exact: true }).click()
  await dates
    .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
    .click()
  await dates.getByRole("heading", { name: "DEV2026-015", exact: true }).waitFor()
  check(
    (await ownState(dates)).quotes[0].sent_at,
    null,
    "Switching back to draft discards the hidden send date",
  )
  await dates.context().close()

  // User-entered fields remain authoritative when OCR arrives later.
  const manual = await pageFor()
  await visitNew(manual)
  await manual.locator("#reference").fill("MON-DEVIS-42")
  await manual.locator("#amount").fill("900,25")
  await manual.locator("#client_name").fill("Client confirmé")
  await manual.locator("#client_email").fill("confirmed@example.test")
  await manual
    .getByLabel("Choisir le document du devis", { exact: true })
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: photo })
  await manual
    .getByRole("button", { name: "Retirer le document", exact: true })
    .waitFor({ timeout: 45000 })
  check(
    await manual.locator("#reference").inputValue(),
    "MON-DEVIS-42",
    "OCR preserves manually entered reference",
  )
  check(
    await manual.locator("#amount").inputValue(),
    "900,25",
    "OCR preserves manually entered amount",
  )
  check(
    await manual.locator("#client_name").inputValue(),
    "Client confirmé",
    "OCR preserves manually confirmed client",
  )
  check(
    await manual.locator("#client_email").inputValue(),
    "confirmed@example.test",
    "OCR never replaces confirmed recipient",
  )
  await manual.context().close()

  // Confirmed storage / database failures keep fields and leave no business record.
  for (const scenario of [
    { documentUploadFailure: true },
    { documentSaveFailure: true },
  ]) {
    const failed = await pageFor(scenario)
    await visitNew(failed)
    await importPdf(failed)
    await failed
      .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
      .click()
    await failed.getByRole("alert").waitFor()
    const failedState = await ownState(failed)
    check(failedState.quotes.length, 0, "A rejected import does not create a quote")
    check(
      failedState.clients.length,
      0,
      "A rejected import does not create an orphan client",
    )
    check(
      failedState.storedFiles,
      scenario.documentSaveFailure ? 1 : 0,
      "Rejected uploads store nothing; rejected database saves leave one private staged file for service cleanup",
    )
    check(
      await failed.locator("#reference").inputValue(),
      "DEV2026-015",
      "Failed save keeps confirmed fields",
    )
    check(
      failedState.calls.filter((call) => call.type === "edge").length,
      0,
      "Failed import never sends email",
    )
    await failed.context().close()
  }

  // Cancellation during actual local OCR loading leaves a usable manual form.
  const cancelled = await pageFor()
  await visitNew(cancelled)
  await cancelled.route("**/document-reader/ocr/worker.min.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400))
    await route.continue().catch(() => {})
  })
  await cancelled
    .getByLabel("Choisir le document du devis", { exact: true })
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: photo })
  await cancelled
    .getByRole("button", { name: "Annuler la lecture", exact: true })
    .click()
  await cancelled
    .getByRole("button", { name: "Importer un PDF ou une image", exact: true })
    .waitFor()
  check(
    await cancelled.locator("#reference").inputValue(),
    "",
    "Cancelled OCR does not fill quote fields",
  )
  check(
    (await ownState(cancelled)).calls.length,
    0,
    "Cancelled OCR never uploads or sends a file",
  )
  await cancelled.context().close()

  // A response from an old form cannot navigate into or prefill a new company.
  const scoped = await pageFor({ admin: true, documentDelay: 1800 }, 1280)
  await scoped
    .context()
    .addInitScript(() =>
      window.sessionStorage.setItem("cadova.admin-company.user-test", "company-test"),
    )
  await visitNew(scoped)
  await importPdf(scoped)
  await scoped
    .getByRole("button", { name: "Enregistrer le brouillon", exact: true })
    .click()
  await scoped.getByRole("link", { name: "Changer d’entreprise", exact: true }).click()
  await scoped.getByRole("heading", { name: "Administration", exact: true }).waitFor()
  await scoped.getByRole("button", { name: "Entreprises", exact: true }).click()
  await scoped
    .getByRole("button", { name: "Ouvrir l’entreprise Autre entreprise", exact: true })
    .click()
  await scoped.getByRole("heading", { name: "Tableau de bord", exact: true }).waitFor()
  await scoped.getByRole("link", { name: "Devis", exact: true }).click()
  await scoped.getByRole("link", { name: "Nouveau devis", exact: true }).click()
  await scoped.getByRole("heading", { name: "Nouveau devis", exact: true }).waitFor()
  await scoped.waitForFunction(
    () =>
      window.__documentCalls.find((call) => call.name === "save_imported_quote")
        ?.completed,
  )
  check(
    await scoped.evaluate(() =>
      window.__testStore.quotes.some(
        (quote) =>
          quote.company_id === "company-other" && quote.reference === "DEV2026-015",
      ),
    ),
    false,
    "An old save never writes to the newly selected company",
  )
  check(
    await scoped.locator("#reference").inputValue(),
    "",
    "Company change discards old form fields",
  )
  check(
    await scoped
      .getByRole("button", { name: "Retirer le document", exact: true })
      .count(),
    0,
    "Company change discards old document preview",
  )
  check(
    await scoped.locator("#client_id option").allTextContents(),
    ["Sélectionner un client…", "Client autre entreprise · client-other@example.test"],
    "Only new company clients remain selectable",
  )
  await scoped.context().close()

  check(pageErrors, [], "No browser runtime errors")
  check(externalRequests, [], "No external provider/CDN requests")
  console.log(`PASS: ${checks} document workflow checks; artifacts ${artifacts}`)
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
