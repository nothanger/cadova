import assert from "node:assert/strict"
import test from "node:test"
import {
  createAdminHandler,
  type AdminBackend,
  type AuthUser,
  type Company,
  type Membership,
} from "../supabase/functions/platform-admin/handler.ts"

const adminId = "10000000-0000-4000-8000-000000000001"
const otherAdminId = "10000000-0000-4000-8000-000000000002"
const ownerId = "20000000-0000-4000-8000-000000000001"
const memberId = "20000000-0000-4000-8000-000000000002"
const companyId = "30000000-0000-4000-8000-000000000001"
const secondCompanyId = "30000000-0000-4000-8000-000000000002"
const created = "2026-10-04T12:00:00Z"

function user(id: string, email: string): AuthUser {
  return { id, email, created_at: created, email_confirmed_at: created }
}
function membership(
  userId: string,
  role: "owner" | "member",
  id = companyId,
): Membership {
  return { user_id: userId, company_id: id, role, company: { id, name: "Entreprise" } }
}

class FakeBackend implements AdminBackend {
  calls: string[] = []
  admins = new Set([adminId, otherAdminId])
  users = new Map([
    [adminId, user(adminId, "admin@example.test")],
    [otherAdminId, user(otherAdminId, "protected@example.test")],
    [ownerId, user(ownerId, "owner@example.test")],
    [memberId, user(memberId, "member@example.test")],
  ])
  members = [membership(ownerId, "owner"), membership(memberId, "member")]
  companies: Company[] = [
    { id: companyId, name: "Entreprise", created_at: created, updated_at: created },
    {
      id: secondCompanyId,
      name: "Deuxième entreprise",
      created_at: created,
      updated_at: created,
    },
  ]
  failAt = ""
  mark(name: string) {
    this.calls.push(name)
    if (this.failAt === name.split(":")[0])
      throw new Error("database-secret-not-for-client")
  }
  async verifyToken(token: string) {
    this.mark("verify")
    const id =
      token === "admin-session" ? adminId : token === "normal-session" ? memberId : null
    return id ? (this.users.get(id) ?? null) : null
  }
  async isAdmin(id: string) {
    this.mark(`admin:${id}`)
    return this.admins.has(id)
  }
  async listUsers(page: number, perPage: number) {
    this.mark(`listUsers:${page}:${perPage}`)
    const all = [...this.users.values()]
    return { users: all.slice((page - 1) * perPage, page * perPage), total: all.length }
  }
  async getUser(id: string) {
    this.mark(`getUser:${id}`)
    return this.users.get(id) ?? null
  }
  async adminIds(ids: string[]) {
    this.mark("adminIds")
    return new Set(ids.filter((id) => this.admins.has(id)))
  }
  async memberships(ids: string[]) {
    this.mark("memberships")
    return this.members.filter((m) => ids.includes(m.user_id))
  }
  async listCompanies(offset: number, limit: number) {
    this.mark(`listCompanies:${offset}:${limit}`)
    return this.companies.slice(offset, offset + limit)
  }
  async owners(ids: string[]) {
    this.mark("owners")
    return this.members.filter((m) => ids.includes(m.company_id) && m.role === "owner")
  }
  async deleteUser(id: string) {
    this.mark(`delete:${id}`)
    this.users.delete(id)
  }
  async setSuspended(id: string, suspended: boolean) {
    this.mark(`suspend:${id}:${suspended}`)
  }
  async recordMutation(actor: string, target: string, action: string) {
    this.mark(`audit:${actor}:${target}:${action}`)
  }
}

async function call(
  backend: FakeBackend,
  body: unknown,
  token: string | null = "admin-session",
) {
  const response = await createAdminHandler(backend)(
    new Request("https://edge.example.test/platform-admin", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(body),
    }),
  )
  return { response, data: await response.json() }
}

test("aucun accès privilégié sans session Auth vérifiée et rôle serveur", async () => {
  for (const token of [null, "forged-admin-token", "normal-session"]) {
    for (const action of [
      "list_users",
      "list_companies",
      "delete_user",
      "suspend_user",
      "resume_user",
    ]) {
      const backend = new FakeBackend()
      const { response, data } = await call(
        backend,
        {
          action,
          userId: ownerId,
          confirmationEmail: "owner@example.test",
          actorId: adminId,
          role: "admin",
          app_metadata: { admin: true },
        },
        token,
      )
      assert.equal(response.status, token === "normal-session" ? 403 : 401)
      assert.equal(
        data.error.code,
        token === "normal-session" ? "FORBIDDEN" : "UNAUTHORIZED",
      )
      assert.ok(backend.calls.every((c) => c === "verify" || c === `admin:${memberId}`))
    }
  }
})

