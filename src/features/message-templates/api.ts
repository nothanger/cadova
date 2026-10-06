import { supabase } from "@/lib/supabase"
import {
  COMPANY_MESSAGE_KINDS,
  messageTemplateErrors,
  signatureError,
  type CompanyMessageKind,
  type CompanyMessageProfile,
  type CompanyMessages,
  type CompanyMessageTemplate,
  type MessageDraft,
} from "./messages"

class CompanyMessageError extends Error {}
export function companyMessageError(error: unknown, fallback: string) {
  return error instanceof CompanyMessageError ? error.message : fallback
}
function apiError(error: { code?: string; message: string }, fallback: string): never {
  throw new CompanyMessageError(
    error.code && ["22023", "42501"].includes(error.code) ? error.message : fallback,
  )
}
function templateForCompany(value: unknown, companyId: string): CompanyMessageTemplate {
  const row = value as CompanyMessageTemplate | null
  if (
    !row ||
    row.company_id !== companyId ||
    !COMPANY_MESSAGE_KINDS.includes(row.kind) ||
    typeof row.subject_template !== "string" ||
    typeof row.body_template !== "string"
  )
    throw new CompanyMessageError(
      "Le modèle de cette entreprise n’a pas pu être confirmé.",
    )
  return row
}
function profileForCompany(value: unknown, companyId: string): CompanyMessageProfile {
  const row = value as CompanyMessageProfile | null
  if (!row || row.company_id !== companyId || typeof row.email_signature !== "string")
    throw new CompanyMessageError(
      "La signature de cette entreprise n’a pas pu être confirmée.",
    )
  return row
}

export async function getCompanyMessages(companyId: string): Promise<CompanyMessages> {
  const [templates, profile, company] = await Promise.all([
    supabase.from("company_message_templates").select("*").eq("company_id", companyId),
    supabase
      .from("company_message_profiles")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle(),
    supabase.from("companies").select("id, name").eq("id", companyId).single(),
  ])
  if (templates.error || profile.error || company.error)
    throw new CompanyMessageError(
      "Les modèles et la signature ne sont pas disponibles. Votre message reste inchangé.",
    )
  return {
    companyName:
      company.data?.id === companyId && typeof company.data.name === "string"
        ? company.data.name
        : "",
    templates: (templates.data ?? []).map((row) => templateForCompany(row, companyId)),
    profile: profile.data ? profileForCompany(profile.data, companyId) : null,
  }
}

export async function saveCompanyMessageTemplate(
  companyId: string,
  kind: CompanyMessageKind,
  draft: MessageDraft,
) {
  const errors = messageTemplateErrors(draft)
  if (errors.subject || errors.body)
    throw new CompanyMessageError(errors.subject || errors.body)
  const { data, error } = await supabase.rpc("save_company_message_template", {
    p_company_id: companyId,
    p_kind: kind,
    p_subject_template: draft.subject.trim(),
    p_body_template: draft.body.trim(),
  })
  if (error) apiError(error, "Impossible d’enregistrer ce modèle. Réessayez.")
  const row = templateForCompany(data, companyId)
  if (row.kind !== kind)
    throw new CompanyMessageError(
      "L’enregistrement de ce modèle n’a pas pu être confirmé.",
    )
  return row
}

export async function deleteCompanyMessageTemplate(
  companyId: string,
  kind: CompanyMessageKind,
) {
  const { error } = await supabase.rpc("delete_company_message_template", {
    p_company_id: companyId,
    p_kind: kind,
  })
  if (error) apiError(error, "Impossible de supprimer ce modèle. Réessayez.")
}

export async function saveCompanyMessageProfile(companyId: string, signature: string) {
  const validation = signatureError(signature)
  if (validation) throw new CompanyMessageError(validation)
  const { data, error } = await supabase.rpc("save_company_message_profile", {
    p_company_id: companyId,
    p_email_signature: signature.trim(),
  })
  if (error) apiError(error, "Impossible d’enregistrer la signature. Réessayez.")
  return profileForCompany(data, companyId)
}
