export interface AuthUser {
  id: string
  email?: string | null
  created_at: string
  last_sign_in_at?: string | null
  email_confirmed_at?: string | null
  banned_until?: string | null
}

export interface Company {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Membership {
  company_id: string
  user_id: string
  role: "owner" | "member"
  company: { id: string; name: string } | null
}

export interface AdminBackend {
  verifyToken(token: string): Promise<AuthUser | null>
  isAdmin(userId: string): Promise<boolean>
  listUsers(
    page: number,
    perPage: number,
  ): Promise<{
    users: AuthUser[]
    total?: number
  }>
  getUser(userId: string): Promise<AuthUser | null>
  adminIds(userIds: string[]): Promise<Set<string>>
  memberships(userIds: string[]): Promise<Membership[]>
  listCompanies(offset: number, limit: number): Promise<Company[]>
  owners(companyIds: string[]): Promise<Membership[]>
  deleteUser(userId: string): Promise<void>
  setSuspended(userId: string, suspended: boolean): Promise<void>
  recordMutation(actorId: string, userId: string, action: MutationAction): Promise<void>
}

type MutationAction = "delete_user" | "suspend_user" | "resume_user"
type Action = MutationAction | "list_users" | "list_companies"
const actions: readonly string[] = [
  "list_users",
  "list_companies",
  "delete_user",
  "suspend_user",
  "resume_user",
]
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

function invalid(message = "La demande est invalide."): never {
  throw new ApiError(400, "INVALID_REQUEST", message)
}

function pagination(body: Record<string, unknown>) {
  const page = body.page ?? 1
  const perPage = body.perPage ?? 25
  if (
    typeof page !== "number" ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000 ||
    typeof perPage !== "number" ||
    !Number.isInteger(perPage) ||
    perPage < 1 ||
    perPage > 100
  ) {
    invalid("La pagination est invalide.")
  }
  return { page, perPage }
}

/**
 * Every privileged query follows a token verified by Auth and a server-side
 * role lookup. No user ID, role claim or user metadata from the request is used
 * to determine the caller's permissions. Dependencies make that order testable.
 */
export function createAdminHandler(backend: AdminBackend) {
  return async (request: Request): Promise<Response> => {
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    }
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers })
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers })
    if (request.method !== "POST")
      return json(
        {
          error: { code: "METHOD_NOT_ALLOWED", message: "Utilisez une requête POST." },
        },
        405,
      )

    try {
      const authorization = request.headers.get("Authorization") ?? ""
      const match = /^Bearer\s+(\S+)$/i.exec(authorization)
      if (!match)
        throw new ApiError(
          401,
          "UNAUTHORIZED",
          "Connectez-vous pour accéder à l’administration.",
        )
      const actor = await backend.verifyToken(match[1])
      if (!actor)
        throw new ApiError(
          401,
          "UNAUTHORIZED",
          "Votre session a expiré. Reconnectez-vous.",
        )
      if (actor.banned_until && new Date(actor.banned_until).getTime() > Date.now()) {
        throw new ApiError(401, "UNAUTHORIZED", "Ce compte est suspendu.")
      }
      if (!(await backend.isAdmin(actor.id))) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          "Cet accès est réservé à l’administrateur de Cadova.",
        )
      }

      let body: Record<string, unknown>
      const text = await request.text()
      if (text.length > 4096) invalid("La demande est trop volumineuse.")
      try {
        const parsed: unknown = JSON.parse(text)
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) invalid()
        body = parsed as Record<string, unknown>
      } catch (error) {
        if (error instanceof ApiError) throw error
        invalid()
      }
      if (typeof body.action !== "string" || !actions.includes(body.action))
        invalid("Cette action n’est pas disponible.")
      const action = body.action as Action

      if (action === "list_users") {
        const { page, perPage } = pagination(body)
        const result = await backend.listUsers(page, perPage)
        const ids = result.users.map((user) => user.id)
        const [admins, memberships] = await Promise.all([
          backend.adminIds(ids),
          backend.memberships(ids),
        ])
        const users = result.users.map((user) => ({
          id: user.id,
          email: user.email ?? null,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at ?? null,
          email_confirmed_at: user.email_confirmed_at ?? null,
          banned_until: user.banned_until ?? null,
          is_admin: admins.has(user.id),
          companies: memberships
            .filter((m) => m.user_id === user.id && m.company)
            .map((m) => ({ id: m.company_id, name: m.company!.name, role: m.role })),
        }))
        return json({
          users,
          page,
          hasMore:
            result.total !== undefined
              ? page * perPage < result.total
              : users.length === perPage,
        })
      }

      if (action === "list_companies") {
        const { page, perPage } = pagination(body)
        const rows = await backend.listCompanies((page - 1) * perPage, perPage + 1)
        const companies = rows.slice(0, perPage)
        const owners = await backend.owners(companies.map((company) => company.id))
        const ownerIds = [...new Set(owners.map((owner) => owner.user_id))]
        const users = await Promise.all(ownerIds.map((id) => backend.getUser(id)))
        const emailById = new Map(
          users
            .filter((user) => user !== null)
            .map((user) => [user.id, user.email ?? null]),
        )
        return json({
          companies: companies.map((company) => ({
            ...company,
            owners: owners
              .filter((owner) => owner.company_id === company.id)
              .map((owner) => ({
                id: owner.user_id,
                email: emailById.get(owner.user_id) ?? null,
              })),
          })),
          page,
          hasMore: rows.length > perPage,
        })
      }

      if (typeof body.userId !== "string" || !uuid.test(body.userId))
        invalid("Le compte demandé est invalide.")
      const userId = body.userId
      if (userId === actor.id) {
        throw new ApiError(
          409,
          "SELF_ACTION",
          "Vous ne pouvez pas modifier l’accès à votre propre compte administrateur.",
        )
      }
      if (await backend.isAdmin(userId)) {
        throw new ApiError(
          409,
          "PROTECTED_ADMIN",
          "Ce compte administrateur est protégé.",
        )
      }
      const target = await backend.getUser(userId)
      if (!target)
        throw new ApiError(
          404,
          "USER_NOT_FOUND",
          "Ce compte n’existe plus. Actualisez la liste.",
        )

      if (action === "delete_user") {
        if (
          typeof body.confirmationEmail !== "string" ||
          !target.email ||
          body.confirmationEmail.trim().toLowerCase() !== target.email.toLowerCase()
        ) {
          throw new ApiError(
            409,
            "EMAIL_MISMATCH",
            "Saisissez l’adresse email de ce compte pour confirmer sa suppression.",
          )
        }
        const owned = (await backend.memberships([userId])).filter(
          (m) => m.role === "owner",
        )
        const owners = await backend.owners(owned.map((m) => m.company_id))
        if (
          owned.some(
            (company) =>
              !owners.some(
                (m) => m.company_id === company.company_id && m.user_id !== userId,
              ),
          )
        ) {
          throw new ApiError(
            409,
            "LAST_OWNER",
            "Transférez d’abord la propriété de l’entreprise à un autre compte.",
          )
        }
        await backend.deleteUser(userId)
      } else {
        await backend.setSuspended(userId, action === "suspend_user")
      }
      try {
        await backend.recordMutation(actor.id, userId, action)
      } catch {
        throw new ApiError(
          500,
          "AUDIT_ERROR",
          "L’action a été effectuée, mais son enregistrement a échoué. Actualisez la liste et vérifiez le journal serveur.",
        )
      }
      return json({ ok: true, userId })
    } catch (error) {
      if (error instanceof ApiError)
        return json(
          { error: { code: error.code, message: error.message } },
          error.status,
        )
      // Supabase errors can contain internal details. Never return them to users.
      return json(
        {
          error: {
            code: "BACKEND_ERROR",
            message:
              "L’administration est momentanément indisponible. Réessayez dans un instant.",
          },
        },
        500,
      )
    }
  }
}
