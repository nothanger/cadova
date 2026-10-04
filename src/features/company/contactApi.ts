import { supabase } from "@/lib/supabase"

export interface CompanyEmailSettings {
  company_id: string
  reply_to: string | null
  automation_paused: boolean
  updated_at: string
}

export interface FollowupServiceStatus {
  ready: boolean
  code?: "disabled" | "email_configuration_missing" | string
}

class ContactApiError extends Error {}

export function contactError(error: unknown, fallback: string) {
  return error instanceof ContactApiError ? error.message : fallback
}

function throwContactError(
  error: { code?: string; message: string },
  fallback: string,
): never {
  throw new ContactApiError(
    error.code && ["42501", "23514", "22023", "P0002"].includes(error.code)
      ? error.message
      : fallback,
  )
}

export async function getCompanyEmailSettings(
  companyId: string,
): Promise<CompanyEmailSettings | null> {
  const { data, error } = await supabase
    .from("company_email_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle()
  if (error)
    throwContactError(
      error,
      "Les coordonnées email de l’entreprise ne sont pas encore disponibles.",
    )
  return data as CompanyEmailSettings | null
}

export async function setCompanyEmailSettings(
  companyId: string,
  replyTo: string,
): Promise<CompanyEmailSettings> {
  const { data, error } = await supabase.rpc("set_company_email_settings", {
    p_company_id: companyId,
    p_reply_to: replyTo.trim(),
  })
  if (error)
    throwContactError(
      error,
      "Impossible d’enregistrer l’adresse de réponse. Réessayez.",
    )
  if (!data || typeof data !== "object")
    throw new ContactApiError(
      "L’enregistrement de l’adresse n’a pas pu être confirmé. Actualisez la page.",
    )
  return data as CompanyEmailSettings
}

export async function getFollowupServiceStatus(): Promise<FollowupServiceStatus> {
  const { data, error } = await supabase.rpc("read_quote_followup_service_status")
  if (error)
    throwContactError(
      error,
      "Impossible de vérifier si le service d’envoi est disponible.",
    )
  if (!data || typeof data.ready !== "boolean")
    throw new ContactApiError("Le service d’envoi n’a pas confirmé sa disponibilité.")
  return data as FollowupServiceStatus
}
