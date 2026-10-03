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
  rpc: async () => {
    db.company_members.push({
      company_id: company.id,
      user_id: user.id,
      role: "owner",
      companies: company,
    })
    return { data: company.id, error: null }
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
    signUp: async () => ({ data: { session: null }, error: null }),
    signOut: async () => {
      session = null
      listeners.forEach((callback) => callback("SIGNED_OUT", null))
      return { error: null }
    },
    resetPasswordForEmail: async () => ({ error: null }),
    updateUser: async () => ({ error: null }),
  },
}
