import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { chromium } from "playwright-core"
import AxeBuilder from "@axe-core/playwright"

const artifacts = new URL("../.cache/finish-timeline/", import.meta.url).pathname
await mkdir(artifacts, { recursive: true })
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:8474"
const config = `${artifacts}vite.timeline.config.mjs`
if (!process.env.TEST_BASE_URL)
  await writeFile(
    config,
    `import {mergeConfig} from "vite";import original from "../../vite.config.ts";export default mergeConfig(original,{cacheDir:".cache/vite/timeline",server:{hmr:false}});`,
  )
const server = process.env.TEST_BASE_URL
  ? null
  : spawn("pnpm", ["exec", "vite", "--port", "8474", "--config", config], {
      stdio: "ignore",
      detached: true,
    })
const fixture = await readFile(
  new URL("./fixtures/supabase.mjs", import.meta.url),
  "utf8",
)
// Extend the shared in-memory adapter, keeping real auth, routing and query behavior.
const extension = `
db.quote_client_messages = options.timelineMessages || [];
db.quote_email_deliveries = options.timelineDeliveries || [];
db.quote_work_orders = [];
db.quote_events.push(...(options.timelineEvents || []));
db.quote_initial_send_jobs.push(...(options.timelineInitialJobs || []));
db.quote_documents.push(...(options.timelineDocuments || []));
window.__timelineReads = [];
const timelineFrom = supabase.from;
supabase.from = (table) => {
  const query = timelineFrom(table);
  query.abortSignal = () => query;
  const range = query.range.bind(query);
  query.range = (start,end) => { window.__timelineReads.push({table,start,end}); return range(start,end); };
  const then = query.then.bind(query);
  query.then = (resolve,reject) => {
    if (options.timelineDelay && table === "quote_events") return new Promise(r => setTimeout(r,options.timelineDelay)).then(() => then(resolve,reject));
    return then(resolve,reject);
  };
  return query;
};
const timelineRpc = supabase.rpc;
supabase.rpc = (name,args) => {
  if (name === "read_quote_email_tracking_status") return Promise.resolve({data:{deliveryReady:true,receivingReady:false,code:"delivery_only"},error:null});
  return timelineRpc(name,args);
};
`
let browser
let checks = 0
const errors = []
const external = []
function check(actual, expected, label) {
  assert.deepEqual(actual, expected, label)
  checks++
}
const scope = { company_id: "company-test", quote_id: "quote-test" }
const stamp = "2026-10-05T12:30:00Z"
const event = (id, overrides = {}) => ({
  id,
  ...scope,
  event_type: "note",
  content: `Note ${id}`,
  occurred_at: stamp,
  created_by: "user-test",
  ...overrides,
})
const message = (id, overrides = {}) => ({
  id,
  ...scope,
  author: "client",
  kind: "question",
  content: "La date proposée est-elle disponible ?",
  created_at: stamp,
  ...overrides,
})
const delivery = (overrides = {}) => ({
  id: "delivery-main",
  ...scope,
  initial_send_job_id: "job-main",
  automation_job_id: null,
  provider_message_id: "provider-main",
  status: "bounced",
  created_at: stamp,
  last_event_at: stamp,
  ...overrides,
})
const job = (overrides = {}) => ({
  id: "job-main",
  ...scope,
  document_id: "document-main",
  status: "sent",
  body: "Message réel envoyé",
  subject: "Votre devis",
  recipient_email: "client@example.test",
  recipient_name: "Client de test",
  sent_at: stamp,
  created_at: stamp,
  updated_at: stamp,
  ...overrides,
})

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
  async function pageFor(scenario = {}, width = 390) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    })
    await context.addInitScript(
      (value) => {
        window.__scenario = value
      },
      { session: true, automation: true, ...scenario },
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
        body: fixture + extension,
      }),
    )
    const page = await context.newPage()
    page.on("pageerror", (error) => errors.push(error.message))
    return page
  }
  async function visit(page, path = "/app/quotes/quote-test", heading = "TEST-001") {
    await page.goto(base + path, { waitUntil: "networkidle" })
    await page.getByRole("heading", { name: heading, exact: true }).waitFor()
    await page.getByRole("button", { name: "Actualiser l’activité du devis" }).waitFor()
  }
  const merged = {
    timelineEvents: [
      event("question-event", {
        event_type: "response",
        portal_message_id: "question-main",
        content: "La date proposée est-elle disponible ?",
      }),
      event("sent-event", {
        event_type: "sent",
        initial_send_job_id: "job-main",
        content: "Message réel envoyé",
      }),
      event("bounce-event", {
        email_delivery_id: "delivery-main",
        content:
          "Le serveur du destinataire a refusé cet email. Vérifiez son adresse avant un nouvel envoi.",
      }),
      event("private-email", {
        event_type: "response",
        email_reply_id: "reply-main",
        content: "Réponse privée complète\n" + "Détail confidentiel. ".repeat(125),
      }),
      event("separate-note", { content: "Appeler après mardi." }),
      event("foreign-event", {
        company_id: "foreign-company",
        content: "Ne jamais afficher",
      }),
    ],
    timelineMessages: [
      message("question-main"),
      message("email-public-excerpt", {
        content: (
          "Réponse privée complète\n" + "Détail confidentiel. ".repeat(125)
        ).slice(0, 2000),
        nonce: "reply-main",
        created_at: "2026-10-04T09:00:00Z",
      }),
      message("company-reply", {
        author: "company",
        kind: "message",
        content: "Oui, nous pouvons venir mardi.",
      }),
      message("foreign-message", {
        quote_id: "another-quote",
        content: "Ne jamais afficher",
      }),
    ],
    timelineInitialJobs: [job()],
    timelineDeliveries: [delivery()],
    timelineDocuments: [
      {
        id: "document-main",
        ...scope,
        file_name: "devis-original.pdf",
        created_at: stamp,
      },
    ],
  }
  for (const width of [320, 390, 768, 1280]) {
    const page = await pageFor(merged, width)
    await visit(page)
    const history = page.getByRole("list", {
      name: "Historique chronologique du devis",
    })
    await history.getByText("Question du client", { exact: true }).waitFor()
    check(
      await history
        .getByText("La date proposée est-elle disponible ?", { exact: true })
        .count(),
      1,
      "Question appears once",
    )
    check(
      await history.getByText("Devis remis au service email", { exact: true }).count(),
      1,
      "Send event and job merge",
    )
    check(
      await history.getByText("Email non livré", { exact: true }).count(),
      1,
      "Provider failure remains once",
    )
    check(
      await history
        .getByText("Email non livré", { exact: true })
        .locator("xpath=ancestor::li")
        .locator(".bg-danger-soft")
        .count(),
      1,
      "Merged provider failure stays visibly an error",
    )
    check(
      await history.getByText("Réponse reçue par email", { exact: true }).count(),
      1,
      "Private email reply kept",
    )
    const privateReply = history
      .getByText("Réponse reçue par email", { exact: true })
      .locator("xpath=ancestor::li")
    check(
      await privateReply.locator("details").count(),
      1,
      "Long email is collapsed in one timeline item",
    )
    const fullReply = privateReply.getByText(
      "Réponse privée complète\n" + "Détail confidentiel. ".repeat(125),
      { exact: true },
    )
    check(await fullReply.isVisible(), false, "Full message starts collapsed")
    await privateReply.getByText("Lire le message complet", { exact: true }).click()
    check(await fullReply.isVisible(), true, "Complete private email stays accessible")
    await privateReply.getByText("Replier le message", { exact: true }).click()
    check(
      await history
        .getByText("Réponse reçue par email", { exact: true })
        .locator("xpath=ancestor::li")
        .locator("time")
        .getAttribute("datetime"),
      "2026-10-04T09:00:00Z",
      "Email reply uses actual receipt date",
    )
    check(
      await history
        .getByText("Oui, nous pouvons venir mardi.", { exact: true })
        .count(),
      1,
      "Company answer kept",
    )
    check(
      await page.getByText("Ne jamais afficher", { exact: true }).count(),
      0,
      "Foreign quote/company excluded",
    )
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      `No overflow ${width}`,
    )
    const advanced = page
      .locator("summary")
      .filter({ hasText: /^Relances automatiques$/ })
    if (await advanced.isVisible()) await advanced.click()
    const audit = page
      .locator("summary", { hasText: "Historique des envois automatiques" })
      .locator("..")
    check(
      await audit.evaluate((element) => element.open),
      false,
      "Job audit starts collapsed",
    )
    await audit.locator("summary").click()
    await audit.getByRole("heading", { name: "Envois enregistrés" }).waitFor()
    check(await audit.evaluate((element) => element.open), true, "Job audit opens")
    await audit.locator("summary").click()
    await page.getByRole("button", { name: "Envois", exact: true }).click()
    check(
      await history.getByText("Question du client", { exact: true }).count(),
      0,
      "Sending filter excludes messages",
    )
    check(
      await history.getByText("Email non livré", { exact: true }).count(),
      1,
      "Sending filter retains delivery failure",
    )
    await page.getByRole("button", { name: "Tout", exact: true }).click()
    if (width === 390) {
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
      check(
        violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
        [],
        "Timeline accessible",
      )
      await page.screenshot({ path: artifacts + "timeline-mobile.png", fullPage: true })
    }
    await page.context().close()
  }
  // Every table paginates together; a partial continuation cannot skip unseen rows.
  const pagination = await pageFor({
    timelineEvents: Array.from({ length: 150 }, (_, index) =>
      event(`note-${String(index).padStart(3, "0")}`, {
        content: `Pagination note ${index}`,
        occurred_at: new Date(Date.parse(stamp) + index * 60000).toISOString(),
      }),
    ),
    timelineMessages: [
      message("older-message", {
        content: "Message plus ancien",
        created_at: "2020-01-01T12:00:00Z",
      }),
    ],
  })
  await visit(pagination)
  const history = pagination.getByRole("list", {
    name: "Historique chronologique du devis",
  })
  await history.getByText("Pagination note 149", { exact: true }).waitFor()
  check(await history.locator("li").count(), 25, "First visible batch")
  await pagination
    .getByRole("button", { name: "Afficher plus d’activité", exact: true })
    .click()
  check(
    await history.locator("li").count(),
    50,
    "Next source pages loaded before revealing more history",
  )
  check(
    await history.getByText("Message plus ancien", { exact: true }).count(),
    0,
    "An older message cannot displace still-unloaded newer events",
  )
  await pagination.evaluate(() => {
    window.__scenario.automationFailure = "quote_client_messages"
  })
  await pagination
    .getByRole("button", { name: "Afficher plus d’activité", exact: true })
    .click()
  await pagination.getByText(/Activité partielle : les échanges client/).waitFor()
  check(
    await history.locator("li").count(),
    50,
    "Failed continuation retains existing items",
  )
  await pagination.evaluate(() => {
    window.__scenario.automationFailure = null
  })
  await pagination
    .getByRole("button", { name: "Réessayer le chargement de la suite", exact: true })
    .click()
  await history.getByText("Pagination note 75", { exact: true }).waitFor()
  for (let batch = 0; batch < 4; batch++) {
    await pagination
      .getByRole("button", { name: "Afficher plus d’activité", exact: true })
      .click()
  }
  await history.getByText("Pagination note 0", { exact: true }).waitFor()
  check(
    await history.getByText(/^Pagination note /).count(),
    150,
    "Retry recovers all notes without gaps",
  )
  const pages = await pagination.evaluate(() =>
    window.__timelineReads
      .filter((row) => row.table === "quote_events")
      .map((row) => row.start),
  )
  check(
    pages.filter((offset) => offset > 0),
    [50, 100, 100],
    "Failed page is retried at the same offset",
  )
  check(
    pages.slice(0, -3).every((offset) => offset === 0),
    true,
    "Only initial page is repeated by StrictMode",
  )
  await pagination.context().close()
  const pending = await pageFor({
    timelineInitialJobs: [job({ status: "processing", sent_at: null })],
    timelineDelay: 180,
  })
  await visit(pending)
  await pending.getByText("Envoi du devis en cours", { exact: true }).waitFor()
  check(
    await pending
      .getByRole("list", { name: "Historique chronologique du devis" })
      .getByText("Devis remis au service email", { exact: true })
      .count(),
    0,
    "Processing never claims provider acceptance",
  )
  await pending.evaluate(() => {
    window.__scenario.timelineDelay = 700
  })
  await pending.getByRole("button", { name: "Actualiser l’activité du devis" }).click()
  await visit(pending, "/app/quotes/draft-test", "TEST-002")
  await pending.waitForTimeout(800)
  check(
    await pending.getByText("Envoi du devis en cours", { exact: true }).count(),
    0,
    "Late response from another quote is ignored",
  )
  check(
    await pending
      .getByRole("list", { name: "Historique chronologique du devis" })
      .locator("li")
      .count(),
    0,
    "Draft activity stays empty",
  )
  await pending.context().close()
  check(errors, [], "No browser errors")
  check(external, [], "No external service or email requests")
  console.log(`PASS: ${checks} timeline checks`)
} finally {
  if (browser) await browser.close()
  if (server) {
    try {
      process.kill(-server.pid, "SIGTERM")
    } catch {
      /* stopped */
    }
  }
}
