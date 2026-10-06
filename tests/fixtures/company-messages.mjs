// Browser-only preferences fixture; every remote request is blocked by the runner.
import { supabase, isSupabaseConfigured } from "/__company-document-fixture.mjs"
export { supabase, isSupabaseConfigured }
const options = window.__scenario || {}
const db = window.__testStore
const stamp = new Date().toISOString()
db.company_message_templates = options.noCompanyMessages
  ? []
  : [
      "quote_send",
      "automatic_followup",
      "first_followup",
      "second_followup",
      "expiry_followup",
    ].map((kind) => ({
      company_id: "company-test",
      kind,
      subject_template: "Votre devis {{quote_reference}} chez {{company_name}}",
      body_template:
        "Bonjour {{client_name}},\n\nVotre devis {{quote_reference}} : {{amount_formatted}}.",
      created_at: stamp,
      updated_at: stamp,
    }))
db.company_message_profiles = options.noCompanyMessages
  ? []
  : [
      {
        company_id: "company-test",
        email_signature: "Ethan Noto\n06 12 34 56 78",
        created_at: stamp,
        updated_at: stamp,
      },
    ]
db.quote_client_messages = []
db.quote_email_deliveries = []
db.quote_work_orders = []
const draft = db.quotes.find((row) => row.id === "draft-test")
if (draft && options.hasDocument)
  db.quote_documents.push({
    id: "document-test",
    quote_id: draft.id,
    company_id: draft.company_id,
    file_name: "devis-original.pdf",
    content_type: "application/pdf",
    size_bytes: 10,
    storage_path: "company-test/user-test/original.pdf",
    sha256: "a".repeat(64),
    created_at: stamp,
  })
if (draft && options.frozenJob)
  db.quote_initial_send_jobs.push({
    id: "initial-test",
    quote_id: draft.id,
    company_id: draft.company_id,
    status: "processing",
    recipient_email: "client@example.test",
    subject: "Objet figé",
    body: "Message figé",
    created_at: stamp,
    first_attempt_at: stamp,
    attempts: 1,
  })
window.__companyMessageCalls = []
window.__companyMessageQueries = []
window.__companyMessageReadFailure = Boolean(options.companyMessagesFailure)
const from = supabase.from
supabase.from = (table) => {
  const query = from(table)
  if (!["company_message_templates", "company_message_profiles"].includes(table))
    return query
  const originalThen = query.then
  query.then = function (resolve, reject) {
    window.__companyMessageQueries.push({ table })
    return (async () => {
      if (options.companyMessagesDelay)
        await new Promise((done) => setTimeout(done, options.companyMessagesDelay))
      if (window.__companyMessageReadFailure)
        return { data: null, error: { message: "Preferences read failure" } }
      const result = await originalThen.call(this, (value) => value)
      if (options.wrongCompanyTemplate && table === "company_message_templates")
        result.data = result.data.map((row) => ({
          ...row,
          company_id: "company-other",
        }))
      return result
    })().then(resolve, reject)
  }
  return query
}
const rpc = supabase.rpc
supabase.rpc = (name, args) => {
  if (name === "read_quote_email_tracking_status")
    return Promise.resolve({
      data: { deliveryReady: false, receivingReady: false, code: "unconfigured" },
      error: null,
    })
  if (
    ![
      "save_company_message_template",
      "delete_company_message_template",
      "save_company_message_profile",
    ].includes(name)
  )
    return rpc(name, args)
  const call = { name, args: window.structuredClone(args) }
  window.__companyMessageCalls.push(call)
  return (async () => {
    if (options.companyMessagesSaveDelay)
      await new Promise((done) => setTimeout(done, options.companyMessagesSaveDelay))
    if (options.companyMessagesSaveFailure)
      return { data: null, error: { message: "Preferences save failure" } }
    if (!options.admin && options.memberRole === "member")
      return { data: null, error: { code: "42501", message: "Propriétaire requis." } }
    if (name === "save_company_message_profile") {
      const row = {
        company_id: args.p_company_id,
        email_signature: args.p_email_signature,
        created_at: stamp,
        updated_at: stamp,
      }
      db.company_message_profiles = db.company_message_profiles.filter(
        (row) => row.company_id !== args.p_company_id,
      )
      db.company_message_profiles.push(row)
      return { data: row, error: null }
    }
    db.company_message_templates = db.company_message_templates.filter(
      (row) => row.company_id !== args.p_company_id || row.kind !== args.p_kind,
    )
    if (name === "delete_company_message_template") return { data: null, error: null }
    const row = {
      company_id: args.p_company_id,
      kind: args.p_kind,
      subject_template: args.p_subject_template,
      body_template: args.p_body_template,
      created_at: stamp,
      updated_at: stamp,
    }
    db.company_message_templates.push(row)
    return { data: row, error: null }
  })()
}
