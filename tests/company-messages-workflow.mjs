import assert from "node:assert/strict"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { spawn } from "node:child_process"
import { chromium } from "playwright-core"
import AxeBuilder from "@axe-core/playwright"

const artifacts = new URL("../.cache/company-messages/", import.meta.url).pathname
await mkdir(artifacts, { recursive: true })
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:8473"
const config = `${artifacts}vite.config.mjs`
if (!process.env.TEST_BASE_URL)
  await writeFile(
    config,
    `import {mergeConfig} from "vite";\nimport original from "../../vite.config.ts";\nexport default mergeConfig(original,{cacheDir:".cache/vite/company-messages",server:{hmr:false}});\n`,
  )
const server = process.env.TEST_BASE_URL
  ? null
  : spawn("pnpm", ["exec", "vite", "--port", "8473", "--config", config], {
      stdio: "ignore",
      detached: true,
    })
const [baseFixture, documentFixture, extension] = await Promise.all([
  readFile(new URL("fixtures/supabase.mjs", import.meta.url), "utf8"),
  readFile(new URL("fixtures/document-supabase.mjs", import.meta.url), "utf8"),
  readFile(new URL("fixtures/company-messages.mjs", import.meta.url), "utf8"),
])
let browser
let checks = 0
const pageErrors = []
const external = []
function check(actual, expected, label) {
  assert.deepEqual(actual, expected, label)
  checks++
}
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(base)).ok) break
    } catch {
      /* startup */
    }
    if (attempt === 99) throw new Error("Vite startup failed")
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
      (options) => {
        window.__scenario = options
        if (options.adminSelectedCompany)
          window.sessionStorage.setItem(
            "cadova.admin-company.user-test",
            options.adminSelectedCompany,
          )
      },
      { session: true, automation: true, ...options },
    )
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url())
      if (
        ["http:", "https:"].includes(url.protocol) &&
        url.origin !== new URL(base).origin
      ) {
        external.push(url.origin)
        return route.abort("blockedbyclient")
      }
      return route.fallback()
    })
    await context.route("**/__company-base-fixture.mjs", (route) =>
      route.fulfill({ contentType: "application/javascript", body: baseFixture }),
    )
    await context.route("**/__company-document-fixture.mjs", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: documentFixture.replace(
          "/__document-base-fixture.mjs",
          "/__company-base-fixture.mjs",
        ),
      }),
    )
    await context.route("**/src/lib/supabase.ts", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `${extension}

window.__settingsPreferenceReadFailure = Boolean(window.__scenario.settingsPreferenceReadFailure)
window.__settingsPreferenceWrites = []
const settingsOriginalFrom = supabase.from
supabase.from = (table) => {
  const query = settingsOriginalFrom(table)
  if (table !== "company_members") return query
  const then = query.then
  query.then = function (resolve, reject) {
    if (this.mode === "read" && ["email_followup_reminders", "followup_delay_days, reminder_hour"].includes(this.columns) && window.__settingsPreferenceReadFailure)
      return Promise.resolve({ data: null, error: { message: "Preferences unavailable" } }).then(resolve, reject)
    if (this.mode === "update" && ("followup_delay_days" in this.payload || "email_followup_reminders" in this.payload))
      window.__settingsPreferenceWrites.push(this.payload)
    return then.call(this, resolve, reject)
  }
  return query
}
`,
      }),
    )
    const page = await context.newPage()
    page.on("pageerror", (error) => pageErrors.push(error.message))
    return page
  }
  async function settings(page) {
    await page.goto(`${base}/app/settings#messages`, { waitUntil: "networkidle" })
    await page
      .getByRole("heading", { name: "Messages de l’entreprise", exact: true })
      .waitFor()
    await page.getByText("Personnaliser les messages", { exact: true }).click()
    await page.getByText("Aperçu sur un devis", { exact: true }).click()
    await page.locator("#company-message-subject").waitFor()
  }
  const unknownPreferences = await pageFor({ settingsPreferenceReadFailure: true })
  await unknownPreferences.goto(`${base}/app/settings#mon-suivi`, {
    waitUntil: "networkidle",
  })
  await unknownPreferences
    .getByText(
      "Impossible de charger vos préférences de suivi. Aucune valeur n’a été modifiée.",
      { exact: true },
    )
    .waitFor()
  check(
    await unknownPreferences.getByLabel("Délai avant relance").count(),
    0,
    "Failed preference read never exposes a guessed delay",
  )
  check(
    await unknownPreferences
      .getByRole("button", { name: "Enregistrer", exact: true })
      .count(),
    0,
    "Unknown preferences cannot be saved",
  )
  await unknownPreferences
    .getByText("Résumé quotidien : préférences avancées", { exact: true })
    .click()
  await unknownPreferences
    .getByText("Impossible de lire votre préférence de résumé quotidien. Réessayez.", {
      exact: true,
    })
    .waitFor()
  check(
    await unknownPreferences.getByRole("switch").count(),
    0,
    "Unknown email preference cannot be toggled",
  )
  check(
    await unknownPreferences.evaluate(() => window.__settingsPreferenceWrites.length),
    0,
    "Read failures do not cause writes",
  )
  await unknownPreferences.evaluate(() => {
    window.__settingsPreferenceReadFailure = false
  })
  await unknownPreferences
    .getByRole("button", { name: "Réessayer", exact: true })
    .first()
    .click()
  await unknownPreferences.getByLabel("Délai avant relance").waitFor()
  await unknownPreferences.getByLabel("Délai avant relance").selectOption("7")
  await unknownPreferences
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click()
  check(
    await unknownPreferences.evaluate(
      () => window.__settingsPreferenceWrites[0].followup_delay_days,
    ),
    7,
    "Successful retry enables confirmed preference update",
  )
  await unknownPreferences.context().close()
  for (const width of [320, 390, 768, 1440]) {
    const page = await pageFor({}, width)
    await settings(page)
    check(
      await page.locator("#company-message-subject").inputValue(),
      "Votre devis {{quote_reference}} chez {{company_name}}",
      "Saved template read",
    )
    check(
      await page.locator("#company-message-signature").inputValue(),
      "Ethan Noto\n06 12 34 56 78",
      "Actual signature read",
    )
    check(
      await page
        .getByText("Votre devis TEST-001 chez Entreprise de test", { exact: true })
        .count(),
      1,
      "Preview uses real company and quote",
    )
    check(
      await page
        .getByRole("button", { name: "Enregistrer le modèle", exact: true })
        .isDisabled(),
      true,
      "Unedited template never resaved",
    )
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
      `No overflow at ${width}`,
    )
    check(
      (await new AxeBuilder({ page }).analyze()).violations.map((item) => item.id),
      [],
      `Accessible preferences at ${width}`,
    )
    await page.screenshot({ path: `${artifacts}settings-${width}.png`, fullPage: true })
    await page.context().close()
  }
  const owner = await pageFor({
    noCompanyMessages: true,
    companyMessagesSaveDelay: 300,
  })
  await settings(owner)
  await owner.locator("#company-message-subject").fill("Mon devis {{quote_reference}}")
  await owner
    .locator("#company-message-body")
    .fill("Bonjour {{client_name}}, voici le devis.")
  await owner.getByRole("link", { name: "Entreprise", exact: true }).click()
  await owner.getByLabel("Adresse de réponse").waitFor()
  check(
    await owner.locator("#company-message-subject").isVisible(),
    false,
    "Company section keeps model editor out of the way",
  )
  await owner.getByRole("link", { name: "Messages", exact: true }).click()
  check(
    await owner.locator("#company-message-subject").inputValue(),
    "Mon devis {{quote_reference}}",
    "Changing settings section preserves unsaved template",
  )
  await owner.locator("#company-message-body").fill("Bonjour ")
  await owner.getByRole("button", { name: "Nom du client", exact: true }).click()
  check(
    await owner.locator("#company-message-body").inputValue(),
    "Bonjour {{client_name}}",
    "French variable button inserts in the focused field",
  )
  check(
    await owner.evaluate(() => window.__companyMessageCalls.length),
    0,
    "Inserting variable and changing section never saves or sends",
  )
  await owner
    .locator("#company-message-body")
    .fill("Bonjour {{client_name}}, voici le devis.")
  await owner.locator("#company-message-kind").selectOption("first_followup")
  await owner.locator("#company-message-subject").fill("Un autre objet")
  await owner.locator("#company-message-kind").selectOption("quote_send")
  check(
    await owner.locator("#company-message-subject").inputValue(),
    "Mon devis {{quote_reference}}",
    "Switching kind retains unsaved edits",
  )
  await owner
    .getByRole("button", { name: "Enregistrer le modèle", exact: true })
    .click()
  await owner
    .getByText(
      "Modèle enregistré. Les messages et les relances déjà préparés restent inchangés.",
      { exact: true },
    )
    .waitFor()
  check(
    await owner.evaluate(
      () =>
        window.__companyMessageCalls.filter(
          (call) => call.name === "save_company_message_template",
        ).length,
    ),
    1,
    "Single save RPC",
  )
  check(
    await owner.evaluate(
      () => window.__testStore.company_message_templates[0].company_id,
    ),
    "company-test",
    "Model saved in selected company",
  )
  await owner.locator("#company-message-signature").fill("Ethan\nMon entreprise")
  await owner
    .getByRole("button", { name: "Enregistrer la signature", exact: true })
    .click()
  await owner
    .getByText(
      "Signature enregistrée. Elle sera proposée lors de la préparation des messages.",
      { exact: true },
    )
    .waitFor()
  check(
    await owner.evaluate(
      () => window.__testStore.company_message_profiles[0].email_signature,
    ),
    "Ethan\nMon entreprise",
    "Profile saved as plain text",
  )
  await owner.getByRole("button", { name: "Supprimer le modèle", exact: true }).click()
  check(
    await owner.evaluate(
      () =>
        window.__companyMessageCalls.filter(
          (call) => call.name === "delete_company_message_template",
        ).length,
    ),
    0,
    "Delete requires confirmation",
  )
  await owner.getByRole("button", { name: "Garder le modèle", exact: true }).click()
  check(
    await owner.evaluate(() => window.__testStore.company_message_templates.length),
    1,
    "Cancel preserves model",
  )
  await owner.getByRole("button", { name: "Supprimer le modèle", exact: true }).click()
  await owner.getByRole("button", { name: "Supprimer ce modèle", exact: true }).click()
  await owner
    .getByText("Modèle supprimé. Les messages déjà préparés restent inchangés.", {
      exact: true,
    })
    .waitFor()
  check(
    await owner.evaluate(() => window.__testStore.company_message_templates.length),
    0,
    "Delete only chosen model",
  )
  await owner.context().close()

  const member = await pageFor({ memberRole: "member" })
  await settings(member)
  check(
    await member.locator("#company-message-body").isDisabled(),
    true,
    "Member sees read-only template",
  )
  check(
    await member
      .getByRole("button", { name: "Enregistrer le modèle", exact: true })
      .count(),
    0,
    "Member cannot save templates",
  )
  check(
    await member
      .getByRole("button", { name: "Enregistrer la signature", exact: true })
      .count(),
    0,
    "Member cannot save signature",
  )
  await member.context().close()

  const administrator = await pageFor({
    admin: true,
    adminSelectedCompany: "company-other",
  })
  await settings(administrator)
  check(
    await administrator.locator("#company-message-subject").inputValue(),
    "",
    "Administrator sees only selected company templates",
  )
  check(
    await administrator.locator("#company-message-signature").inputValue(),
    "",
    "Administrator sees only selected company signature",
  )
  await administrator
    .locator("#company-message-subject")
    .fill("Devis {{quote_reference}} pour {{client_name}}")
  await administrator
    .locator("#company-message-body")
    .fill("Voici le devis de {{company_name}}.")
  await administrator
    .getByRole("button", { name: "Enregistrer le modèle", exact: true })
    .click()
  await administrator
    .getByText(
      "Modèle enregistré. Les messages et les relances déjà préparés restent inchangés.",
      { exact: true },
    )
    .waitFor()
  check(
    await administrator.evaluate(
      () => window.__companyMessageCalls[0].args.p_company_id,
    ),
    "company-other",
    "Administrator saves in selected company",
  )
  check(
    await administrator.evaluate(
      () =>
        window.__testStore.company_message_templates.find(
          (row) => row.company_id === "company-test" && row.kind === "quote_send",
        ).subject_template,
    ),
    "Votre devis {{quote_reference}} chez {{company_name}}",
    "Another company template remains unchanged",
  )
  await administrator.context().close()

  const failedSave = await pageFor({ companyMessagesSaveFailure: true })
  await settings(failedSave)
  await failedSave.locator("#company-message-subject").fill("Mon objet modifié")
  await failedSave
    .getByRole("button", { name: "Enregistrer le modèle", exact: true })
    .click()
  await failedSave
    .getByText("Impossible d’enregistrer ce modèle. Réessayez.", { exact: true })
    .waitFor()
  check(
    await failedSave.locator("#company-message-subject").inputValue(),
    "Mon objet modifié",
    "Failed save retains unsaved draft",
  )
  check(
    await failedSave.evaluate(
      () => window.__testStore.company_message_templates[0].subject_template,
    ),
    "Votre devis {{quote_reference}} chez {{company_name}}",
    "Failed save never claims persisted template",
  )
  check(
    await failedSave
      .getByText(
        "Modèle enregistré. Les messages et les relances déjà préparés restent inchangés.",
        { exact: true },
      )
      .count(),
    0,
    "Failed save has no success notice",
  )
  await failedSave.context().close()

  const unavailable = await pageFor({ companyMessagesFailure: true })
  await unavailable.goto(`${base}/app/settings#messages`, { waitUntil: "networkidle" })
  await unavailable
    .getByText(
      "Les modèles et la signature ne sont pas disponibles. Votre message reste inchangé.",
      { exact: true },
    )
    .waitFor()
  check(
    await unavailable
      .getByRole("button", { name: "Enregistrer le modèle", exact: true })
      .count(),
    0,
    "Unavailable preferences are not fake empty models",
  )
  await unavailable.evaluate(() => {
    window.__companyMessageReadFailure = false
  })
  await unavailable.getByRole("button", { name: "Réessayer", exact: true }).click()
  await unavailable.getByText("Personnaliser les messages", { exact: true }).click()
  await unavailable.locator("#company-message-subject").waitFor()
  check(
    await unavailable.locator("#company-message-subject").inputValue(),
    "Votre devis {{quote_reference}} chez {{company_name}}",
    "Failed read can recover",
  )
  await unavailable.context().close()

  const wrong = await pageFor({ wrongCompanyTemplate: true })
  await wrong.goto(`${base}/app/settings#messages`, { waitUntil: "networkidle" })
  await wrong
    .getByText("Le modèle de cette entreprise n’a pas pu être confirmé.", {
      exact: true,
    })
    .waitFor()
  check(
    await wrong.locator("#company-message-subject").count(),
    0,
    "Wrong-tenant model rejected",
  )
  await wrong.context().close()

  const compose = await pageFor({ hasDocument: true, companyMessagesDelay: 1200 })
  await compose.goto(`${base}/app/quotes/draft-test`, { waitUntil: "domcontentloaded" })
  await compose.locator("#quote-message").waitFor()
  await compose.locator("#quote-message").fill("Mon brouillon personnel")
  const documentPanel = compose
    .locator("section,div")
    .filter({
      has: compose.getByRole("heading", { name: "Document et envoi", exact: true }),
    })
    .last()
  const useTemplate = compose
    .getByRole("button", { name: "Utiliser le modèle de l’entreprise", exact: true })
    .first()
  await useTemplate.waitFor()
  check(
    await compose.locator("#quote-message").inputValue(),
    "Mon brouillon personnel",
    "Late preferences never overwrite user edits",
  )
  await useTemplate.click()
  check(
    await compose.locator("#quote-message").inputValue(),
    "Mon brouillon personnel",
    "Preview does not edit message",
  )
  await compose.getByRole("button", { name: "Garder mon message", exact: true }).click()
  check(
    await compose.locator("#quote-message").inputValue(),
    "Mon brouillon personnel",
    "Cancel keeps draft",
  )
  await useTemplate.click()
  await compose
    .getByRole("button", { name: "Appliquer ce modèle", exact: true })
    .click()
  check(
    await compose.locator("#quote-subject").inputValue(),
    "Votre devis TEST-002 chez Entreprise de test",
    "Confirmed template uses actual quote",
  )
  check(
    await compose.locator("#quote-message").inputValue(),
    "Bonjour Client de test,\n\nVotre devis TEST-002 : 100,00 €.\n\nEthan Noto\n06 12 34 56 78",
    "Confirmed template includes saved signature",
  )
  check(
    await compose.evaluate(
      () => window.__documentCalls.filter((call) => call.type === "send").length,
    ),
    0,
    "Applying template never sends email",
  )
  void documentPanel
  await compose.context().close()

  const automatic = await pageFor({ automationState: "active" })
  await automatic.goto(`${base}/app/quotes/quote-test`, { waitUntil: "networkidle" })
  await automatic
    .getByRole("button", { name: "Modifier les réglages", exact: true })
    .click()
  const oldBody = await automatic.locator("#automation-body").inputValue()
  await automatic
    .getByRole("button", { name: "Utiliser le modèle de l’entreprise", exact: true })
    .click()
  await automatic
    .getByRole("button", { name: "Appliquer ce modèle", exact: true })
    .click()
  check(
    (await automatic.locator("#automation-body").inputValue()).includes(
      "{{client_name}}",
    ),
    true,
    "Automatic editor keeps placeholders",
  )
  check(
    (await automatic.locator("#automation-body").inputValue()).endsWith(
      "Ethan Noto\n06 12 34 56 78",
    ),
    true,
    "Automatic future draft includes signature",
  )
  check(
    await automatic.evaluate(
      () => window.__testStore.quote_followup_automations[0].body_template,
    ),
    oldBody,
    "Applying model never silently changes active automation",
  )
  check(
    await automatic.evaluate(
      () =>
        window.__automationCalls.filter(
          (call) => call.name === "save_quote_followup_automation",
        ).length,
    ),
    0,
    "No automation mutation without explicit save",
  )
  await automatic.context().close()

  const frozen = await pageFor({ hasDocument: true, frozenJob: true })
  await frozen.goto(`${base}/app/quotes/draft-test`, { waitUntil: "networkidle" })
  await frozen.locator("#quote-message").waitFor()
  check(
    await frozen.locator("#quote-message").inputValue(),
    "Message figé",
    "In-flight email snapshot stays unchanged",
  )
  check(
    await frozen
      .getByRole("button", { name: "Utiliser le modèle de l’entreprise", exact: true })
      .first()
      .isDisabled(),
    true,
    "Frozen email cannot apply a model",
  )
  await frozen.context().close()
  check(pageErrors, [], "No page runtime errors")
  check(external, [], "No external requests or real emails")
  console.log(`Company message workflow: ${checks} checks passed.`)
} finally {
  if (browser) await browser.close()
  if (server)
    try {
      process.kill(-server.pid, "SIGTERM")
    } catch {
      /* exited */
    }
}