test("le rôle est relu côté serveur après la vérification du token", async () => {
  const backend = new FakeBackend()
  backend.admins.delete(adminId)
  const { response } = await call(backend, { action: "list_users" })
  assert.equal(response.status, 403)
  assert.deepEqual(backend.calls, ["verify", `admin:${adminId}`])
})

test("une session d’administrateur suspendue est refusée avant les accès privilégiés", async () => {
  const backend = new FakeBackend()
  backend.users.set(adminId, {
    ...backend.users.get(adminId)!,
    banned_until: new Date(Date.now() + 86400000).toISOString(),
  })
  const { response, data } = await call(backend, { action: "list_users" })
  assert.equal(response.status, 401)
  assert.equal(data.error.code, "UNAUTHORIZED")
  assert.deepEqual(backend.calls, ["verify"])
})

test("liste des comptes paginée et limitée aux champs publics d’administration", async () => {
  const backend = new FakeBackend()
  backend.users.set(ownerId, {
    ...backend.users.get(ownerId)!,
    ...{ user_metadata: { private: "hidden" } },
  })
  const { response, data } = await call(backend, {
    action: "list_users",
    page: 2,
    perPage: 2,
  })
  assert.equal(response.status, 200)
  assert.deepEqual(backend.calls.slice(0, 3), [
    "verify",
    `admin:${adminId}`,
    "listUsers:2:2",
  ])
  assert.equal(data.page, 2)
  assert.equal(data.hasMore, false)
  assert.equal(data.users.length, 2)
  assert.deepEqual(data.users[0], {
    id: ownerId,
    email: "owner@example.test",
    created_at: created,
    last_sign_in_at: null,
    email_confirmed_at: created,
    banned_until: null,
    is_admin: false,
    companies: [{ id: companyId, name: "Entreprise", role: "owner" }],
  })
  assert.equal(JSON.stringify(data).includes("hidden"), false)
  const first = await call(backend, { action: "list_users", page: 1, perPage: 2 })
  assert.equal(first.data.hasMore, true)
  assert.equal(first.data.users[0].is_admin, true)
  assert.equal(first.response.headers.get("Cache-Control"), "no-store")
})

test("liste des entreprises avec propriétaires et une ligne supplémentaire pour la pagination", async () => {
  const backend = new FakeBackend()
  const first = await call(backend, { action: "list_companies", perPage: 1 })
  assert.equal(first.response.status, 200)
  assert.equal(first.data.hasMore, true)
  assert.equal(first.data.companies.length, 1)
  assert.deepEqual(first.data.companies[0].owners, [
    { id: ownerId, email: "owner@example.test" },
  ])
  assert.ok(backend.calls.includes("listCompanies:0:2"))
  const second = await call(backend, { action: "list_companies", page: 2, perPage: 1 })
  assert.equal(second.data.hasMore, false)
  assert.equal(second.data.companies[0].id, secondCompanyId)
})

test("pagination invalide et actions inconnues refusées avant requête de gestion", async () => {
  for (const body of [
    { action: "list_users", page: 0 },
    { action: "list_users", page: "1" },
    { action: "list_companies", perPage: 101 },
    { action: "list_users", perPage: 0.5 },
    { action: "list_companies", page: 100001 },
    { action: "promote_admin", userId: memberId },
    { action: "delete_user", userId: "bad-id" },
    null,
    [],
  ]) {
    const backend = new FakeBackend()
    const { response, data } = await call(backend, body)
    assert.equal(response.status, 400)
    assert.equal(data.error.code, "INVALID_REQUEST")
    assert.deepEqual(backend.calls, ["verify", `admin:${adminId}`])
  }
})

test("auto-suppression, auto-suspension et autres administrateurs protégés", async () => {
  for (const action of ["delete_user", "suspend_user", "resume_user"]) {
    for (const id of [adminId, otherAdminId]) {
      const backend = new FakeBackend()
      const { response, data } = await call(backend, {
        action,
        userId: id,
        confirmationEmail: "admin@example.test",
      })
      assert.equal(response.status, 409)
      assert.equal(data.error.code, id === adminId ? "SELF_ACTION" : "PROTECTED_ADMIN")
      assert.ok(!backend.calls.some((c) => /^(delete|suspend|audit):/.test(c)))
    }
  }
})

test("suppression exige l’email du compte fourni par Auth", async () => {
  for (const confirmationEmail of [undefined, "wrong@example.test", ownerId]) {
    const backend = new FakeBackend()
    const { response, data } = await call(backend, {
      action: "delete_user",
      userId: memberId,
      confirmationEmail,
      email: confirmationEmail,
    })
    assert.equal(response.status, 409)
    assert.equal(data.error.code, "EMAIL_MISMATCH")
    assert.ok(!backend.calls.some((c) => c.startsWith("delete:")))
  }
  const backend = new FakeBackend()
  const { response } = await call(backend, {
    action: "delete_user",
    userId: memberId,
    confirmationEmail: " MEMBER@EXAMPLE.TEST ",
  })
  assert.equal(response.status, 200)
  assert.ok(backend.calls.includes(`delete:${memberId}`))
})

