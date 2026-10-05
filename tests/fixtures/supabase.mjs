// This module is served only by the browser test runner, never by the product.
const today = new Date()
const ago = new Date(today)
ago.setDate(ago.getDate() - 5)
const iso = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
const options = window.__scenario || {}
const company = {
  id: "company-test",
  name: "Entreprise de test",
  created_at: today.toISOString(),
  updated_at: today.toISOString(),
}
const user = { id: "user-test", email: "test@example.test" }
let session = options.session ? { user } : null
const listeners = new Set()
const db = {
  companies: [company],
  company_members:
    options.member === false
      ? []
      : [
          {
            company_id: company.id,
            user_id: user.id,
            role: options.memberRole ?? "owner",
            companies: company,
            email_followup_reminders: true,
            followup_delay_days: 3,
            reminder_hour: 8,
          },
        ],
  clients: options.empty
    ? []
    : [
        {
          id: "client-test",
          company_id: company.id,
          name: "Client de test",
          email: options.clientWithoutEmail ? null : "client@example.test",
          phone: "0102030405",
          notes: "Note de test",
          created_at: today.toISOString(),
          updated_at: today.toISOString(),
        },
      ],
  quotes: options.empty
    ? []
    : [
        {
          id: "quote-test",
          company_id: company.id,
          client_id: "client-test",
          reference: "TEST-001",
          amount_cents: 125050,
          status: options.quoteStatus ?? "sent",
          sent_at: iso(ago),
          expires_at: options.expiresToday
            ? new Intl.DateTimeFormat("en-CA", {
                timeZone: "Europe/Paris",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(today)
            : null,
          notes: "Dossier de test",
          created_at: today.toISOString(),
          updated_at: today.toISOString(),
          next_followup_at: null,
        },
        {
          id: "draft-test",
          company_id: company.id,
          client_id: "client-test",
          reference: "TEST-002",
          amount_cents: 10000,
          status: "draft",
          sent_at: null,
          notes: null,
          created_at: today.toISOString(),
          updated_at: today.toISOString(),
        },
      ],
  quote_events: [],
  quote_documents: [],
  quote_initial_send_jobs: [],
  notifications: [
    {
      id: "notification-test",
      user_id: user.id,
      company_id: company.id,
      type: "quote_followup_due",
      related_quote_id: "quote-test",
      support_thread_id: null,
      support_message_id: null,
      title: "Relance de test",
      message: "Notification de test",
      read_at: null,
      created_at: today.toISOString(),
    },
  ],
  support_threads: [],
  support_messages: [],
  company_email_settings:
    options.automation && options.automationConfigured !== false
      ? [
          {
            company_id: company.id,
            reply_to: "contact@example.test",
            automation_paused: Boolean(options.companyAutomationPaused),
            updated_at: today.toISOString(),
          },
        ]
      : [],
  quote_followup_automations: [],
  quote_followup_jobs: [],
}
window.__testStore = db
const automationCalls = []
window.__automationCalls = automationCalls
const quoteMutationCalls = []
window.__quoteMutationCalls = quoteMutationCalls

const messagingCalls = []
const messagingRequests = new Map()
window.__messagingCalls = messagingCalls
if (options.messaging && !options.messagingEmpty) {
  db.support_threads.push(
    { id: "thread-test", user_id: user.id },
    { id: "thread-other", user_id: "user-owner" },
    ...Array.from({ length: 26 }, (_, index) => ({
      id: `thread-extra-${index + 1}`,
      user_id: `user-extra-${index + 1}`,
    })),
  )
  db.support_threads.forEach((thread, index) => {
    thread.created_at = ago.toISOString()
    thread.updated_at = new Date(today.getTime() - index * 60000).toISOString()
  })
  db.support_messages.push(
    {
      id: "message-user-test",
      thread_id: "thread-test",
      sender_id: user.id,
      sender_role: "user",
      body: "Question de test",
      created_at: ago.toISOString(),
      request_id: "request-user-test",
    },
    {
      id: "message-admin-test",
      thread_id: "thread-test",
      sender_id: "user-admin-other",
      sender_role: "admin",
      body: "Réponse de l’équipe de test",
      created_at: today.toISOString(),
      request_id: "request-admin-test",
    },
    {
      id: "message-user-other",
      thread_id: "thread-other",
      sender_id: "user-owner",
      sender_role: "user",
      body: "Question de l’autre compte",
      created_at: today.toISOString(),
      request_id: "request-user-other",
    },
  )
  db.support_threads.slice(2).forEach((thread, index) => {
    db.support_messages.push({
      id: `message-extra-${index + 1}`,
      thread_id: thread.id,
      sender_id: thread.user_id,
      sender_role: "user",
      body: `Question supplémentaire ${index + 1}`,
      created_at: thread.updated_at,
      request_id: `request-extra-${index + 1}`,
    })
  })
  db.notifications.push({
    id: "notification-announcement",
    user_id: user.id,
    company_id: null,
    type: "admin_announcement",
    title: "Informations de test",
    message: "Information conservée après lecture.",
    related_quote_id: null,
    support_thread_id: null,
    support_message_id: null,
    read_at: null,
    created_at: new Date(today.getTime() + 1000).toISOString(),
  })
  db.notifications.push({
    id: "notification-message",
    user_id: user.id,
    company_id: null,
    type: options.admin ? "support_message" : "admin_message",
    title: options.admin
      ? "Nouveau message de owner-other@example.test"
      : "Réponse de Cadova",
    message: options.admin
      ? "Question de l’autre compte"
      : "Réponse de l’équipe de test",
    related_quote_id: null,
    support_thread_id: options.admin ? "thread-other" : "thread-test",
    support_message_id: options.admin ? "message-user-other" : "message-admin-test",
    read_at: null,
    created_at: new Date(today.getTime() + 2000).toISOString(),
  })
  if (options.messagingPages) {
    for (let index = 1; index <= 26; index++) {
      const created = new Date(ago.getTime() - index * 60000).toISOString()
      db.notifications.push({
        id: `notification-history-${index}`,
        user_id: user.id,
        company_id: null,
        type: "admin_announcement",
        title: `Information archivée ${String(index).padStart(2, "0")}`,
        message: `Information historique ${index}.`,
        read_at: today.toISOString(),
        created_at: created,
        support_thread_id: null,
        support_message_id: null,
        related_quote_id: null,
      })
      db.support_messages.push({
        id: `message-history-${index}`,
        thread_id: "thread-test",
        sender_id: user.id,
        sender_role: "user",
        body: `Ancien message ${String(index).padStart(2, "0")}`,
        created_at: created,
        request_id: `request-history-${index}`,
      })
    }
  }
}
const messagingStorageKey = "cadova-test-messaging"
if (options.messaging) {
  const saved = window.sessionStorage.getItem(messagingStorageKey)
  if (saved) {
    const state = JSON.parse(saved)
    db.support_threads = state.support_threads
    db.support_messages = state.support_messages
    db.notifications = state.notifications
  }
}
function persistMessaging() {
  if (options.messaging)
    window.sessionStorage.setItem(
      messagingStorageKey,
      JSON.stringify({
        support_threads: db.support_threads,
        support_messages: db.support_messages,
        notifications: db.notifications,
      }),
    )
}

const otherCompany = {
  id: "company-other",
  name: "Autre entreprise",
  created_at: ago.toISOString(),
  updated_at: today.toISOString(),
}
const adminUsers = options.admin
  ? [
      { ...user, is_admin: true },
      { id: "user-admin-other", email: "second-admin@example.test", is_admin: true },
      { id: "user-owner", email: "owner-other@example.test" },
      { id: "user-suspended", email: "suspended@example.test", suspended: true },
      { id: "user-delete", email: "delete-me@example.test" },
      { id: "user-transfer", email: "future-owner@example.test" },
      ...Array.from({ length: 26 }, (_, index) => ({
        id: `user-extra-${index + 1}`,
        email: `extra-${String(index + 1).padStart(2, "0")}@example.test`,
      })),
    ].map(({ suspended, ...account }) => ({
      ...account,
      is_admin: Boolean(account.is_admin),
      created_at: ago.toISOString(),
      last_sign_in_at: today.toISOString(),
      email_confirmed_at: ago.toISOString(),
      banned_until: suspended
        ? new Date(today.getTime() + 86400000).toISOString()
        : null,
      companies: [],
    }))
  : []
const adminCompanies = options.admin
  ? [
      company,
      otherCompany,
      ...Array.from({ length: 30 }, (_, index) => ({
        id: `company-extra-${index + 1}`,
        name: `Entreprise supplémentaire ${String(index + 1).padStart(2, "0")}`,
        created_at: ago.toISOString(),
        updated_at: today.toISOString(),
      })),
    ].map((entry) => ({ ...entry, owners: [] }))
  : []
if (options.admin || options.automation) {
  db.companies.push(otherCompany, ...adminCompanies.slice(2))
  db.company_members.push({
    company_id: otherCompany.id,
    user_id: "user-owner",
    role: "owner",
    companies: otherCompany,
  })
  db.clients.push({
    id: "client-other",
    company_id: otherCompany.id,
    name: "Client autre entreprise",
    email: "client-other@example.test",
    phone: null,
    notes: "Dossier de l’autre entreprise",
    created_at: today.toISOString(),
    updated_at: today.toISOString(),
  })
  db.quotes.push({
    id: "quote-other",
    company_id: otherCompany.id,
    client_id: "client-other",
    reference: "OTHER-001",
    amount_cents: 45600,
    status: "sent",
    sent_at: iso(ago),
    created_at: today.toISOString(),
    updated_at: today.toISOString(),
    next_followup_at: null,
  })
}

function syncAdminMemberships() {
  adminUsers.forEach((account) => {
    account.companies = db.company_members
      .filter((member) => member.user_id === account.id)
      .map((member) => ({
        id: member.company_id,
        name: db.companies.find((entry) => entry.id === member.company_id)?.name,
        role: member.role,
      }))
  })
  adminCompanies.forEach((entry) => {
    entry.owners = db.company_members
      .filter((member) => member.company_id === entry.id && member.role === "owner")
      .map((member) => ({
        id: member.user_id,
        email:
          adminUsers.find((account) => account.id === member.user_id)?.email ?? null,
      }))
  })
}
const companyStorageKey = "cadova-test-companies"
const companyCalls = []
window.__companyCalls = companyCalls
if (options.companyManagement) {
  const saved = window.sessionStorage.getItem(companyStorageKey)
  if (saved) {
    Object.assign(db, JSON.parse(saved))
    adminCompanies.splice(
      0,
      adminCompanies.length,
      ...[...db.companies]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((entry) => ({ ...entry, owners: [] })),
    )
  }
}
function persistCompanies() {
  if (options.companyManagement)
    window.sessionStorage.setItem(
      companyStorageKey,
      JSON.stringify({
        companies: db.companies,
        company_members: db.company_members,
        clients: db.clients,
        quotes: db.quotes,
        quote_events: db.quote_events,
        notifications: db.notifications,
      }),
    )
}
syncAdminMemberships()
window.__adminTestStore = { users: adminUsers, companies: adminCompanies }

async function companyRpc(name, args = {}) {
  companyCalls.push({ name, args })
  if (!session || !options.admin)
    return {
      data: null,
      error: {
        code: "42501",
        message:
          name === "admin_create_company"
            ? "La création d’entreprise est réservée à un administrateur actif."
            : "La suppression d’entreprise est réservée à un administrateur actif.",
      },
    }
  if (options.companyDelay)
    await new Promise((resolve) => setTimeout(resolve, options.companyDelay))
  if (options.companyFailure === name)
    return {
      data: null,
      error: { code: "XX000", message: "Test company connection failure" },
    }
  if (name === "admin_create_company") {
    const companyName = args.company_name?.trim() ?? ""
    if (!companyName || companyName.length > 120)
      return {
        data: null,
        error: {
          code: "22023",
          message: "Le nom de l’entreprise doit contenir entre 1 et 120 caractères.",
        },
      }
    const owner = adminUsers.find(
      (account) => account.id === (args.owner_id ?? user.id),
    )
    if (!owner || (owner.banned_until && owner.banned_until > new Date().toISOString()))
      return {
        data: null,
        error: { code: "P0002", message: "Ce propriétaire est supprimé ou suspendu." },
      }
    if (
      !owner.is_admin &&
      db.company_members.some((member) => member.user_id === owner.id)
    )
      return {
        data: null,
        error: {
          code: "23514",
          message: "Ce compte appartient déjà à une entreprise.",
        },
      }
    const entry = {
      id: `company-created-${db.companies.length + 1}`,
      name: companyName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    db.companies.push(entry)
    db.company_members.push({
      company_id: entry.id,
      user_id: owner.id,
      role: "owner",
      companies: entry,
      email_followup_reminders: true,
      followup_delay_days: 3,
      reminder_hour: 8,
    })
    adminCompanies.unshift({ ...entry, owners: [] })
    syncAdminMemberships()
    persistCompanies()
    return { data: entry.id, error: null }
  }
  const entry = db.companies.find((company) => company.id === args.target_company_id)
  if (!entry)
    return {
      data: null,
      error: {
        code: "P0002",
        message: "Cette entreprise n’existe plus. Actualisez la liste.",
      },
    }
  if (args.confirmation_name?.trim() !== entry.name)
    return {
      data: null,
      error: {
        code: "22023",
        message: "Le nom saisi ne correspond pas au nom actuel de l’entreprise.",
      },
    }
  const quoteIds = new Set(
    db.quotes.filter((quote) => quote.company_id === entry.id).map((quote) => quote.id),
  )
  db.companies = db.companies.filter((company) => company.id !== entry.id)
  db.company_members = db.company_members.filter(
    (member) => member.company_id !== entry.id,
  )
  db.clients = db.clients.filter((client) => client.company_id !== entry.id)
  db.quotes = db.quotes.filter((quote) => quote.company_id !== entry.id)
  db.quote_events = db.quote_events.filter((event) => !quoteIds.has(event.quote_id))
  db.notifications = db.notifications.filter(
    (notification) => notification.company_id !== entry.id,
  )
  for (const table of [
    "company_email_settings",
    "quote_followup_automations",
    "quote_followup_jobs",
  ])
    db[table] = db[table].filter((row) => row.company_id !== entry.id)
  adminCompanies.splice(
    adminCompanies.findIndex((company) => company.id === entry.id),
    1,
  )
  syncAdminMemberships()
  persistCompanies()
  return { data: entry.id, error: null }
}

function adminFailure(code, message, status = 400) {
  return {
    data: null,
    error: {
      message: "Edge Function returned a non-2xx status code",
      context: new window.Response(JSON.stringify({ error: { code, message } }), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    },
  }
}

function messagingFailure(code, message) {
  return { data: null, error: { code, message } }
}

function supportSummary(thread) {
  const last = db.support_messages
    .filter((message) => message.thread_id === thread.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  return {
    ...thread,
    user_email:
      thread.user_id === user.id
        ? user.email
        : (adminUsers.find((account) => account.id === thread.user_id)?.email ??
          `${thread.user_id}@example.test`),
    last_body: last?.body ?? null,
    last_sender_role: last?.sender_role ?? null,
    unread_count: db.notifications.filter(
      (notification) =>
        notification.user_id === user.id &&
        notification.support_thread_id === thread.id &&
        !notification.read_at,
    ).length,
  }
}

async function messagingRpc(name, args = {}) {
  messagingCalls.push({ name, args })
  if (!session) return messagingFailure("42501", "Connexion requise.")
  if (options.messagingDelay && name.startsWith("send_"))
    await new Promise((resolve) => setTimeout(resolve, options.messagingDelay))
  if (options.messagingFailure === name)
    return messagingFailure("XX000", "Test messaging connection failure")
  if (name === "list_support_threads") {
    const page = args.p_page ?? 1
    const pageSize = args.p_page_size ?? 25
    const threads = db.support_threads
      .filter((thread) => options.admin || thread.user_id === user.id)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    return {
      data: threads
        .slice((page - 1) * pageSize, page * pageSize + 1)
        .map(supportSummary),
      error: null,
    }
  }
  if (name === "mark_support_thread_read") {
    const thread = db.support_threads.find((entry) => entry.id === args.p_thread_id)
    if (!thread || (!options.admin && thread.user_id !== user.id))
      return messagingFailure("42501", "Accès refusé.")
    const notifications = db.notifications.filter(
      (entry) =>
        entry.user_id === user.id &&
        entry.support_thread_id === thread.id &&
        !entry.read_at,
    )
    notifications.forEach((entry) => {
      entry.read_at = new Date().toISOString()
    })
    persistMessaging()
    return { data: notifications.length, error: null }
  }
  if (name === "send_support_message") {
    const body = args.p_body?.trim() ?? ""
    if (!body || body.length > 4000)
      return messagingFailure("22023", "Message invalide.")
    let thread = args.p_thread_id
      ? db.support_threads.find((entry) => entry.id === args.p_thread_id)
      : db.support_threads.find((entry) => entry.user_id === user.id)
    if (args.p_thread_id && !thread)
      return messagingFailure("P0002", "Conversation introuvable.")
    if (thread && !options.admin && thread.user_id !== user.id)
      return messagingFailure("42501", "Accès refusé.")
    const requestKey = `${name}:${user.id}:${args.p_request_id}`
    const previous = messagingRequests.get(requestKey)
    if (previous)
      return previous.body === body && previous.threadId === (thread?.id ?? null)
        ? { data: previous.result, error: null }
        : messagingFailure("22023", "Identifiant de requête réutilisé.")
    if (!thread) {
      thread = {
        id: "thread-new-user-test",
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      db.support_threads.push(thread)
    }
    const message = {
      id: `message-new-${db.support_messages.length}`,
      thread_id: thread.id,
      sender_id: user.id,
      sender_role: options.admin ? "admin" : "user",
      body,
      created_at: new Date().toISOString(),
      request_id: args.p_request_id,
    }
    db.support_messages.push(message)
    thread.updated_at = message.created_at
    const recipients = options.admin
      ? [{ id: thread.user_id }]
      : adminUsers.length
        ? adminUsers.filter((account) => account.is_admin && account.id !== user.id)
        : [{ id: "user-admin-other" }]
    recipients.forEach((recipient) =>
      db.notifications.push({
        id: `notification-new-${db.notifications.length}`,
        user_id: recipient.id,
        company_id: null,
        type: options.admin ? "admin_message" : "support_message",
        title: options.admin ? "Réponse de Cadova" : `Nouveau message de ${user.email}`,
        message: body,
        support_thread_id: thread.id,
        support_message_id: message.id,
        related_quote_id: null,
        read_at: null,
        created_at: message.created_at,
      }),
    )
    messagingRequests.set(requestKey, { body, threadId: thread.id, result: thread.id })
    persistMessaging()
    return { data: thread.id, error: null }
  }
  if (name === "send_admin_notification") {
    if (!options.admin) return messagingFailure("42501", "Accès refusé.")
    const title = args.p_title?.trim() ?? ""
    const body = args.p_body?.trim() ?? ""
    if (!title || title.length > 120 || !body || body.length > 4000)
      return messagingFailure("22023", "Notification invalide.")
    const recipients = adminUsers.filter(
      (account) =>
        (!args.p_recipient_id || account.id === args.p_recipient_id) &&
        (!account.banned_until || account.banned_until <= new Date().toISOString()),
    )
    if (args.p_recipient_id && !recipients.length)
      return messagingFailure("P0002", "Destinataire introuvable.")
    const requestKey = `${name}:${user.id}:${args.p_request_id}`
    const previous = messagingRequests.get(requestKey)
    if (previous)
      return previous.title === title &&
        previous.body === body &&
        previous.recipient === args.p_recipient_id
        ? { data: previous.result, error: null }
        : messagingFailure("22023", "Identifiant de requête réutilisé.")
    recipients.forEach((recipient) =>
      db.notifications.push({
        id: `notification-new-${db.notifications.length}`,
        user_id: recipient.id,
        company_id: null,
        type: "admin_announcement",
        title,
        message: body,
        related_quote_id: null,
        support_thread_id: null,
        support_message_id: null,
        read_at: null,
        created_at: new Date().toISOString(),
      }),
    )
    const result = { recipient_count: recipients.length }
    messagingRequests.set(requestKey, {
      title,
      body,
      recipient: args.p_recipient_id,
      result,
    })
    persistMessaging()
    return { data: result, error: null }
  }
  return messagingFailure("22023", "Action inconnue.")
}

const automationStorageKey = "cadova-test-automation"
const automationTables = [
  "company_email_settings",
  "quote_followup_automations",
  "quote_followup_jobs",
  "quotes",
  "clients",
  "quote_events",
  "notifications",
]
const automationSubject = "Votre devis {{quote_reference}}"
const automationBody =
  "Bonjour {{client_name}}, avez-vous pu consulter le devis {{quote_reference}} ? {{company_name}}"
const parisDay = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
const addDays = (day, days) =>
  new Date(new Date(`${day}T12:00:00Z`).getTime() + days * 86400000)
    .toISOString()
    .slice(0, 10)
function scheduledAt(day) {
  const noon = new Date(`${day}T12:00:00Z`)
  const offset = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Paris",
    timeZoneName: "shortOffset",
  })
    .formatToParts(noon)
    .find((part) => part.type === "timeZoneName").value
  return new Date(
    `${day}T09:00:00${offset === "GMT+2" ? "+02:00" : "+01:00"}`,
  ).toISOString()
}
function persistAutomation() {
  if (options.automation)
    window.sessionStorage.setItem(
      automationStorageKey,
      JSON.stringify(
        Object.fromEntries(automationTables.map((table) => [table, db[table]])),
      ),
    )
}
function hasCompany(companyId, ownerOnly = false) {
  return Boolean(
    session &&
    (options.admin ||
      db.company_members.some(
        (member) =>
          member.user_id === user.id &&
          member.company_id === companyId &&
          (!ownerOnly || member.role === "owner"),
      )),
  )
}
function automationFailure(code, message) {
  return { data: null, error: { code, message } }
}
function stopAutomation(quoteId, reason) {
  const config = db.quote_followup_automations.find((row) => row.quote_id === quoteId)
  if (!config) return
  Object.assign(config, {
    enabled: false,
    next_send_at: null,
    stop_reason: reason,
    updated_at: new Date().toISOString(),
  })
  db.quote_followup_jobs
    .filter(
      (job) =>
        job.quote_id === quoteId && job.status === "queued" && !job.provider_message_id,
    )
    .forEach((job) => {
      job.status = "cancelled"
      job.last_error_code = reason
    })
}
function makeJob(quote, generation, step, day, status = "queued") {
  const when = scheduledAt(day)
  return {
    id: `automation-job-${db.quote_followup_jobs.length + 1}`,
    quote_id: quote.id,
    company_id: quote.company_id,
    generation,
    step,
    created_at: new Date().toISOString(),
    status,
    attempts: status === "queued" ? 0 : 1,
    scheduled_at: when,
    next_attempt_at: status === "queued" ? when : null,
    first_attempt_at: status === "queued" ? null : when,
    provider_message_id: status === "sent" ? `provider-${step}` : null,
    sent_at: status === "sent" ? when : null,
    last_error_code:
      status === "failed"
        ? "provider_rejected"
        : status === "delivery_unknown"
          ? "provider_timeout"
          : null,
  }
}
if (options.automation && options.automationState) {
  const quote = db.quotes.find((row) => row.id === "quote-test")
  const tomorrow = addDays(parisDay(today), 1)
  const state = options.automationState
  const enabled = !["completed", "failed", "delivery_unknown"].includes(state)
  const config = {
    quote_id: quote.id,
    company_id: quote.company_id,
    enabled,
    paused: state === "paused",
    generation: 1,
    activated_by: user.id,
    first_delay_days: 5,
    second_delay_days: 12,
    subject_template: automationSubject,
    body_template: automationBody,
    next_send_at: enabled ? scheduledAt(tomorrow) : null,
    stop_reason:
      state === "completed"
        ? "completed"
        : state === "delivery_unknown"
          ? "delivery_unknown"
          : state === "failed"
            ? "delivery_failed"
            : null,
    updated_at: today.toISOString(),
  }
  db.quote_followup_automations.push(config)
  const firstStatus = [
    "sent",
    "failed",
    "processing",
    "delivery_unknown",
    "completed",
  ].includes(state)
    ? state === "completed"
      ? "sent"
      : state
    : "queued"
  db.quote_followup_jobs.push(
    makeJob(
      quote,
      1,
      1,
      firstStatus === "queued" ? tomorrow : parisDay(today),
      firstStatus,
    ),
  )
  db.quote_followup_jobs.push(
    makeJob(
      quote,
      1,
      2,
      addDays(tomorrow, 7),
      state === "completed"
        ? "sent"
        : ["failed", "delivery_unknown"].includes(state)
          ? "cancelled"
          : "queued",
    ),
  )
  if (state === "sent") config.next_send_at = db.quote_followup_jobs[1].scheduled_at
  if (options.automationHistory)
    for (let index = 0; index < 11; index++) {
      const job = makeJob(
        quote,
        0,
        (index % 2) + 1,
        addDays(parisDay(today), -index - 1),
        "cancelled",
      )
      job.created_at = new Date(today.getTime() - (index + 1) * 86400000).toISOString()
      db.quote_followup_jobs.push(job)
    }
  if (["sent", "failed", "delivery_unknown"].includes(state)) {
    const job = db.quote_followup_jobs[0]
    db.quote_events.push({
      id: "automation-event-test",
      quote_id: quote.id,
      company_id: quote.company_id,
      event_type: state === "sent" ? "followup_auto_sent" : "followup_auto_failed",
      content:
        state === "sent"
          ? "Première relance automatique envoyée."
          : "La première relance automatique n’a pas été confirmée.",
      delivery_status: state === "delivery_unknown" ? "delivery_unknown" : state,
      automation_job_id: job.id,
      created_at: today.toISOString(),
      occurred_at: today.toISOString(),
    })
    db.notifications.push({
      id: "automation-notification-test",
      user_id: user.id,
      company_id: quote.company_id,
      type: state === "sent" ? "quote_followup_sent" : "quote_followup_failed",
      related_quote_id: quote.id,
      automation_job_id: job.id,
      title:
        state === "sent"
          ? "Relance automatique envoyée"
          : "Relance automatique à vérifier",
      message: "Résultat de l’envoi pour TEST-001.",
      read_at: null,
      created_at: today.toISOString(),
    })
  }
}
if (options.automation) {
  const saved = window.sessionStorage.getItem(automationStorageKey)
  if (saved) Object.assign(db, JSON.parse(saved))
}
async function automationRpc(name, args = {}) {
  automationCalls.push({ name, args: window.structuredClone(args) })
  if (options.automationDelay)
    await new Promise((resolve) => setTimeout(resolve, options.automationDelay))
  if (options.automationFailure === name)
    return automationFailure("XX000", "Test automation connection failure")
  if (!session) return automationFailure("42501", "Compte actif requis.")
  const ready = Boolean(options.automation && options.serviceReady !== false)
  if (name === "read_quote_followup_service_status")
    return {
      data: { ready, code: ready ? "ready" : "email_configuration_missing" },
      error: null,
    }
  if (name === "set_company_email_settings") {
    if (!hasCompany(args.p_company_id, true))
      return automationFailure(
        "42501",
        "Seul un propriétaire actif peut modifier ce contact.",
      )
    const reply = args.p_reply_to?.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reply ?? ""))
      return automationFailure(
        "22023",
        "Saisissez une adresse email de réponse valide.",
      )
    let profile = db.company_email_settings.find(
      (row) => row.company_id === args.p_company_id,
    )
    if (!profile) {
      profile = { company_id: args.p_company_id, automation_paused: false }
      db.company_email_settings.push(profile)
    }
    Object.assign(profile, { reply_to: reply, updated_at: new Date().toISOString() })
    persistAutomation()
    return { data: { ...profile }, error: null }
  }
  const quote = db.quotes.find((row) => row.id === args.p_quote_id)
  if (!quote) return automationFailure("P0002", "Devis introuvable.")
  if (!hasCompany(quote.company_id))
    return automationFailure("42501", "Ce devis est inaccessible.")
  let config = db.quote_followup_automations.find((row) => row.quote_id === quote.id)
  if (name === "get_quote_followup_automation")
    return { data: config ? { ...config } : null, error: null }
  if (name === "record_quote_response") {
    const content = args.p_content?.trim()
    if (!content || content.length > 4000)
      return automationFailure(
        "22023",
        "La réponse doit contenir entre 1 et 4 000 caractères.",
      )
    const event = {
      id: `response-${db.quote_events.length + 1}`,
      company_id: quote.company_id,
      quote_id: quote.id,
      event_type: "response",
      content,
      created_by: user.id,
      created_at: new Date().toISOString(),
      occurred_at: new Date().toISOString(),
    }
    db.quote_events.push(event)
    stopAutomation(quote.id, "response_received")
    persistAutomation()
    return { data: event.id, error: null }
  }
  if (name === "set_quote_followup_automation_paused") {
    if (config)
      Object.assign(config, {
        paused: args.p_paused,
        updated_at: new Date().toISOString(),
      })
    persistAutomation()
    return { data: config ? { ...config } : null, error: null }
  }
  if (
    !args.p_enabled &&
    args.p_subject_template === undefined &&
    args.p_body_template === undefined
  ) {
    stopAutomation(quote.id, "disabled")
    persistAutomation()
    return { data: config ? { ...config } : null, error: null }
  }
  if (
    db.quote_followup_jobs.some(
      (job) =>
        job.quote_id === quote.id &&
        (["processing", "delivery_unknown"].includes(job.status) ||
          (job.status === "queued" && job.first_attempt_at)),
    )
  )
    return automationFailure(
      "23514",
      "Un envoi est en cours de résolution. Vous pouvez le mettre en pause ou arrêter la suite.",
    )
  const first = args.p_first_delay_days
  const second = args.p_second_delay_days
  const normalizeVariables = (value) =>
    value
      ?.trim()
      .replace(
        /\{\{\s*(client_name|quote_reference|company_name|amount_formatted)\s*\}\}/g,
        "{{$1}}",
      )
  const subject = normalizeVariables(args.p_subject_template)
  const body = normalizeVariables(args.p_body_template)
  if (
    !Number.isInteger(first) ||
    !Number.isInteger(second) ||
    first < 1 ||
    second > 90 ||
    second <= first
  )
    return automationFailure(
      "22023",
      "Choisissez deux délais croissants entre 1 et 90 jours.",
    )
  if (
    !subject ||
    subject.length > 160 ||
    /[\r\n]/.test(subject) ||
    !body ||
    body.length > 4000
  )
    return automationFailure(
      "22023",
      "Vérifiez l’objet (160 caractères) et le message (4 000 caractères).",
    )
  if (
    /\{\{|\}\}/.test(
      (subject + body).replace(
        /\{\{(client_name|quote_reference|company_name|amount_formatted)\}\}/g,
        "",
      ),
    )
  )
    return automationFailure(
      "22023",
      "Les variables autorisées sont client_name, quote_reference et company_name.",
    )
  const tomorrow = addDays(parisDay(new Date()), 1)
  if (args.p_next_send_date && args.p_next_send_date < tomorrow)
    return automationFailure("22023", "La prochaine date doit être à partir de demain.")
  if (args.p_enabled) {
    if (!ready)
      return automationFailure(
        "23514",
        "Le service email doit être configuré avant l’activation.",
      )
    if (
      quote.status !== "sent" ||
      !quote.sent_at ||
      (quote.expires_at && quote.expires_at <= parisDay(new Date())) ||
      db.quote_events.some(
        (event) => event.quote_id === quote.id && event.event_type === "response",
      )
    )
      return automationFailure(
        "23514",
        "Ce devis ne peut plus être relancé automatiquement.",
      )
    const profile = db.company_email_settings.find(
      (row) => row.company_id === quote.company_id,
    )
    const client = db.clients.find((row) => row.id === quote.client_id)
    if (!profile?.reply_to || profile.automation_paused || !client?.email)
      return automationFailure(
        "23514",
        "Renseignez une adresse client et une adresse de réponse valides.",
      )
  }
  if (!config) {
    config = { quote_id: quote.id, company_id: quote.company_id, generation: 0 }
    db.quote_followup_automations.push(config)
  }
  db.quote_followup_jobs
    .filter((job) => job.quote_id === quote.id && job.status === "queued")
    .forEach((job) => {
      job.status = "cancelled"
      job.last_error_code = "configuration_changed"
    })
  Object.assign(config, {
    enabled: args.p_enabled,
    paused: Boolean(args.p_enabled && config.paused),
    generation: config.generation + 1,
    activated_by: user.id,
    first_delay_days: first,
    second_delay_days: second,
    subject_template: subject,
    body_template: body,
    next_send_at: null,
    stop_reason: args.p_enabled ? null : "disabled",
    updated_at: new Date().toISOString(),
  })
  if (args.p_enabled) {
    const sent = db.quote_followup_jobs.filter(
      (job) => job.quote_id === quote.id && job.status === "sent",
    )
    if (sent.some((job) => job.step === 2)) stopAutomation(quote.id, "completed")
    else {
      const firstDay =
        args.p_next_send_date ?? [addDays(quote.sent_at, first), tomorrow].sort().at(-1)
      const secondDay = sent.some((job) => job.step === 1)
        ? (args.p_next_send_date ??
          [addDays(quote.sent_at, second), tomorrow].sort().at(-1))
        : [addDays(quote.sent_at, second), addDays(firstDay, second - first)]
            .sort()
            .at(-1)
      if (!sent.some((job) => job.step === 1))
        db.quote_followup_jobs.push(makeJob(quote, config.generation, 1, firstDay))
      db.quote_followup_jobs.push(makeJob(quote, config.generation, 2, secondDay))
      config.next_send_at = db.quote_followup_jobs
        .filter(
          (job) =>
            job.quote_id === quote.id &&
            job.generation === config.generation &&
            job.status === "queued",
        )
        .map((job) => job.scheduled_at)
        .sort()[0]
    }
  }
  persistAutomation()
  return { data: { ...config }, error: null }
}

class Query {
  constructor(table) {
    this.table = table
    this.filters = []
    this.mode = "read"
    this.payload = null
    this.one = false
    this.optionalOne = false
    this.sorts = []
    this.start = 0
    this.end = Infinity
    this.columns = "*"
  }
  select(columns = "*") {
    this.columns = columns
    return this
  }
  eq(key, value) {
    this.filters.push((row) => row[key] === value)
    return this
  }
  neq(key, value) {
    this.filters.push((row) => row[key] !== value)
    return this
  }
  is(key, value) {
    return this.eq(key, value)
  }
  in(key, values) {
    this.filters.push((row) => values.includes(row[key]))
    return this
  }
  lt(key, value) {
    this.filters.push((row) => row[key] < value)
    return this
  }
  gt(key, value) {
    this.filters.push((row) => row[key] > value)
    return this
  }
  order(key, { ascending = true } = {}) {
    this.sorts.push({ key, ascending })
    return this
  }
  limit(count) {
    this.end = this.start + count - 1
    return this
  }
  range(start, end) {
    this.start = start
    this.end = end
    return this
  }
  single() {
    this.one = true
    return this
  }
  maybeSingle() {
    this.one = true
    this.optionalOne = true
    return this
  }
  insert(payload) {
    this.mode = "insert"
    this.payload = payload
    return this
  }
  update(payload) {
    this.mode = "update"
    this.payload = payload
    return this
  }
  then(resolve, reject) {
    return Promise.resolve()
      .then(async () => {
        let mutation
        if (
          options.quoteMutationDelay &&
          this.mode !== "read" &&
          ["quotes", "quote_events"].includes(this.table)
        ) {
          mutation = {
            table: this.table,
            payload: window.structuredClone(this.payload),
            completed: false,
          }
          quoteMutationCalls.push(mutation)
          await new Promise((resolve) =>
            setTimeout(resolve, options.quoteMutationDelay),
          )
        }
        if (options.fail && this.table === "quotes")
          return { data: null, error: { message: "Test connection failure" } }
        if (options.messagingFailure === this.table)
          return { data: null, error: { message: "Test messaging connection failure" } }
        if (options.automationFailure === this.table)
          return {
            data: null,
            error: { message: "Test automation connection failure" },
          }
        if (
          options.messagingFailure === "read_notifications" &&
          this.table === "notifications" &&
          this.mode === "update"
        )
          return {
            data: null,
            error: { message: "Test notification connection failure" },
          }
        let rows = db[this.table].filter((row) =>
          this.filters.every((check) => check(row)),
        )
        if (this.table === "notifications")
          rows = rows.filter((row) => session && row.user_id === user.id)
        if (
          [
            "quotes",
            "clients",
            "quote_events",
            "company_email_settings",
            "quote_followup_automations",
            "quote_followup_jobs",
            "quote_documents",
            "quote_initial_send_jobs",
          ].includes(this.table)
        )
          rows = rows.filter((row) => hasCompany(row.company_id))
        if (this.table === "support_threads")
          rows = rows.filter(
            (row) => session && (options.admin || row.user_id === user.id),
          )
        if (this.table === "support_messages")
          rows = rows.filter(
            (row) =>
              session &&
              (options.admin ||
                db.support_threads.some(
                  (thread) => thread.id === row.thread_id && thread.user_id === user.id,
                )),
          )
        if (this.mode === "insert") {
          const row = {
            id: `new-${db[this.table].length}`,
            created_at: today.toISOString(),
            updated_at: today.toISOString(),
            occurred_at: today.toISOString(),
            ...this.payload,
          }
          db[this.table].push(row)
          rows = [row]
          if (this.table === "quote_events" && row.event_type === "response")
            stopAutomation(row.quote_id, "response_received")
        }
        if (this.mode === "update")
          rows.forEach((row) => Object.assign(row, this.payload))
        if (this.mode === "update" && this.table === "quotes" && this.payload.status)
          rows
            .filter((quote) => quote.status !== "sent")
            .forEach((quote) => stopAutomation(quote.id, quote.status))
        if (this.mode !== "read") persistMessaging()
        if (this.mode !== "read") persistCompanies()
        if (this.mode !== "read") persistAutomation()
        const count = rows.length
        rows = [...rows]
          .sort((a, b) => {
            for (const { key, ascending } of this.sorts) {
              if (a[key] < b[key]) return ascending ? -1 : 1
              if (a[key] > b[key]) return ascending ? 1 : -1
            }
            return 0
          })
          .slice(this.start, this.end + 1)
        const clientColumns = this.columns
          .match(/client:clients\s*\(([^)]*)\)/)?.[1]
          .split(",")
          .map((column) => column.trim())
        const joined = rows.map((row) => ({
          ...row,
          ...(this.table === "quotes"
            ? {
                client: (() => {
                  const client = db.clients.find((entry) => entry.id === row.client_id)
                  if (!client) return null
                  return clientColumns && !clientColumns.includes("*")
                    ? Object.fromEntries(
                        clientColumns.map((column) => [column, client[column]]),
                      )
                    : { ...client }
                })(),
              }
            : {}),
          ...(this.table === "clients"
            ? {
                quotes: [
                  { count: db.quotes.filter((q) => q.client_id === row.id).length },
                ],
              }
            : {}),
        }))
        if (mutation) mutation.completed = true
        if (this.one && !this.optionalOne && joined.length !== 1)
          return {
            data: null,
            error: {
              code: "PGRST116",
              message: "JSON object requested, multiple (or no) rows returned",
            },
            count,
          }
        return { data: this.one ? joined[0] || null : joined, error: null, count }
      })
      .then(resolve, reject)
  }
}
export const isSupabaseConfigured = true
export const supabase = {
  from: (table) => new Query(table),
  rpc: (name, args) => {
    const request = (async () => {
      if (name === "save_imported_quote") {
        if (!session || args.p_company_id !== company.id)
          return { data: null, error: { code: "42501", message: "Accès refusé." } }
        if (
          db.quotes.some(
            (quote) =>
              quote.company_id === args.p_company_id &&
              quote.reference.toLowerCase() === args.p_reference.toLowerCase(),
          )
        )
          return {
            data: null,
            error: { code: "23505", message: "Cette référence existe déjà." },
          }
        let client = db.clients.find(
          (entry) =>
            entry.id === args.p_client_id && entry.company_id === args.p_company_id,
        )
        if (!client && args.p_new_client?.name?.trim()) {
          client = {
            id: globalThis.crypto.randomUUID(),
            company_id: company.id,
            ...args.p_new_client,
            notes: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          db.clients.push(client)
        }
        if (!client)
          return { data: null, error: { code: "22023", message: "Client requis." } }
        const quote = {
          id: args.p_quote_id,
          company_id: company.id,
          client_id: client.id,
          reference: args.p_reference,
          amount_cents: args.p_amount_cents,
          notes: args.p_notes,
          status: args.p_already_sent ? "sent" : "draft",
          sent_at: args.p_already_sent ? args.p_sent_at : null,
          expires_at: args.p_expires_at,
          next_followup_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        db.quotes.push(quote)
        persistAutomation()
        return { data: { ...quote }, error: null }
      }
      if (
        [
          "get_quote_followup_automation",
          "save_quote_followup_automation",
          "set_quote_followup_automation_paused",
          "record_quote_response",
          "read_quote_followup_service_status",
          "set_company_email_settings",
        ].includes(name)
      )
        return automationRpc(name, args)
      if (["admin_create_company", "admin_delete_company"].includes(name))
        return companyRpc(name, args)
      if (
        [
          "send_support_message",
          "list_support_threads",
          "mark_support_thread_read",
          "send_admin_notification",
        ].includes(name)
      )
        return messagingRpc(name, args)
      if (name === "is_platform_admin")
        return { data: Boolean(session && options.admin), error: null }
      if (name === "create_company_with_owner") {
        company.name = args.company_name
        db.company_members.push({
          company_id: company.id,
          user_id: user.id,
          role: "owner",
          companies: company,
        })
        syncAdminMemberships()
        return { data: company.id, error: null }
      }
      if (name === "admin_transfer_company_owner") {
        if (!session || !options.admin)
          return { data: null, error: { code: "42501", message: "Accès refusé." } }
        const entry = db.companies.find((item) => item.id === args.target_company_id)
        const nextOwner = adminUsers.find((account) => account.id === args.new_owner_id)
        if (!entry || !nextOwner)
          return {
            data: null,
            error: { code: "P0001", message: "Compte introuvable." },
          }
        db.company_members
          .filter((member) => member.company_id === entry.id && member.role === "owner")
          .forEach((member) => {
            member.role = "member"
          })
        const member = db.company_members.find(
          (item) => item.company_id === entry.id && item.user_id === nextOwner.id,
        )
        if (member) member.role = "owner"
        else
          db.company_members.push({
            company_id: entry.id,
            user_id: nextOwner.id,
            role: "owner",
            companies: entry,
          })
        syncAdminMemberships()
        return { data: null, error: null }
      }
      return { data: null, error: { message: "Unknown test RPC" } }
    })()
    request.abortSignal = () => request
    return request
  },
  channel: () => {
    const channel = {
      on: () => channel,
      subscribe: () => channel,
      unsubscribe: async () => ({ error: null }),
    }
    return channel
  },
  removeChannel: async () => "ok",
  functions: {
    invoke: async (name, { body }) => {
      if (name !== "platform-admin")
        return adminFailure("INVALID_REQUEST", "Action inconnue.")
      if (!session) return adminFailure("UNAUTHORIZED", "Connexion requise.", 401)
      if (!options.admin) return adminFailure("FORBIDDEN", "Accès refusé.", 403)
      if (options.adminFailure === body.action)
        return adminFailure(
          "BACKEND_ERROR",
          "Le serveur de test n’a pas pu effectuer cette action.",
          500,
        )
      if (body.action === "list_users" || body.action === "list_companies") {
        const page = body.page ?? 1
        const perPage = body.perPage ?? 25
        const entries = body.action === "list_users" ? adminUsers : adminCompanies
        const start = (page - 1) * perPage
        return {
          data: {
            [body.action === "list_users" ? "users" : "companies"]: entries.slice(
              start,
              start + perPage,
            ),
            page,
            hasMore: start + perPage < entries.length,
          },
          error: null,
        }
      }
      const target = adminUsers.find((account) => account.id === body.userId)
      if (!target) return adminFailure("USER_NOT_FOUND", "Compte introuvable.", 404)
      if (target.id === user.id)
        return adminFailure("SELF_ACTION", "Votre compte est protégé.", 409)
      if (target.is_admin)
        return adminFailure(
          "PROTECTED_ADMIN",
          "Ce compte administrateur est protégé.",
          409,
        )
      if (body.action === "delete_user") {
        if (body.confirmationEmail?.trim().toLowerCase() !== target.email.toLowerCase())
          return adminFailure(
            "EMAIL_MISMATCH",
            "L’adresse de confirmation ne correspond pas.",
          )
        const onlyOwner = db.company_members.some(
          (member) =>
            member.user_id === target.id &&
            member.role === "owner" &&
            db.company_members.filter(
              (item) => item.company_id === member.company_id && item.role === "owner",
            ).length === 1,
        )
        if (onlyOwner)
          return adminFailure(
            "LAST_OWNER",
            "Transférez d’abord la propriété de l’entreprise.",
            409,
          )
        adminUsers.splice(adminUsers.indexOf(target), 1)
        db.company_members = db.company_members.filter(
          (member) => member.user_id !== target.id,
        )
        syncAdminMemberships()
      } else if (body.action === "suspend_user" || body.action === "resume_user") {
        target.banned_until =
          body.action === "suspend_user"
            ? new Date(today.getTime() + 86400000).toISOString()
            : null
      } else return adminFailure("INVALID_REQUEST", "Action inconnue.")
      return { data: { ok: true, userId: target.id }, error: null }
    },
  },
  auth: {
    getSession: async () => ({ data: { session }, error: null }),
    getUser: async () => ({ data: { user }, error: null }),
    onAuthStateChange: (callback) => {
      listeners.add(callback)
      if (location.pathname === "/reset-password")
        setTimeout(() => callback("PASSWORD_RECOVERY", { user }), 50)
      return {
        data: { subscription: { unsubscribe: () => listeners.delete(callback) } },
      }
    },
    signInWithPassword: async ({ password }) => {
      if (password === "invalid")
        return { error: { message: "Invalid login credentials" } }
      session = { user }
      listeners.forEach((callback) => callback("SIGNED_IN", session))
      return { error: null }
    },
    signUp: async ({ email }) => {
      const signupUser = { ...user, email }
      const data = { session: null, user: null }
      if (email === "existing@example.test") {
        if (options.signup === "user_already_exists")
          return {
            data,
            error: {
              code: "user_already_exists",
              message: "An account already uses this address",
            },
          }
        if (options.signup === "email_exists")
          return {
            data,
            error: { code: "email_exists", message: "Email address unavailable" },
          }
        if (options.signup === "legacy_duplicate")
          return { data, error: { message: "User already registered" } }
        if (options.signup === "hidden_duplicate")
          return {
            data: { session: null, user: { ...signupUser, identities: [] } },
            error: null,
          }
      }
      if (options.signup === "rate_limit")
        return {
          data,
          error: {
            code: "over_email_send_rate_limit",
            message: "email rate limit exceeded",
            status: 429,
          },
        }
      if (options.signup === "identities_missing")
        return { data: { session: null, user: signupUser }, error: null }
      signupUser.identities = [{ id: "identity-test", provider: "email" }]
      if (options.signup === "session") {
        session = { user: signupUser }
        listeners.forEach((callback) => callback("SIGNED_IN", session))
        return { data: { session, user: signupUser }, error: null }
      }
      return { data: { session: null, user: signupUser }, error: null }
    },
    signOut: async () => {
      session = null
      listeners.forEach((callback) => callback("SIGNED_OUT", null))
      return { error: null }
    },
    resetPasswordForEmail: async () => ({ error: null }),
    updateUser: async () => ({ error: null }),
  },
}
