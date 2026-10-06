import assert from "node:assert/strict"
import { writeFile, mkdir } from "node:fs/promises"
import { spawn } from "node:child_process"
import { chromium } from "playwright-core"
import AxeBuilder from "@axe-core/playwright"

const directory = new URL("../.cache/work-orders/", import.meta.url).pathname
await mkdir(directory, { recursive: true })
const port = "8475"
const base = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`
const config = `${directory}vite.config.mjs`
await writeFile(
  config,
  `import {mergeConfig} from "vite"; import original from "../../vite.config.ts"; export default mergeConfig(original,{cacheDir:".cache/vite/work-orders",server:{hmr:false}});`,
)
await writeFile(
  `${directory}harness.tsx`,
  `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QuoteWorkOrderPanel } from "/src/features/quotes/work-orders/QuoteWorkOrderPanel.tsx";
import "/src/index.css";
const original = {id:"quote-one",company_id:"company-one",client_id:"client-one",reference:"DEV-001",amount_cents:20000,sent_at:"2026-10-01",status:window.__scenario?.quoteStatus || "accepted",notes:null,created_at:"2026-10-01T10:00:00Z",updated_at:"2026-10-01T10:00:00Z",client:{id:"client-one",name:"Client"}};
function App(){const [quote,setQuote]=useState(original);return <main className="mx-auto max-w-3xl p-4 sm:p-8"><h1 className="mb-5 text-2xl font-semibold">Dossier devis</h1><QuoteWorkOrderPanel quote={quote} onChanged={()=>{window.__changed=(window.__changed||0)+1}}/><div className="mt-8 flex flex-wrap gap-3"><button onClick={()=>setQuote({...original,company_id:"company-two"})}>Autre entreprise</button><button onClick={()=>setQuote({...original,id:"quote-two"})}>Autre devis</button><button onClick={()=>setQuote({...original,status:"refused"})}>Devis refusé</button></div></main>}; createRoot(document.getElementById("root")).render(<App/>);
`,
)
const fixture = `
export const isSupabaseConfigured=true;
const options=window.__scenario||{};
const db={records: options.status ? [{quote_id:"quote-one",company_id:"company-one",status:options.status,scheduled_for:options.date||null,created_at:"2026-10-01T10:00:00Z",updated_at:"2026-10-01T10:00:00Z"}]:[],calls:[],reads:[],failRead:options.failRead||false,failSave:options.failSave||false,delay:options.delay||0,mismatch:options.mismatch||false};
window.__workOrders=db;
export const supabase={from(table){const filters=[];const query={select(){return query},eq(k,v){filters.push([k,v]);return query},abortSignal(){return query},async maybeSingle(){db.reads.push({table,filters});const found=db.records.find(r=>filters.every(([k,v])=>r[k]===v));const result=db.failRead?{data:null,error:{message:"offline"}}:{data:db.mismatch?{...found,company_id:"company-other"}:found||null,error:null};if(db.delay)await new Promise(resolve=>setTimeout(resolve,db.delay));return result}};return query},rpc(name,args){const result={abortSignal(){return result},then(resolve,reject){db.calls.push({name,args});return (async()=>{if(db.delay)await new Promise(resolve=>setTimeout(resolve,db.delay));if(db.failSave)return {data:null,error:{code:db.failSave===true?"network":db.failSave,message:"write failure"}};const old=db.records.find(r=>r.quote_id===args.p_quote_id);if(old&&old.updated_at!==args.p_expected_updated_at)return {data:null,error:{code:"40001",message:"conflict"}};const row={quote_id:args.p_quote_id,company_id:old?.company_id||"company-one",status:args.p_status,scheduled_for:args.p_scheduled_for,created_at:old?.created_at||"2026-10-05T12:00:00Z",updated_at:new Date(Date.now()+db.calls.length).toISOString()};db.records=db.records.filter(r=>r.quote_id!==row.quote_id);db.records.push(row);return {data:row,error:null}})().then(resolve,reject)}};return result}};
`
const server = process.env.TEST_BASE_URL
  ? null
  : spawn("pnpm", ["exec", "vite", "--port", port, "--config", config], {
      stdio: "ignore",
      detached: true,
    })
let browser
let checks = 0
const errors = []
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
    if (attempt === 99) throw new Error("Work order Vite failed to start")
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
    await context.addInitScript((value) => {
      window.__scenario = value
    }, options)
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
    await context.route("**/src/main.tsx", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: 'import "/.cache/work-orders/harness.tsx";',
      }),
    )
    await context.route("**/src/lib/supabase.ts", (route) =>
      route.fulfill({ contentType: "application/javascript", body: fixture }),
    )
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    page.on("pageerror", (error) => {
      const value = error.stack || error.message
      if (!errors.includes(value)) errors.push(value)
    })
    await page.goto(base, { waitUntil: "networkidle" })
    return page
  }
  for (const width of [320, 390, 768, 1440]) {
    const page = await pageFor({}, width)
    const panel = page.getByRole("region", { name: "Intervention", exact: true })
    await panel
      .getByRole("button", { name: "Planifier l’intervention", exact: true })
      .waitFor()
    check(
      await panel.getByText("À planifier", { exact: true }).count(),
      1,
      "Unplanned quote",
    )
    await panel
      .getByRole("button", { name: "Planifier l’intervention", exact: true })
      .click()
    check(
      await panel.getByLabel("Date prévue").getAttribute("required"),
      "",
      "Schedule needs date",
    )
    await panel.getByRole("button", { name: "Enregistrer", exact: true }).click()
    check(
      await page.evaluate(() => window.__workOrders.calls.length),
      0,
      "Empty date never saved",
    )
    await panel.getByLabel("Date prévue").fill("2026-10-20")
    await panel.getByLabel("Date prévue").press("Enter")
    await panel.getByText("Planifiée", { exact: true }).waitFor()
    check(
      await panel.locator("time").getAttribute("datetime"),
      "2026-10-20",
      "Date rendered without timezone shift",
    )
    const reads = await page.evaluate(() => window.__workOrders.reads)
    check(
      reads.every(
        (r) =>
          r.table === "quote_work_orders" &&
          r.filters.some(([k, v]) => k === "company_id" && v === "company-one") &&
          r.filters.some(([k, v]) => k === "quote_id" && v === "quote-one"),
      ),
      true,
      "Every read belongs to current tenant and quote",
    )
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      "No horizontal overflow",
    )
    if (width === 390) {
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
      check(
        violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
        [],
        "Accessible work order",
      )
      await page.screenshot({ path: `${directory}mobile.png`, fullPage: true })
    }
    if (width === 1440)
      await page.screenshot({ path: `${directory}desktop.png`, fullPage: true })
    await page.context().close()
  }
  const progress = await pageFor({ status: "scheduled", date: "2026-10-20" })
  const panel = progress.getByRole("region", { name: "Intervention", exact: true })
  await panel
    .getByRole("button", { name: "Commencer l’intervention", exact: true })
    .click()
  await panel.getByText("En cours", { exact: true }).waitFor()
  check(
    await progress.evaluate(
      () => window.__workOrders.calls[0].args.p_expected_updated_at,
    ),
    "2026-10-01T10:00:00Z",
    "Version bound to previous record",
  )
  await panel
    .getByRole("button", { name: "Marquer comme terminée", exact: true })
    .click()
  check(
    await progress.evaluate(() => window.__workOrders.calls.length),
    1,
    "Completion waits for confirmation",
  )
  await progress
    .getByRole("dialog")
    .getByRole("button", { name: "Annuler", exact: true })
    .click()
  check(
    await panel.getByText("En cours", { exact: true }).count(),
    1,
    "Cancel preserves running work",
  )
  await panel
    .getByRole("button", { name: "Marquer comme terminée", exact: true })
    .click()
  const { violations: dialogViolations } = await new AxeBuilder({ page: progress })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze()
  check(
    dialogViolations.map((v) => v.id),
    [],
    "Accessible completion dialog",
  )
  await progress.getByRole("button", { name: "Confirmer la fin", exact: true }).click()
  await panel.getByText("Terminée", { exact: true }).waitFor()
  check(
    await progress.evaluate(() => window.__changed),
    2,
    "Saved stages update dossier",
  )
  await panel.getByRole("button", { name: "Rouvrir le suivi", exact: true }).click()
  check(
    await panel.getByLabel("Date prévue").count(),
    0,
    "Unplanned reopened work has no planned date",
  )
  await panel.getByRole("button", { name: "Enregistrer", exact: true }).click()
  check(
    await progress.evaluate(() => window.__workOrders.calls.length),
    2,
    "Reopening waits for confirmation",
  )
  await progress
    .getByRole("button", { name: "Confirmer la réouverture", exact: true })
    .click()
  await panel.getByText("À planifier", { exact: true }).waitFor()
  check(
    await progress.evaluate(() => window.__workOrders.records[0].scheduled_for),
    null,
    "Reopening unplanned clears planned date",
  )
  await progress.context().close()

  const offline = await pageFor({ failRead: true })
  await offline.getByRole("alert").waitFor()
  check(
    await offline
      .getByRole("button", { name: "Planifier l’intervention", exact: true })
      .count(),
    0,
    "Unknown state does not offer mutations",
  )
  await offline.evaluate(() => {
    window.__workOrders.failRead = false
  })
  await offline.getByRole("button", { name: "Actualiser", exact: true }).click()
  await offline.getByRole("button", { name: "Déjà en cours", exact: true }).waitFor()
  await offline.evaluate(() => {
    window.__workOrders.failSave = true
  })
  await offline.getByRole("button", { name: "Déjà en cours", exact: true }).click()
  await offline.getByRole("alert").waitFor()
  check(
    await offline
      .getByRole("button", { name: "Déjà en cours", exact: true })
      .count(),
    0,
    "Ambiguous save requires a fresh read",
  )
  await offline.evaluate(() => {
    window.__workOrders.failSave = false
  })
  await offline.getByRole("button", { name: "Actualiser", exact: true }).click()
  await offline.getByRole("button", { name: "Déjà en cours", exact: true }).click()
  await offline.getByText("En cours", { exact: true }).waitFor()
  check(
    await offline.evaluate(() => window.__workOrders.calls.length),
    2,
    "Recovery saves once after verification",
  )
  await offline.context().close()

  const conflict = await pageFor({
    status: "scheduled",
    date: "2026-10-20",
    failSave: "40001",
  })
  await conflict
    .getByRole("button", { name: "Commencer l’intervention", exact: true })
    .click()
  await conflict.getByRole("alert").waitFor()
  check(
    await conflict.getByRole("alert").textContent(),
    "Le devis a changé. Actualisez avant de modifier le suivi de l’intervention.",
    "Concurrent edits are explained",
  )
  check(
    await conflict
      .getByRole("button", { name: "Commencer l’intervention", exact: true })
      .isDisabled(),
    true,
    "Conflict cannot be blindly overwritten",
  )
  await conflict.context().close()

  const invalid = await pageFor({
    status: "scheduled",
    date: "2026-10-20",
    mismatch: true,
  })
  await invalid.getByRole("alert").waitFor()
  check(
    await invalid.getByText("Planifiée", { exact: true }).count(),
    0,
    "Foreign-tenant response is never rendered",
  )
  await invalid.context().close()

  const scoped = await pageFor({ status: "completed", date: "2026-10-20", delay: 500 })
  await scoped.getByRole("button", { name: "Autre entreprise", exact: true }).click()
  await scoped
    .getByRole("button", { name: "Planifier l’intervention", exact: true })
    .waitFor()
  check(
    await scoped.getByText("Terminée", { exact: true }).count(),
    0,
    "Late previous-company state is discarded",
  )
  await scoped.getByRole("button", { name: "Devis refusé", exact: true }).click()
  check(
    await scoped.getByRole("region", { name: "Intervention", exact: true }).count(),
    0,
    "Refused quote has no work order mutation",
  )
  await scoped.context().close()

  const busy = await pageFor({ delay: 500 })
  await busy.getByRole("button", { name: "Déjà en cours", exact: true }).waitFor()
  await busy.getByRole("button", { name: "Déjà en cours", exact: true }).click()
  check(
    await busy.getByRole("button", { name: "Déjà en cours", exact: true }).isDisabled(),
    true,
    "Busy state blocks a repeated save",
  )
  await busy.getByText("En cours", { exact: true }).waitFor()
  check(
    await busy.evaluate(() => window.__workOrders.calls.length),
    1,
    "One mutation only",
  )
  await busy.context().close()

  check(errors, [], "No uncaught browser errors")
  check(external, [], "No external service or email request")
  console.log(
    `Work-order workflow: ${checks} checks passed; mobile, keyboard, accessibility, confirmation, conflict, retry, and tenant isolation.`,
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
