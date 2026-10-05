// Browser-only fixture. Document extraction and OCR remain the real code.
import { supabase as base, isSupabaseConfigured } from "/__document-base-fixture.mjs"

export { isSupabaseConfigured }
const options = window.__scenario || {}
const db = window.__testStore
db.quote_documents = []
db.quote_initial_send_jobs = []
const files = new Map()
const calls = []
window.__documentCalls = calls
window.__documentFiles = files

function failure(code, message) {
  return { data: null, error: { code, message } }
}

async function attachDocument(args) {
  const quote = db.quotes.find(
    (entry) => entry.id === args.p_quote_id && entry.company_id === "company-test",
  )
  if (!quote || quote.status !== "draft" || !files.has(args.p_document.storage_path))
    return failure("22023", "Confirmez un brouillon et son document.")
  if (db.quote_documents.some((entry) => entry.quote_id === quote.id))
    return failure("23505", "Document déjà joint.")
  const document = {
    ...args.p_document,
    company_id: quote.company_id,
    quote_id: quote.id,
    created_at: new Date().toISOString(),
  }
  db.quote_documents.push(document)
  return { data: { ...document }, error: null }
}

async function saveImportedQuote(args) {
  if (options.documentDelay)
    await new Promise((resolve) => setTimeout(resolve, options.documentDelay))
  if (options.documentSaveFailure)
    return failure("XX000", "L’enregistrement de test a échoué.")
  if (args.p_company_id !== "company-test")
    return failure("42501", "Entreprise non autorisée.")
  const existing = db.quotes.find((quote) => quote.id === args.p_quote_id)
  if (existing) return { data: { ...existing }, error: null }
  if (
    db.quotes.some(
      (quote) =>
        quote.company_id === args.p_company_id &&
        quote.reference.toLowerCase() === args.p_reference.toLowerCase(),
    )
  )
    return failure("23505", "Un devis possède déjà cette référence.")
  let client = args.p_client_id
    ? db.clients.find(
        (entry) =>
          entry.id === args.p_client_id && entry.company_id === args.p_company_id,
      )
    : null
  if (!client && args.p_new_client?.name?.trim()) {
    client = {
      id: window.crypto.randomUUID(),
      company_id: args.p_company_id,
      name: args.p_new_client.name.trim(),
      email: args.p_new_client.email?.trim() || null,
      phone: args.p_new_client.phone?.trim() || null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }
  if (!client) return failure("22023", "Confirmez le client du devis.")
  if (args.p_already_sent && !args.p_sent_at)
    return failure("22023", "Une date d’envoi est requise.")
  if (args.p_document && !files.has(args.p_document.storage_path))
    return failure("22023", "Document non téléversé.")
  if (!db.clients.some((entry) => entry.id === client.id)) db.clients.push(client)
  const quote = {
    id: args.p_quote_id,
    company_id: args.p_company_id,
    client_id: client.id,
    reference: args.p_reference,
    amount_cents: args.p_amount_cents,
    status: args.p_already_sent ? "sent" : "draft",
    sent_at: args.p_already_sent ? args.p_sent_at : null,
    expires_at: args.p_expires_at,
    notes: args.p_notes,
    next_followup_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  db.quotes.push(quote)
  if (args.p_document)
    db.quote_documents.push({
      ...args.p_document,
      company_id: quote.company_id,
      quote_id: quote.id,
      uploaded_by: "user-test",
      content_type: "application/pdf",
      created_at: new Date().toISOString(),
    })
  return { data: { ...quote }, error: null }
}

export const supabase = {
  ...base,
  rpc: (name, args) => {
    if (!["save_imported_quote", "attach_quote_document"].includes(name))
      return base.rpc(name, args)
    const call = {
      type: "rpc",
      name,
      args: window.structuredClone(args),
      completed: false,
    }
    calls.push(call)
    const request = (
      name === "save_imported_quote" ? saveImportedQuote(args) : attachDocument(args)
    ).then((result) => {
      call.completed = true
      return result
    })
    request.abortSignal = () => request
    return request
  },
  storage: {
    from: (bucket) => ({
      upload: async (path, file, config) => {
        calls.push({
          type: "upload",
          bucket,
          path,
          size: file.size,
          contentType: file.type,
          config,
        })
        if (bucket !== "quote-documents" || !path.startsWith("company-test/user-test/"))
          return failure("42501", "Chemin non autorisé.")
        if (options.documentUploadFailure)
          return failure("500", "Téléversement de test impossible.")
        if (files.has(path)) return failure("409", "Document déjà présent.")
        files.set(path, file)
        return { data: { path }, error: null }
      },
      remove: async (paths) => {
        calls.push({ type: "remove", bucket, paths })
        // Production authenticated users cannot delete storage objects. The
        // service cleanup worker removes staged orphans after its safety delay.
        return failure("42501", "Suppression réservée au nettoyage du service.")
      },
      download: async (path) => {
        calls.push({ type: "download", bucket, path })
        return files.has(path)
          ? { data: files.get(path), error: null }
          : failure("404", "Document absent.")
      },
      createSignedUrl: async (path) =>
        files.has(path)
          ? { data: { signedUrl: URL.createObjectURL(files.get(path)) }, error: null }
          : failure("404", "Document absent."),
    }),
  },
  functions: {
    invoke: async (name, optionsValue) => {
      if (name !== "send-quote-document")
        return base.functions.invoke(name, optionsValue)
      const body = optionsValue.body
      const call = {
        type: "edge",
        name,
        body: window.structuredClone(body),
        completed: false,
      }
      calls.push(call)
      if (options.documentSendDelay)
        await new Promise((resolve) => setTimeout(resolve, options.documentSendDelay))
      const quote = db.quotes.find(
        (entry) => entry.id === body.quoteId && entry.company_id === "company-test",
      )
      if (!quote || !db.quote_documents.some((entry) => entry.quote_id === quote.id))
        return failure("22023", "Un document confirmé est requis.")
      if (quote.status !== "draft") return failure("409", "Ce devis a déjà été envoyé.")
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.recipientEmail || ""))
        return failure("22023", "Confirmez le destinataire.")
      const previous = db.quote_initial_send_jobs.find(
        (entry) => entry.quote_id === quote.id,
      )
      if (previous && !body.retry)
        return { data: { state: previous.status, job: { ...previous } }, error: null }
      if (
        previous?.status === "delivery_unknown" &&
        (previous.recipient_email !== body.recipientEmail ||
          previous.subject !== body.subject ||
          previous.body !== body.message)
      )
        return failure("409", "Reprise du même message requise.")
      const now = new Date().toISOString()
      const job = previous || {
        id: window.crypto.randomUUID(),
        quote_id: quote.id,
        company_id: quote.company_id,
        recipient_email: body.recipientEmail,
        subject: body.subject,
        body: body.message,
        attempts: 0,
        first_attempt_at: options.documentFirstAttemptAt || now,
        provider_message_id: null,
        sent_at: null,
        created_at: now,
        last_error_code: null,
      }
      if (!previous) db.quote_initial_send_jobs.push(job)
      job.attempts++
      job.updated_at = now
      const mode = !previous ? options.documentSendMode : null
      job.status =
        mode === "unknown"
          ? "delivery_unknown"
          : mode === "processing"
            ? "processing"
            : mode === "failed"
              ? "failed"
              : "sent"
      job.last_error_code =
        mode === "failed"
          ? "provider_domain_not_verified"
          : mode === "unknown"
            ? "provider_network_unknown"
            : null
      if (job.status === "sent") {
        job.provider_message_id = "document-provider-test"
        job.sent_at = now
        quote.status = "sent"
        quote.sent_at = now.slice(0, 10)
        db.quote_events.push({
          id: window.crypto.randomUUID(),
          company_id: quote.company_id,
          quote_id: quote.id,
          event_type: "sent",
          content: job.body,
          created_by: "user-test",
          initial_send_job_id: job.id,
          delivery_status: "sent",
          occurred_at: now,
          created_at: now,
        })
        db.notifications.push({
          id: window.crypto.randomUUID(),
          company_id: quote.company_id,
          user_id: "user-test",
          type: "quote_sent",
          related_quote_id: quote.id,
          initial_send_job_id: job.id,
          title: "Devis envoyé",
          message: "Le service email a accepté le devis et sa pièce jointe.",
          created_at: now,
          read_at: null,
        })
      }
      call.completed = true
      if (options.documentSendResponseFailure && !previous)
        return { data: null, error: { message: "Test response lost" } }
      return {
        data: { state: job.status, job: { ...job }, error: job.last_error_code },
        error: null,
      }
    },
  },
}
