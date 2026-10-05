// Browser-only fixture; no live backend or email provider is used.
import { supabase, isSupabaseConfigured } from "/__workspace-base-fixture.mjs"
export { supabase, isSupabaseConfigured }
const options = window.__scenario || {}
const db = window.__testStore
const company = db.companies.find((entry) => entry.id === "company-test")
const today = new Date()
const ago = new Date(today.getTime() - 86400000 * 5)
db.quote_client_messages = []
db.quote_email_deliveries = []
const workspaceQueries = []
window.__workspaceQueries = workspaceQueries
window.__workspaceFailure = options.workspaceFailure ?? null
const originalWorkspaceFrom = supabase.from
supabase.from = (table) => {
  const query = originalWorkspaceFrom(table)
  const filters = []
  const originalEq = query.eq
  query.eq = function (key, value) {
    filters.push([key, value])
    return originalEq.call(this, key, value)
  }
  const originalThen = query.then
  query.then = function (resolve, reject) {
    workspaceQueries.push({ table, filters })
    if (window.__workspaceFailure === table)
      return Promise.resolve({ data: null, error: { message: "Read failure" } }).then(
        resolve,
        reject,
      )
    return originalThen.call(this, resolve, reject)
  }
  return query
}
if (options.workspace === "standard") {
  db.company_email_settings = [
    {
      company_id: company.id,
      reply_to: "contact@example.test",
      automation_paused: false,
      updated_at: today.toISOString(),
    },
  ]
  const base = db.quotes.find((quote) => quote.id === "quote-test")
  const add = (id) => {
    const row = {
      ...base,
      id,
      reference: id.toUpperCase(),
      created_at: ago.toISOString(),
    }
    db.quotes.push(row)
    return row
  }
  for (const id of ["auto-quote", "paused-quote", "question-quote", "bounced-quote"])
    add(id)
  db.quote_followup_automations.push(
    {
      quote_id: "auto-quote",
      company_id: company.id,
      enabled: true,
      paused: false,
      next_send_at: new Date(today.getTime() + 86400000 * 2).toISOString(),
      stop_reason: null,
    },
    {
      quote_id: "paused-quote",
      company_id: company.id,
      enabled: true,
      paused: true,
      next_send_at: today.toISOString(),
      stop_reason: null,
    },
  )
  db.quote_client_messages.push({
    id: "question-one",
    company_id: company.id,
    quote_id: "question-quote",
    author: "client",
    kind: "question",
    created_at: today.toISOString(),
  })
  db.quote_email_deliveries.push({
    id: "bounce-one",
    company_id: company.id,
    quote_id: "bounced-quote",
    status: "bounced",
    created_at: ago.toISOString(),
    last_event_at: today.toISOString(),
  })
}
if (options.workspace === "send-unresolved") {
  const quote = db.quotes.find((entry) => entry.id === "quote-test")
  db.quotes = [quote]
  quote.status = "draft"
  quote.sent_at = null
  db.quote_initial_send_jobs.push({
    id: "workspace-send-one",
    company_id: company.id,
    quote_id: quote.id,
    status: options.workspaceSendStatus,
    created_at: today.toISOString(),
  })
}
