import assert from "node:assert/strict"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { chromium } from "playwright-core"

const artifacts = new URL("../.cache/ux-final/", import.meta.url).pathname
await mkdir(artifacts, { recursive: true })
const config = `${artifacts}vite.notifications.config.mjs`
await writeFile(
  config,
  `import {mergeConfig} from 'vite';import original from '../../vite.config.ts';export default mergeConfig(original,{cacheDir:'.cache/vite/ux-notifications',server:{hmr:false}});`,
)
const base = "http://127.0.0.1:8491"
const server = spawn("pnpm", ["dev", "--port", "8491", "--config", config], {
  stdio: "ignore",
  detached: true,
  env: {
    ...process.env,
    VITE_SUPABASE_URL: "https://ux-fixture.example.test",
    VITE_SUPABASE_ANON_KEY: "fixture-public-anon",
  },
})
const fixture = await readFile(
  new URL("./fixtures/supabase.mjs", import.meta.url),
  "utf8",
)
const scriptedFixture =
  fixture +
  `
const originalNavigationFrom=supabase.from;
supabase.from=(table)=>{
  const query=originalNavigationFrom(table);
  if(table==='companies'){
    const single=query.single;
    query.single=function(){return window.__navigationFailure ? Promise.resolve({data:null,error:{message:'fixture read failure'}}) : single.call(this);};
  }
  return query;
};`
let browser
let checks = 0
const pageErrors = []
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(base)).ok) break
    } catch {
      /* startup */
    }
    if (attempt === 59) throw new Error("Vite did not start")
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  })
  async function createPage(width, failure = false) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    })
    await context.addInitScript(
      ({ failure }) => {
        window.__scenario = { session: true, admin: true, member: false }
        window.__navigationFailure = failure
      },
      { failure },
    )
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url())
      if (["http:", "https:"].includes(url.protocol) && url.origin !== base)
        return route.abort()
      return route.fallback()
    })
    await context.route("**/src/lib/supabase.ts", (route) =>
      route.fulfill({ contentType: "application/javascript", body: scriptedFixture }),
    )
    const page = await context.newPage()
    page.on("pageerror", (error) => pageErrors.push(error.message))
    return { page, context }
  }
  for (const width of [320, 390, 768, 1280]) {
    const { page, context } = await createPage(width)
    await page.goto(`${base}/notifications`, { waitUntil: "networkidle" })
    await page.getByRole("heading", { name: "Notifications", exact: true }).waitFor()
    assert.equal(
      await page.evaluate(() =>
        window.sessionStorage.getItem("cadova.admin-company.user-test"),
      ),
      null,
    )
    await page.getByRole("link", { name: "Voir le devis", exact: true }).click()
    await page.getByRole("heading", { name: "TEST-001", exact: true }).waitFor()
    assert.equal(
      await page.evaluate(() =>
        window.sessionStorage.getItem("cadova.admin-company.user-test"),
      ),
      "company-test",
    )
    assert.equal(new URL(page.url()).pathname, "/app/quotes/quote-test")
    checks += 3
    await page.goto(`${base}/admin`, { waitUntil: "networkidle" })
    await page.getByRole("button", { name: "Entreprises", exact: true }).click()
    await page
      .getByRole("button", {
        name: "Ouvrir l’entreprise Autre entreprise",
        exact: true,
      })
      .click()
    await page.getByRole("heading", { name: "Aujourd’hui", exact: true }).waitFor()
    await page
      .getByRole("button", { name: /^Notifications/ })
      .first()
      .click()
    const bell = page.getByRole("region", { name: "Notifications", exact: true })
    await bell.getByRole("link", { name: "Relance de test", exact: true }).click()
    await page.getByRole("heading", { name: "TEST-001", exact: true }).waitFor()
    assert.equal(
      await page.evaluate(() =>
        window.sessionStorage.getItem("cadova.admin-company.user-test"),
      ),
      "company-test",
    )
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
    )
    checks += 2
    await context.close()
  }
  const { page, context } = await createPage(390, true)
  await page.goto(`${base}/notifications`, { waitUntil: "networkidle" })
  await page.getByRole("link", { name: "Voir le devis", exact: true }).click()
  await page
    .getByRole("alert")
    .filter({ hasText: "Impossible d’ouvrir l’entreprise" })
    .waitFor()
  assert.equal(new URL(page.url()).pathname, "/notifications")
  assert.equal(
    await page.evaluate(() =>
      window.sessionStorage.getItem("cadova.admin-company.user-test"),
    ),
    null,
  )
  await page.evaluate(() => {
    window.__navigationFailure = false
  })
  await page.getByRole("link", { name: "Voir le devis", exact: true }).click()
  await page.getByRole("heading", { name: "TEST-001", exact: true }).waitFor()
  checks += 3
  await context.close()
  assert.deepEqual(pageErrors, [])
  console.log(
    `PASS: ${checks} notification navigation checks; administrator scope, mobile, failure and retry.`,
  )
} finally {
  await browser?.close()
  if (server.pid) process.kill(-server.pid, "SIGTERM")
}
