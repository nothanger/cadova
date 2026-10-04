import { supabase } from "@/lib/supabase"
import { getClient } from "@/features/clients/api"
import {
  getCompanyEmailSettings,
  getFollowupServiceStatus,
  contactError,
} from "@/features/company/contactApi"
import type { QuoteWithClient } from "@/types"

export interface QuoteAutomation {
  quote_id: string
  company_id: string
  enabled: boolean
  paused: boolean
  generation: number
  activated_by: string | null
  first_delay_days: number
  second_delay_days: number
  subject_template: string
  body_template: string
  next_send_at: string | null
  stop_reason: string | null
  updated_at: string
}

export interface FollowupJob {
  id: string
  quote_id: string
  company_id: string
  generation: number
  step: number
  created_at: string
  status: "queued" | "processing" | "sent" | "failed" | "cancelled" | "delivery_unknown"
  attempts: number
  scheduled_at: string
  next_attempt_at: string | null
  first_attempt_at: string | null
  provider_message_id: string | null
  sent_at: string | null
  last_error_code: string | null
}

export interface AutomationInput {
  firstDelayDays: number
  secondDelayDays: number
  subject: string
  body: string
  nextSendDate?: string | null
}

class AutomationApiError extends Error {}

export function automationError(error: unknown, fallback: string) {
  return error instanceof AutomationApiError
    ? error.message
    : contactError(error, fallback)
}

function throwAutomationError(
  error: { code?: string; message: string },
  fallback: string,
): never {
  throw new AutomationApiError(
    error.code && ["42501", "23514", "22023", "P0002", "55000"].includes(error.code)
      ? error.message
      : fallback,
  )
}

export async function getQuoteAutomation(
  quoteId: string,
): Promise<QuoteAutomation | null> {
  const { data, error } = await supabase.rpc("get_quote_followup_automation", {
    p_quote_id: quoteId,
  })
  if (error)
    throwAutomationError(
      error,
      "Les relances automatiques ne sont pas encore disponibles pour ce devis.",
    )
  return data as QuoteAutomation | null
}

export async function loadAutomationContext(
  quote: Pick<QuoteWithClient, "id" | "company_id" | "client_id">,
) {
  const [automation, settings, service, client, companyResult, pendingJobsResult] =
    await Promise.all([
      getQuoteAutomation(quote.id),
      getCompanyEmailSettings(quote.company_id),
      getFollowupServiceStatus(),
      getClient(quote.client_id),
      supabase.from("companies").select("id,name").eq("id", quote.company_id).single(),
      supabase
        .from("quote_followup_jobs")
        .select("status,first_attempt_at")
        .eq("quote_id", quote.id)
        .in("status", ["processing", "delivery_unknown", "queued"]),
    ])
  if (companyResult.error)
    throwAutomationError(
      companyResult.error,
      "Impossible de retrouver l’entreprise de ce devis.",
    )
  if (pendingJobsResult.error)
    throwAutomationError(
      pendingJobsResult.error,
      "Impossible de vérifier les envois en cours. Réessayez avant de modifier les relances.",
    )
  return {
    automation,
    settings,
    service,
    client,
    company: companyResult.data as { id: string; name: string },
    hasUnresolvedSend: (pendingJobsResult.data ?? []).some(
      (job: Pick<FollowupJob, "status" | "first_attempt_at">) =>
        job.status === "processing" ||
        job.status === "delivery_unknown" ||
        (job.status === "queued" && job.first_attempt_at !== null),
    ),
  }
}

export async function listAutomationJobs(quoteId: string, page = 0, pageSize = 10) {
  const { data, error } = await supabase
    .from("quote_followup_jobs")
    .select("*")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize)
  if (error)
    throwAutomationError(error, "Impossible de charger l’historique des envois.")
  const items = (data ?? []) as FollowupJob[]
  return { items: items.slice(0, pageSize), hasMore: items.length > pageSize }
}

export async function saveQuoteAutomation(
  quoteId: string,
  enabled: boolean,
  input?: AutomationInput,
): Promise<QuoteAutomation> {
  const { data, error } = await supabase.rpc("save_quote_followup_automation", {
    p_quote_id: quoteId,
    p_enabled: enabled,
    ...(input
      ? {
          p_first_delay_days: input.firstDelayDays,
          p_second_delay_days: input.secondDelayDays,
          p_subject_template: input.subject.trim(),
          p_body_template: input.body.trim(),
          p_next_send_date: input.nextSendDate || null,
        }
      : {}),
  })
  if (error)
    throwAutomationError(
      error,
      "Impossible d’enregistrer les relances automatiques. Réessayez.",
    )
  if (!data || typeof data !== "object")
    throw new AutomationApiError(
      "L’enregistrement n’a pas pu être confirmé. Actualisez le devis.",
    )
  return data as QuoteAutomation
}

export async function pauseQuoteAutomation(
  quoteId: string,
  paused: boolean,
): Promise<QuoteAutomation> {
  const { data, error } = await supabase.rpc("set_quote_followup_automation_paused", {
    p_quote_id: quoteId,
    p_paused: paused,
  })
  if (error)
    throwAutomationError(error, "Impossible de modifier la pause des relances.")
  if (!data || typeof data !== "object")
    throw new AutomationApiError(
      "Le changement de pause n’a pas pu être confirmé. Actualisez le devis.",
    )
  return data as QuoteAutomation
}

export async function recordQuoteResponse(quoteId: string, content: string) {
  const { data, error } = await supabase.rpc("record_quote_response", {
    p_quote_id: quoteId,
    p_content: content.trim(),
  })
  if (error)
    throwAutomationError(error, "Impossible d’enregistrer cette réponse. Réessayez.")
  if (typeof data !== "string")
    throw new AutomationApiError(
      "La réponse reçue n’a pas pu être confirmée. Actualisez le devis.",
    )
  return data
}
