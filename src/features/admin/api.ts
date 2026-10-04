import { supabase } from "@/lib/supabase"
import type { AdminCompaniesPage, AdminUsersPage } from "./types"

class AdminApiError extends Error {}

function responseMessage(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("error" in value)) return null
  const error = value.error
  if (typeof error === "string") return error
  if (error && typeof error === "object" && "message" in error) {
    return typeof error.message === "string" ? error.message : null
  }
  return null
}

async function invoke<T>(body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke("platform-admin", {
    body,
  })
  if (error) {
    const context = (error as { context?: unknown }).context
    if (context instanceof Response) {
      try {
        const message = responseMessage(await context.clone().json())
        if (message) throw new AdminApiError(message)
      } catch (parsedError) {
        if (parsedError instanceof AdminApiError) throw parsedError
      }
    }
    throw new AdminApiError(fallback)
  }
  const message = responseMessage(data)
  if (message) throw new AdminApiError(message)
  if (!data) throw new AdminApiError(fallback)
  return data as T
}

export function listAdminUsers(page = 1, perPage = 25) {
  return invoke<AdminUsersPage>(
    { action: "list_users", page, perPage },
    "Impossible de charger les comptes. Réessayez dans un instant.",
  )
}

export function listAdminCompanies(page = 1, perPage = 25) {
  return invoke<AdminCompaniesPage>(
    { action: "list_companies", page, perPage },
    "Impossible de charger les entreprises. Réessayez dans un instant.",
  )
}

export function deleteAdminUser(userId: string, confirmationEmail: string) {
  return invoke<{ ok: true; userId: string }>(
    { action: "delete_user", userId, confirmationEmail },
    "Impossible de supprimer ce compte. Réessayez dans un instant.",
  )
}

export function setAdminUserSuspended(userId: string, suspended: boolean) {
  return invoke<{ ok: true; userId: string }>(
    { action: suspended ? "suspend_user" : "resume_user", userId },
    suspended
      ? "Impossible de suspendre ce compte."
      : "Impossible de réactiver ce compte.",
  )
}

export async function transferCompanyOwner(companyId: string, ownerId: string) {
  const { error } = await supabase.rpc("admin_transfer_company_owner", {
    target_company_id: companyId,
    new_owner_id: ownerId,
  })
  if (error) {
    const message = /User already belongs to another company/i.test(error.message)
      ? "Ce compte appartient déjà à une autre entreprise. Choisissez un autre propriétaire."
      : /New owner is suspended/i.test(error.message)
        ? "Ce compte est suspendu. Réactivez-le avant de lui transférer une entreprise."
        : error.code === "42501"
          ? "Vous n’avez pas l’autorisation de transférer cette entreprise."
          : error.code === "P0002"
            ? "L’entreprise ou le nouveau propriétaire n’existe plus. Actualisez les listes."
            : "Impossible de transférer cette entreprise. Actualisez la liste et réessayez."
    throw new AdminApiError(message)
  }
}

export function adminErrorMessage(error: unknown, fallback: string) {
  return error instanceof AdminApiError ? error.message : fallback
}
