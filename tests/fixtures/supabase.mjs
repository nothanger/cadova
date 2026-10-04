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
      related_quote_id: "quote-test",
      title: "Relance de test",
      message: "Notification de test",
      read_at: null,
      created_at: today.toISOString(),
    },
  ],
}
window.__testStore = db

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
syncAdminMemberships()
window.__adminTestStore = { users: adminUsers, companies: adminCompanies }

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

class Query {
  constructor(table) {
    this.table = table
    this.filters = []
    this.mode = "read"
    this.payload = null
    this.one = false
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
  order() {
    return this
  }
  limit() {
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
        let rows = db[this.table].filter((row) =>
          this.filters.every((check) => check(row)),
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
        return { data: this.one ? joined[0] || null : joined, error: null }
      })
      .then(resolve, reject)
  }
}
export const isSupabaseConfigured = true
export const supabase = {
  from: (table) => new Query(table),
  rpc: async (name, args) => {
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
