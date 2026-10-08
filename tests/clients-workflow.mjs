import assert from "node:assert/strict"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { chromium } from "playwright-core"
import AxeBuilder from "@axe-core/playwright"

const artifacts = new URL("../.cache/clients-workflow/", import.meta.url).pathname
await mkdir(artifacts, { recursive: true })
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:8476"
const config = `${artifacts}vite.stable.config.mjs`
if (!process.env.TEST_BASE_URL)
  await writeFile(
    config,
    `import { mergeConfig } from "vite"; import original from "../../vite.config.ts"; export default mergeConfig(original, { cacheDir: ".cache/vite/clients-workflow", server: { hmr: false } });`,
  )
const server = process.env.TEST_BASE_URL
  ? null
  : spawn("pnpm", ["dev", "--port", "8476", "--config", config], {
      stdio: "ignore",
      detached: true,
    })
const fixture = await readFile(
  new URL("./fixtures/supabase.mjs", import.meta.url),
  "utf8",
)
const fixtureExtension = `
window.__clientQueries = [];
if (options.clientsExtra) db.clients.push({ ...db.clients[0], id: "client-extra", name: "Élodie Bâtiment", email: "elodie@example.test", phone: "06 11 22 33 44", notes: null });
const originalFrom = supabase.from;
supabase.from = function(table) {
  const query = originalFrom.call(this, table);
  const originalEq = query.eq;
  query.eq = function(key, value) { window.__clientQueries.push({table, key, value}); return originalEq.call(this, key, value); };
  const originalThen = query.then;
  query.then = function(resolve, reject) {
    if (table === "company_members" && options.preferencesFailure && query.columns.includes("followup_delay_days")) return Promise.resolve({data:null,error:{message:"Preferences unavailable"}}).then(resolve,reject);
    return originalThen.call(this, resolve, reject);
  };
  return query;
};
`
let browser
let checks = 0
const errors = []
const external = []
function check(actual, expected, message) {
  assert.deepEqual(actual, expected, message)
  checks++
}
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(base)).ok) break
    } catch {
      /* startup */
    }
    if (attempt === 59) throw new Error("Vite failed to start")
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
        if (scenario.admin)
          window.sessionStorage.setItem(
            "cadova.admin-company.user-test",
            "company-test",
          )
      },
      { session: true, automation: true, clientsExtra: true, ...options },
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
    await context.route("**/src/lib/supabase.ts", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: fixture + fixtureExtension,
      }),
    )
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    page.on("pageerror", (error) => errors.push(error.message))
    return page
  }
  async function visit(page, path, heading) {
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" })
    await page.getByRole("heading", { name: heading, exact: true }).waitFor()
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      `No overflow: ${path}`,
    )
  }
  async function accessible(page) {
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze()
    check(
      violations.map(({ id, nodes }) => ({
        id,
        targets: nodes.map((node) => node.target),
      })),
      [],
      "Accessible client journey",
    )
  }

  for (const width of [320, 390, 768, 1280]) {
    const page = await pageFor({}, width)
    await visit(page, "/app/clients", "Clients")
    check(
      await page.locator('a[aria-current="page"]').filter({ visible: true }).count(),
      1,
      "Only the current navigation destination is highlighted",
    )
    const search = page.getByRole("searchbox", {
      name: "Rechercher un client",
      exact: true,
    })
    for (const needle of ["elodie", "elodie@example.test", "0611223344"]) {
      await search.fill(needle)
      await page.getByRole("link", { name: "Élodie Bâtiment", exact: true }).waitFor()
      check(
        await page.getByRole("link", { name: "Client de test", exact: true }).count(),
        0,
        `Client search ${needle}`,
      )
    }
    check(
      await page
        .getByRole("link", { name: "elodie@example.test", exact: true })
        .getAttribute("href"),
      "mailto:elodie@example.test",
      "Email opens the correct contact",
    )
    check(
      await page
        .getByRole("link", { name: "06 11 22 33 44", exact: true })
        .getAttribute("href"),
      "tel:0611223344",
      "Phone is directly callable",
    )
    await search.fill("aucun résultat")
    await page
      .getByRole("heading", { name: "Aucun client trouvé", exact: true })
      .waitFor()
    await page
      .getByRole("button", { name: "Effacer la recherche", exact: true })
      .click()
    await page.getByRole("link", { name: "Client de test", exact: true }).click()
    await page.getByRole("heading", { name: "Client de test", exact: true }).waitFor()
    check(
      await page
        .getByRole("link", { name: "Ajouter un devis", exact: true })
        .last()
        .getAttribute("href"),
      "/app/quotes/new?client=client-test",
      "Quote creation retains the selected client",
    )
    check(
      await page.getByRole("link", { name: "TEST-001", exact: true }).count(),
      1,
      "A quote remains discoverable on its client",
    )
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      `No client detail overflow ${width}`,
    )
    if (width === 390) await accessible(page)
    await page.screenshot({ path: `${artifacts}client-${width}.png`, fullPage: true })
    await visit(page, "/app/clients/new", "Ajouter un client")
    if (width === 390) await accessible(page)
    await visit(page, "/app/quotes/new?client=client-test", "Ajouter un devis")
    check(
      await page.locator("#client_id").inputValue(),
      "client-test",
      "Adding a quote avoids reselecting its client",
    )
    await page
      .getByRole("button", { name: "Saisir sans document", exact: true })
      .click()
    check(
      await page
        .locator("#client_id")
        .evaluate((element) => element === document.activeElement),
      true,
      "Manual alternative moves keyboard focus into the form",
    )
    check(
      await page
        .locator("details")
        .filter({
          has: page.getByText("Validité et notes internes · facultatif", {
            exact: true,
          }),
        })
        .getAttribute("open"),
      null,
      "Optional fields are initially collapsed",
    )
    if (width === 390) await accessible(page)
    await page.context().close()
  }

  for (const width of [390, 1280]) {
    const missingContact = await pageFor(
      { automation: false, clientWithoutEmail: true },
      width,
    )
    for (const [path, heading] of [
      ["/app", "Aujourd’hui"],
      ["/app/quotes", "Devis"],
      ["/app/clients/client-test", "Client de test"],
    ]) {
      await visit(missingContact, path, heading)
      const action = missingContact.getByRole("link", {
        name: "Compléter le client",
        exact: true,
      })
      await action.waitFor()
      check(
        await action.getAttribute("href"),
        "/app/clients/client-test/edit",
        "Missing email leads directly to the relevant client",
      )
      await action.click()
      await missingContact
        .getByRole("heading", { name: "Modifier le client", exact: true })
        .waitFor()
      check(
        await missingContact
          .getByLabel("Nom du client ou de l’entreprise")
          .inputValue(),
        "Client de test",
        "The correct client is ready to edit",
      )
    }
    await visit(missingContact, "/app/quotes/quote-test", "TEST-001")
    await missingContact
      .getByRole("button", { name: "Compléter le client", exact: true })
      .click()
    await missingContact
      .getByRole("heading", { name: "Modifier le client", exact: true })
      .waitFor()
    checks++
    await missingContact.context().close()
  }

  const automatic = await pageFor({ automationState: "enabled" })
  await visit(automatic, "/app/clients/client-test", "Client de test")
  await automatic.getByText("Relance automatique prévue", { exact: true }).waitFor()
  check(
    await automatic.getByText("Préparer la relance", { exact: true }).count(),
    0,
    "An automated quote is not falsely due manually",
  )
  check(
    await automatic
      .getByRole("link", { name: "Voir les relances", exact: true })
      .getAttribute("href"),
    "/app/quotes/quote-test?focus=followups",
    "The client page points to the relevant quote section",
  )
  await automatic.context().close()

  const missingPrefs = await pageFor({ preferencesFailure: true })
  await visit(missingPrefs, "/app/clients/client-test", "Client de test")
  await missingPrefs.getByRole("alert").filter({ hasText: "délai de rappel" }).waitFor()
  check(
    await missingPrefs.getByText("Préparer la relance", { exact: true }).count(),
    0,
    "Unavailable preference never becomes an assumed three-day delay",
  )
  await missingPrefs.context().close()

  const admin = await pageFor({ admin: true })
  await visit(admin, "/app/clients/client-test", "Client de test")
  check(
    await admin.getByRole("alert").count(),
    0,
    "An administrator is not expected to have company reminder preferences",
  )
  await admin.goto(`${base}/app/clients/client-other`, { waitUntil: "networkidle" })
  await admin
    .getByRole("alert")
    .filter({ hasText: "Fiche client introuvable" })
    .waitFor()
  check(
    await admin
      .getByRole("heading", { name: "Client autre entreprise", exact: true })
      .count(),
    0,
    "Direct foreign-client URLs remain scoped even for administrator",
  )
  await admin.goto(`${base}/app/clients/client-other/edit`, {
    waitUntil: "networkidle",
  })
  await admin.getByRole("alert").filter({ hasText: "Client introuvable" }).waitFor()
  check(
    await admin
      .getByRole("button", { name: "Enregistrer les coordonnées", exact: true })
      .count(),
    0,
    "A failed foreign-client load cannot turn into an edit form",
  )
  const scopedReads = await admin.evaluate(() => window.__clientQueries)
  check(
    scopedReads.some(
      (query) =>
        query.table === "clients" &&
        query.key === "company_id" &&
        query.value === "company-test",
    ),
    true,
    "Client reads carry an explicit company filter",
  )
  await admin.context().close()

  const sent = await pageFor()
  await visit(sent, "/app/quotes/draft-test/edit?alreadySent=1", "Modifier le devis")
  check(
    await sent.locator("#status").inputValue(),
    "sent",
    "Explicit already-sent entry proposes the sent status",
  )
  check(
    await sent.locator("#sent_at").inputValue(),
    "",
    "Already sent requires an actual date, never an invented one",
  )
  check(
    await sent.evaluate(
      () => window.__testStore.quotes.find((quote) => quote.id === "draft-test").status,
    ),
    "draft",
    "Opening the form does not mutate the quote",
  )
  await sent
    .getByRole("button", { name: "Enregistrer l’envoi déjà effectué", exact: true })
    .click()
  await sent.getByRole("alert").filter({ hasText: "date" }).waitFor()
  await sent.locator("#sent_at").fill("2099-01-01")
  await sent
    .getByRole("button", { name: "Enregistrer l’envoi déjà effectué", exact: true })
    .click()
  await sent.getByRole("alert").filter({ hasText: "futur" }).waitFor()
  await sent.locator("#sent_at").fill("2026-01-01")
  await sent
    .getByRole("button", { name: "Enregistrer l’envoi déjà effectué", exact: true })
    .click()
  await sent.getByRole("heading", { name: "TEST-002", exact: true }).waitFor()
  check(
    await sent.evaluate(
      () =>
        window.__testStore.quotes.find((quote) => quote.id === "draft-test").sent_at,
    ),
    "2026-01-01",
    "The confirmed already-sent date is preserved",
  )
  check(
    await sent.evaluate(() => window.__testStore.quote_initial_send_jobs.length),
    0,
    "Recording an already-sent quote creates no email job",
  )
  await sent.context().close()

  check(errors, [], "No browser runtime errors")
  check(external, [], "No external/provider calls")
  console.log(
    `PASS: ${checks} client and quote-entry browser checks; artifacts ${artifacts}`,
  )
} finally {
  await browser?.close()
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM")
    } catch {
      /* stopped */
    }
  }
}