test("dernier propriétaire protégé tant que son entreprise n’a pas un autre propriétaire", async () => {
  const backend = new FakeBackend()
  const { response, data } = await call(backend, {
    action: "delete_user",
    userId: ownerId,
    confirmationEmail: "owner@example.test",
  })
  assert.equal(response.status, 409)
  assert.equal(data.error.code, "LAST_OWNER")
  assert.ok(!backend.calls.some((c) => c.startsWith("delete:")))
  backend.members[1].role = "owner"
  const removed = await call(backend, {
    action: "delete_user",
    userId: ownerId,
    confirmationEmail: "owner@example.test",
  })
  assert.equal(removed.response.status, 200)
  assert.deepEqual(removed.data, { ok: true, userId: ownerId })
  assert.equal(backend.companies.length, 2)
  assert.equal(backend.calls.at(-1), `audit:${adminId}:${ownerId}:delete_user`)
})

test("la suspension du dernier propriétaire reste disponible sans supprimer son entreprise", async () => {
  const backend = new FakeBackend()
  const suspended = await call(backend, { action: "suspend_user", userId: ownerId })
  assert.equal(suspended.response.status, 200)
  assert.deepEqual(suspended.data, { ok: true, userId: ownerId })
  assert.ok(backend.calls.includes(`suspend:${ownerId}:true`))
  const resumed = await call(backend, { action: "resume_user", userId: ownerId })
  assert.equal(resumed.response.status, 200)
  assert.ok(backend.calls.includes(`suspend:${ownerId}:false`))
  assert.equal(backend.users.has(ownerId), true)
  assert.equal(backend.companies.length, 2)
})

test("un compte absent n’entraîne aucune mutation", async () => {
  const backend = new FakeBackend()
  backend.users.delete(memberId)
  const { response, data } = await call(backend, {
    action: "suspend_user",
    userId: memberId,
  })
  assert.equal(response.status, 404)
  assert.equal(data.error.code, "USER_NOT_FOUND")
  assert.ok(!backend.calls.some((c) => c.startsWith("suspend:")))
})

test("les échecs backend ne révèlent aucun détail interne et ne produisent pas un faux succès", async () => {
  for (const failAt of [
    "verify",
    "admin",
    "listUsers",
    "memberships",
    "owners",
    "delete",
    "suspend",
  ]) {
    const backend = new FakeBackend()
    backend.failAt = failAt
    const body =
      failAt === "delete"
        ? {
            action: "delete_user",
            userId: memberId,
            confirmationEmail: "member@example.test",
          }
        : failAt === "suspend"
          ? { action: "suspend_user", userId: memberId }
          : failAt === "owners"
            ? { action: "list_companies" }
            : { action: "list_users" }
    const { response, data } = await call(backend, body)
    assert.equal(response.status, 500)
    assert.equal(data.error.code, "BACKEND_ERROR")
    assert.equal(JSON.stringify(data).includes("database-secret"), false)
    assert.ok(!backend.calls.some((c) => c.startsWith("audit:")))
  }
})

test("un échec du journal après mutation signale explicitement que l’action est déjà effectuée", async () => {
  const backend = new FakeBackend()
  backend.failAt = "audit"
  const { response, data } = await call(backend, {
    action: "delete_user",
    userId: memberId,
    confirmationEmail: "member@example.test",
  })
  assert.equal(response.status, 500)
  assert.equal(data.error.code, "AUDIT_ERROR")
  assert.match(data.error.message, /action a été effectuée/)
  assert.equal(backend.users.has(memberId), false)
})

test("méthodes, JSON malformé et taille maximale sont contrôlés", async () => {
  const backend = new FakeBackend()
  const handler = createAdminHandler(backend)
  const options = await handler(
    new Request("https://edge.example.test", { method: "OPTIONS" }),
  )
  assert.equal(options.status, 204)
  assert.deepEqual(backend.calls, [])
  const get = await handler(new Request("https://edge.example.test"))
  assert.equal(get.status, 405)
  for (const body of ["{", " ".repeat(4097)]) {
    const response = await handler(
      new Request("https://edge.example.test", {
        method: "POST",
        headers: { Authorization: "Bearer admin-session" },
        body,
      }),
    )
    assert.equal(response.status, 400)
  }
  assert.ok(backend.calls.every((c) => c === "verify" || c === `admin:${adminId}`))
})
