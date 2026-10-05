import assert from "node:assert/strict"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { spawn } from "node:child_process"
import { chromium } from "playwright-core"
import AxeBuilder from "@axe-core/playwright"

const artifacts = new URL("../.cache/workspace-actions/", import.meta.url).pathname
await mkdir(artifacts, { recursive: true })
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:8462"
const config = `${artifacts}vite.config.mjs`
if (!process.env.TEST_BASE_URL)
  await writeFile(
    config,
    `import { mergeConfig } from "vite";\nimport original from "../../vite.config.ts";\nexport default mergeConfig(original, { cacheDir: ".cache/vite/workspace-actions", server: { hmr: false } });\n`,
  )
const server = process.env.TEST_BASE_URL
  ? null
  : spawn("pnpm", ["exec", "vite", "--port", "8462", "--config", config], {
      stdio: "ignore",
      detached: true,
    })
const [fixture, extension] = await Promise.all([
  readFile(new URL("./fixtures/supabase.mjs", import.meta.url), "utf8"),
  readFile(new URL("./fixtures/workspace-actions.mjs", import.meta.url), "utf8"),
])
let browser
let checks = 0
const errors = []
const external = []
function check(actual, expected, label) {
  assert.deepEqual(actual, expected, label)
  checks++
}

try {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      if ((await fetch(base)).ok) break
    } catch {
      /* startup */
    }
    if (attempt === 79) throw new Error("Vite failed to start")
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
      (scenario) => {
        window.__scenario = scenario
      },
      { session: true, ...options },
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
    await context.route("**/__workspace-base-fixture.mjs", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: fixture,
      }),
    )
    await context.route("**/src/lib/supabase.ts", (route) =>
      route.fulfill({ contentType: "application/javascript", body: extension }),
    )
    const page = await context.newPage()
    page.on("pageerror", (error) => errors.push(error.message))
    return page
  }
  async function dashboard(page) {
    await page.goto(`${base}/app`, { waitUntil: "networkidle" })
    await page
      .getByRole("heading", { name: "À faire aujourd’hui", exact: true })
      .waitFor()
  }
  for (const width of [320, 390, 768, 1280]) {
    const page = await pageFor({ workspace: "standard" }, width)
    await dashboard(page)
    const panel = page.getByRole("region", { name: "À faire aujourd’hui", exact: true })
    check(
      await panel.getByText("Répondre au client", { exact: true }).count(),
      1,
      "Unanswered question",
    )
    check(
      await panel.getByText("Vérifier l’envoi", { exact: true }).count(),
      1,
      "Bounced delivery",
    )
    check(
      await panel.getByText("Préparer la relance", { exact: true }).count(),
      1,
      "Only manual quote due",
    )
    check(
      await panel.getByText("Vérifier la pause", { exact: true }).count(),
      1,
      "Pause is explicit",
    )
    check(
      await panel.getByText("Relance automatique", { exact: true }).count(),
      1,
      "Automatic calendar",
    )
    check(
      await panel.getByRole("link", { name: "Lire la question" }).getAttribute("href"),
      "/app/quotes/question-quote",
      "Direct question action",
    )
    check(
      await panel.getByRole("link", { name: "Voir l’envoi" }).getAttribute("href"),
      "/app/quotes/bounced-quote",
      "Direct delivery action",
    )
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      "No horizontal overflow",
    )
    const reads = await page.evaluate(() =>
      window.__workspaceQueries.filter((query) =>
        [
          "quotes",
          "quote_followup_automations",
          "quote_client_messages",
          "quote_email_deliveries",
          "company_email_settings",
          "quote_events",
          "quote_initial_send_jobs",
        ].includes(query.table),
      ),
    )
    check(
      reads.every((query) =>
        query.filters.some(
          ([key, value]) => key === "company_id" && value === "company-test",
        ),
      ),
      true,
      "Every dashboard read is scoped",
    )
    if (width === 390) {
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
      check(
        violations.map((violation) => ({
          id: violation.id,
          targets: violation.nodes.map((node) => node.target),
        })),
        [],
        "Accessible dashboard",
      )
      await page.screenshot({
        path: `${artifacts}dashboard-mobile.png`,
        fullPage: true,
      })
    }
    if (width === 1280)
      await page.screenshot({
        path: `${artifacts}dashboard-desktop.png`,
        fullPage: true,
      })
    await page.context().close()
  }
  for (const status of ["preparing", "processing", "delivery_unknown", "failed"]) {
    const page = await pageFor({
      workspace: "send-unresolved",
      workspaceSendStatus: status,
    })
    await dashboard(page)
    const panel = page.getByRole("region", { name: "À faire aujourd’hui", exact: true })
    check(
      await panel
        .getByRole("link", { name: "Voir l’envoi", exact: true })
        .getAttribute("href"),
      "/app/quotes/quote-test",
      `${status}: inspect actual job`,
    )
    check(
      await panel
        .getByRole("link", { name: "Ouvrir le brouillon", exact: true })
        .count(),
      0,
      `${status}: no new-send suggestion`,
    )
    check(
      await panel.getByText("Préparer la relance", { exact: true }).count(),
      0,
      `${status}: no followup suggestion`,
    )
    check(
      await page
        .getByText(
          "Envoyez le devis ou indiquez qu’il est déjà envoyé, puis choisissez une date de rappel ou les relances automatiques.",
          { exact: true },
        )
        .count(),
      0,
      `${status}: guide does not encourage sending again`,
    )
    if (["preparing", "processing"].includes(status))
      check(
        await panel
          .getByText(
            "Un envoi est en cours. Attendez son résultat avant une nouvelle tentative.",
            { exact: true },
          )
          .count(),
        1,
        `${status}: explains waiting`,
      )
    if (status === "delivery_unknown")
      check(
        await panel
          .getByText(
            "Le résultat de l’envoi est incertain. Vérifiez le dossier avant toute nouvelle tentative.",
            { exact: true },
          )
          .count(),
        1,
        "Uncertain send stays uncertain",
      )
    await page.context().close()
  }
  const guide = await pageFor({
    empty: true,
    automation: true,
    automationConfigured: false,
  })
  await dashboard(guide)
  await guide.getByRole("heading", { name: "Vos premières étapes" }).waitFor()
  check(
    await guide
      .getByRole("link", { name: "Renseigner l’adresse" })
      .getAttribute("href"),
    "/app/settings",
    "Real first incomplete step",
  )
  await guide.getByRole("button", { name: "Masquer le guide" }).click()
  await guide.reload({ waitUntil: "networkidle" })
  await guide.getByRole("button", { name: "Afficher le guide de démarrage" }).waitFor()
  check(
    await guide.evaluate(() =>
      window.localStorage.getItem("cadova.getting-started.user-test.company-test"),
    ),
    "hidden",
    "Dismissal is per user/company",
  )
  await guide.getByRole("button", { name: "Afficher le guide de démarrage" }).click()
  await guide.getByRole("link", { name: "Renseigner l’adresse" }).click()
  await guide.getByRole("heading", { name: "Paramètres", exact: true }).waitFor()
  await guide.getByLabel("Adresse de réponse").fill("contact@example.test")
  await guide.getByRole("button", { name: "Enregistrer les coordonnées email" }).click()
  await guide
    .getByRole("status")
    .filter({ hasText: "L’adresse de réponse a été enregistrée." })
    .waitFor()
  await guide.getByRole("button", { name: "Ouvrir le menu", exact: true }).click()
  await guide.getByRole("link", { name: "Tableau de bord", exact: true }).click()
  await guide.getByRole("link", { name: "Importer un devis", exact: true }).waitFor()
  check(
    await guide
      .getByRole("link", { name: "Importer un devis", exact: true })
      .getAttribute("href"),
    "/app/quotes/new",
    "Contact save advances real step",
  )
  await guide.context().close()

  const unavailable = await pageFor({
    workspace: "standard",
    workspaceFailure: "quote_followup_automations",
  })
  await dashboard(unavailable)
  await unavailable
    .getByRole("status")
    .filter({ hasText: "La liste peut être incomplète" })
    .waitFor()
  check(
    await unavailable
      .getByRole("region", { name: "À faire aujourd’hui" })
      .getByText("Préparer la relance", { exact: true })
      .count(),
    0,
    "Do not guess while automation unavailable",
  )
  check(
    await unavailable
      .getByText(
        "Les relances à préparer ne peuvent pas être confirmées pour le moment.",
      )
      .count(),
    1,
    "Metrics do not claim complete zero",
  )
  await unavailable.evaluate(() => {
    window.__workspaceFailure = null
  })
  await unavailable.getByRole("button", { name: "Réessayer les vérifications" }).click()
  await unavailable.getByText("Préparer la relance", { exact: true }).waitFor()
  check(
    await unavailable
      .getByText("La liste peut être incomplète", { exact: false })
      .count(),
    0,
    "Retry clears unavailability",
  )
  await unavailable.context().close()

  const unknownSend = await pageFor({
    workspace: "standard",
    workspaceFailure: "quote_initial_send_jobs",
  })
  await dashboard(unknownSend)
  check(
    await unknownSend
      .getByRole("region", { name: "À faire aujourd’hui" })
      .getByText("Préparer la relance", { exact: true })
      .count(),
    0,
    "Failed send read cannot encourage another send",
  )
  check(
    await unknownSend
      .getByRole("status")
      .filter({ hasText: "les envois de devis" })
      .count(),
    1,
    "Failed send read is explicit",
  )
  check(
    await unknownSend
      .getByRole("region", { name: "À faire aujourd’hui" })
      .getByRole("link", { name: "Ouvrir le brouillon", exact: true })
      .count(),
    0,
    "Unverified draft does not encourage a new send",
  )
  check(
    await unknownSend
      .getByText(
        "Le statut d’envoi de ce brouillon n’a pas pu être vérifié. Consultez le dossier avant tout envoi.",
        { exact: true },
      )
      .count(),
    1,
    "Unverified draft asks for inspection",
  )
  await unknownSend.context().close()

  const admin = await pageFor({ admin: true, automation: true })
  await admin.addInitScript(() => {
    window.sessionStorage.setItem("cadova.admin-company.user-test", "company-other")
    window.localStorage.setItem(
      "cadova.getting-started.user-test.company-test",
      "hidden",
    )
  })
  await dashboard(admin)
  check(
    await admin.getByRole("heading", { name: "Vos premières étapes" }).count(),
    1,
    "Another company does not inherit guide dismissal",
  )
  const panel = admin.getByRole("region", { name: "À faire aujourd’hui" })
  check(
    await panel.getByText("Client autre entreprise · OTHER-001").count(),
    1,
    "Admin chosen company data",
  )
  check(
    await panel.getByText("Client de test", { exact: false }).count(),
    0,
    "No previous company leak",
  )
  await admin.context().close()

  const onboarding = await pageFor({ member: false, empty: true })
  await onboarding.goto(`${base}/app`, { waitUntil: "networkidle" })
  await onboarding.getByRole("heading", { name: "Votre espace entreprise" }).waitFor()
  await onboarding.getByLabel("Nom de votre entreprise").fill("Entreprise du parcours")
  await onboarding.getByRole("button", { name: "Créer mon espace" }).click()
  await onboarding.getByRole("heading", { name: "À faire aujourd’hui" }).waitFor()
  check(
    await onboarding.getByText("Le suivi des devis de Entreprise du parcours.").count(),
    1,
    "Atomic onboarding still works",
  )
  await onboarding.context().close()
  check(errors, [], "No browser errors")
  check(external, [], "No external calls")
  console.log(`PASS: ${checks} workspace checks`)
} finally {
  await browser?.close()
  if (server) {
    try {
      process.kill(-server.pid, "SIGTERM")
    } catch {
      /* already stopped */
    }
  }
}
