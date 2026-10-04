import { createClient } from "npm:@supabase/supabase-js@2.112.4"
import { createAdminHandler, type AdminBackend, type Membership } from "./handler.ts"

const url = Deno.env.get("SUPABASE_URL")
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
if (!url || !serviceKey)
  throw new Error("Platform administration server configuration is missing")

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

function requireSuccess(error: { message: string } | null) {
  if (error) throw new Error("Platform administration backend operation failed")
}

interface MemberRow {
  company_id: string
  user_id: string
  role: "owner" | "member"
  companies: { id: string; name: string } | { id: string; name: string }[] | null
}
function memberships(rows: MemberRow[]): Membership[] {
  return rows.map((row) => ({
    company_id: row.company_id,
    user_id: row.user_id,
    role: row.role,
    company: Array.isArray(row.companies) ? (row.companies[0] ?? null) : row.companies,
  }))
}

const backend: AdminBackend = {
  async verifyToken(token) {
    const { data, error } = await db.auth.getUser(token)
    return error ? null : data.user
  },
  async isAdmin(userId) {
    const { data, error } = await db
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle()
    requireSuccess(error)
    return data !== null
  },
  async listUsers(page, perPage) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage })
    requireSuccess(error)
    return { users: data.users, total: "total" in data ? data.total : undefined }
  },
  async getUser(userId) {
    const { data, error } = await db.auth.admin.getUserById(userId)
    if (error?.status === 404) return null
    requireSuccess(error)
    return data.user
  },
  async adminIds(userIds) {
    if (!userIds.length) return new Set<string>()
    const { data, error } = await db
      .from("platform_admins")
      .select("user_id")
      .in("user_id", userIds)
    requireSuccess(error)
    return new Set((data ?? []).map((row) => row.user_id as string))
  },
  async memberships(userIds) {
    if (!userIds.length) return []
    const { data, error } = await db
      .from("company_members")
      .select("company_id,user_id,role,companies(id,name)")
      .in("user_id", userIds)
    requireSuccess(error)
    return memberships((data ?? []) as MemberRow[])
  },
  async listCompanies(offset, limit) {
    const { data, error } = await db
      .from("companies")
      .select("id,name,created_at,updated_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1)
    requireSuccess(error)
    return data ?? []
  },
  async owners(companyIds) {
    if (!companyIds.length) return []
    const { data, error } = await db
      .from("company_members")
      .select("company_id,user_id,role,companies(id,name)")
      .eq("role", "owner")
      .in("company_id", companyIds)
    requireSuccess(error)
    return memberships((data ?? []) as MemberRow[])
  },
  async deleteUser(userId) {
    // Hard-delete only Auth identity and cascading account memberships. Company
    // records are retained; the database rejects deleting its final owner.
    const { error } = await db.auth.admin.deleteUser(userId, false)
    requireSuccess(error)
  },
  async setSuspended(userId, suspended) {
    const { error } = await db.auth.admin.updateUserById(userId, {
      ban_duration: suspended ? "876000h" : "none",
    })
    requireSuccess(error)
  },
  async recordMutation(actorId, userId, action) {
    const { error } = await db.from("admin_audit_log").insert({
      actor_id: actorId,
      target_user_id: userId,
      action,
    })
    requireSuccess(error)
  },
}

Deno.serve(createAdminHandler(backend))
