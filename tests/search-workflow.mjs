import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { chromium } from "playwright-core"
import AxeBuilder from "@axe-core/playwright"

const artifacts = new URL("../.cache/search-workflow/", import.meta.url).pathname
await mkdir(artifacts, { recursive: true })
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:8463"
const config = `${artifacts}vite.config.mjs`
if (!process.env.TEST_BASE_URL)
  await writeFile(
    config,
    `import { mergeConfig } from "vite";\nimport original from "../../vite.config.ts";\nexport default mergeConfig(original, { cacheDir: ".cache/vite/search-workflow", server: { hmr: false } });\n`,
  )
const server = process.env.TEST_BASE_URL
  ? null
  : spawn("pnpm", ["exec", "vite", "--port", "8463", "--config", config], {
      stdio: "ignore",
      detached: true,
    })
const [fixture, extension] = await Promise.all([
  readFile(new URL("./fixtures/supabase.mjs", import.meta.url), "utf8"),
  readFile(new URL("./fixtures/search.mjs", import.meta.url), "utf8"),
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
    if (attempt === 79) throw new Error("Vite did not start")
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
            scenario.searchCompany ?? "company-test",
          )
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
    await context.route("**/__search-base-fixture.mjs", (route) =>
      route.fulfill({ contentType: "application/javascript", body: fixture }),
    )
    await context.route("**/src/lib/supabase.ts", (route) =>
      route.fulfill({ contentType: "application/javascript", body: extension }),
    )
    const page = await context.newPage()
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(`${base}/app/clients`, { waitUntil: "networkidle" })
    await page.getByRole("heading", { name: "Clients", exact: true }).waitFor()
    return page
  }
  const dialogFor = (page) =>
    page.getByRole("dialog", { name: "Rechercher", exact: true })
  async function openSearch(page, width) {
    const trigger = page.getByRole("button", {
      name: width >= 768 ? "Rechercher" : "Rechercher un client ou un devis",
      exact: true,
    })
    await trigger.click()
    const input = dialogFor(page).getByRole("searchbox")
    await input.waitFor()
    await input.evaluate(
      (element) =>
        new Promise((resolve) =>
          requestAnimationFrame(() => resolve(document.activeElement === element)),
        ),
    )
    check(
      await input.evaluate((element) => document.activeElement === element),
      true,
      "Search receives focus",
    )
    return { input, trigger }
  }

  for (const width of [320, 390, 768, 1440]) {
    const page = await pageFor({}, width)
    const { input, trigger } = await openSearch(page, width)
    const dialog = dialogFor(page)
    await input.fill("c")
    await page.waitForTimeout(300)
    check(
      await page.evaluate(() => window.__searchQueries.length),
      0,
      "Short and empty input do not query",
    )
    await input.fill("cl")
    await input.fill("cli")
    await input.fill("client")
    await dialog.getByRole("link", { name: /Client de test Client/ }).waitFor()
    check(
      await page.evaluate(() => window.__searchQueries.length),
      1,
      "Rapid typing is debounced",
    )
    check(
      await page.evaluate(() => window.__searchQueries[0]),
      { p_company_id: "company-test", p_query: "client", p_limit: 20 },
      "Company scoped RPC",
    )
    check(
      await dialog
        .getByRole("link", { name: /Client de test Client/ })
        .getAttribute("href"),
      "/app/clients/client-test",
      "Client links use detail route",
    )
    check(
      await dialog.getByRole("link", { name: /TEST-001/ }).getAttribute("href"),
      "/app/quotes/quote-test",
      "Quote links use detail route",
    )
    await input.fill("client ")
    check(
      await dialog.getByRole("link").count(),
      3,
      "Trailing spaces retain valid current results",
    )
    check(
      await page.evaluate(() => window.__searchQueries.length),
      1,
      "Equivalent trimmed query does not refetch",
    )
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      "No horizontal overflow",
    )
    check(
      await dialog.evaluate((element) => element.scrollWidth > element.clientWidth),
      false,
      "No dialog overflow",
    )
    if (width === 390) {
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
      check(
        violations.map((item) => ({
          id: item.id,
          targets: item.nodes.map((node) => node.target),
        })),
        [],
        "Accessible search dialog",
      )
    }
    await page.screenshot({ path: `${artifacts}search-${width}.png`, fullPage: true })
    await page.keyboard.press("Escape")
    check(await dialog.count(), 0, "Escape closes search")
    check(
      await trigger.evaluate((element) => document.activeElement === element),
      true,
      "Trigger focus restored",
    )
    await page.context().close()
  }

  const keyboard = await pageFor({}, 1280)
  await keyboard.keyboard.press("Control+k")
  const input = dialogFor(keyboard).getByRole("searchbox")
  await input.waitFor()
  await input.fill("TEST-001")
  const quote = dialogFor(keyboard).getByRole("link", { name: /TEST-001/ })
  await quote.waitFor()
  await keyboard.keyboard.press("Tab")
  check(
    await quote.evaluate((element) => document.activeElement === element),
    true,
    "Tab reaches first result",
  )
  await keyboard.keyboard.press("Enter")
  await keyboard.waitForURL("**/app/quotes/quote-test")
  check(await dialogFor(keyboard).count(), 0, "Enter navigates and closes modal")
  await keyboard.keyboard.press("Meta+k")
  await dialogFor(keyboard).waitFor()
  check(
    await dialogFor(keyboard).getByRole("searchbox").inputValue(),
    "",
    "Reopening clears query",
  )
  await keyboard.keyboard.press("Escape")
  await keyboard.context().close()

  const delayed = await pageFor({ searchDelayQuery: "client" })
  const delayedSearch = await openSearch(delayed, 390)
  await delayedSearch.input.fill("client")
  await delayed.waitForFunction(() => window.__searchQueries.length === 1)
  await delayedSearch.input.fill("TEST-001")
  await dialogFor(delayed)
    .getByRole("link", { name: /TEST-001/ })
    .waitFor()
  await delayed.waitForTimeout(1100)
  check(
    await dialogFor(delayed).getByRole("link").count(),
    1,
    "Older late response cannot replace newer results",
  )
  await delayedSearch.input.fill("no-such-record")
  await dialogFor(delayed)
    .getByText("Aucun client ni devis ne correspond à cette recherche.", {
      exact: true,
    })
    .waitFor()
  check(
    await dialogFor(delayed).getByRole("link").count(),
    0,
    "Empty results clear previous records",
  )
  await delayed.evaluate(() => {
    window.__searchFailure = true
  })
  await delayedSearch.input.fill("TEST")
  await dialogFor(delayed).getByRole("button", { name: "Réessayer" }).waitFor()
  check(
    await dialogFor(delayed).getByRole("link").count(),
    0,
    "Failed reads cannot present stale results",
  )
  await delayed.evaluate(() => {
    window.__searchFailure = false
  })
  await dialogFor(delayed).getByRole("button", { name: "Réessayer" }).click()
  await dialogFor(delayed)
    .getByRole("link", { name: /TEST-001/ })
    .waitFor()
  check(
    await dialogFor(delayed).getByRole("button", { name: "Réessayer" }).count(),
    0,
    "Retry recovers search",
  )
  await delayed.context().close()

  const foreign = await pageFor({ searchForeign: true })
  const foreignSearch = await openSearch(foreign, 390)
  await foreignSearch.input.fill("client")
  await dialogFor(foreign).getByRole("button", { name: "Réessayer" }).waitFor()
  check(
    await dialogFor(foreign).getByRole("link").count(),
    0,
    "Foreign company payload is refused",
  )
  await foreign.context().close()

  const admin = await pageFor({
    admin: true,
    searchCompany: "company-other",
    searchMore: true,
  })
  const adminSearch = await openSearch(admin, 390)
  await adminSearch.input.fill("client")
  await dialogFor(admin)
    .getByRole("link", { name: /Client autre entreprise Client/ })
    .waitFor()
  check(
    await dialogFor(admin)
      .getByRole("link", { name: /Client de test/ })
      .count(),
    0,
    "Admin sees selected company only",
  )
  check(
    await admin.evaluate(() =>
      window.__searchQueries.every((query) => query.p_company_id === "company-other"),
    ),
    true,
    "Admin RPCs scope selected company",
  )
  check(
    await dialogFor(admin)
      .getByText(/D’autres résultats existent : précisez votre recherche/)
      .count(),
    1,
    "HasMore invites narrowing",
  )
  await admin.context().close()

  const switching = await pageFor(
    {
      admin: true,
      searchDelayQuery: "client",
      searchDelayCompany: "company-test",
      searchDelayMs: 1600,
    },
    1280,
  )
  const switchingSearch = await openSearch(switching, 1280)
  await switchingSearch.input.fill("client")
  await switching.waitForFunction(() => window.__searchQueries.length === 1)
  await switching.keyboard.press("Escape")
  await dialogFor(switching).waitFor({ state: "hidden" })
  await switching
    .getByRole("link", { name: "Changer d’entreprise", exact: true })
    .click()
  await switching.getByRole("button", { name: "Entreprises", exact: true }).click()
  await switching
    .getByRole("button", { name: "Ouvrir l’entreprise Autre entreprise", exact: true })
    .click()
  await switching.waitForURL("**/app")
  await switching
    .getByRole("heading", { name: "Tableau de bord", exact: true })
    .waitFor()
  await switching.getByRole("button", { name: "Rechercher", exact: true }).waitFor()
  await switching.keyboard.press("Control+k")
  await dialogFor(switching).getByRole("searchbox").fill("client")
  await dialogFor(switching)
    .getByRole("link", { name: /Client autre entreprise Client/ })
    .waitFor()
  await switching.waitForTimeout(1800)
  check(
    await dialogFor(switching)
      .getByRole("link", { name: /Client de test/ })
      .count(),
    0,
    "Late previous company response cannot leak into switched company",
  )
  check(
    await switching.evaluate(() =>
      window.__searchQueries.map((entry) => entry.p_company_id),
    ),
    ["company-test", "company-other"],
    "Changing admin company changes every new search request",
  )
  await switching.context().close()
  check(errors, [], "No browser errors")
  check(external, [], "No external requests")
  console.log(`PASS: ${checks} search checks`)
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
