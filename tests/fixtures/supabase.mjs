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
            role: "owner",
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
          email: "client@example.test",
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
          status: "sent",
          sent_at: iso(ago),
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
}
window.__testStore = db

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
if (options.admin) {
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

class Query {
  constructor(table) {
    this.table = table
    this.filters = []
    this.mode = "read"
    this.payload = null
    this.one = false
    this.sorts = []
    this.start = 0
    this.end = Infinity
  }
  select() {
    return this
  }
  eq(key, value) {
    this.filters.push((row) => row[key] === value)
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
      .then(() => {
        if (options.fail && this.table === "quotes")
          return { data: null, error: { message: "Test connection failure" } }
        if (options.messagingFailure === this.table)
          return { data: null, error: { message: "Test messaging connection failure" } }
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
        }
        if (this.mode === "update")
          rows.forEach((row) => Object.assign(row, this.payload))
        if (this.mode !== "read") persistMessaging()
        if (this.mode !== "read") persistCompanies()
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
        const joined = rows.map((row) => ({
          ...row,
          ...(this.table === "quotes"
            ? { client: db.clients.find((c) => c.id === row.client_id) || null }
            : {}),
          ...(this.table === "clients"
            ? {
                quotes: [
                  { count: db.quotes.filter((q) => q.client_id === row.id).length },
                ],
              }
            : {}),
        }))
        return { data: this.one ? joined[0] || null : joined, error: null, count }
      })
      .then(resolve, reject)
  }
}
export const isSupabaseConfigured = true
export const supabase = {
  from: (table) => new Query(table),
  rpc: async (name, args) => {
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
        return { data: null, error: { code: "P0001", message: "Compte introuvable." } }
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
