import { supabase } from "@/lib/supabase"
import {
  validateWorkOrderInput,
  workOrderFromResponse,
  type QuoteWorkOrder,
  type WorkOrderInput,
} from "./model"

class WorkOrderError extends Error {}

export function workOrderError(error: unknown): string {
  return error instanceof WorkOrderError
    ? error.message
    : "Le suivi de l’intervention est momentanément indisponible. Réessayez."
}

export async function getQuoteWorkOrder(
  quoteId: string,
  companyId: string,
  signal?: AbortSignal,
): Promise<QuoteWorkOrder | null> {
  let query = supabase
    .from("quote_work_orders")
    .select("quote_id,company_id,status,scheduled_for,created_at,updated_at")
    .eq("quote_id", quoteId)
    .eq("company_id", companyId)
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query.maybeSingle()
  if (error)
    throw new WorkOrderError(
      "Impossible de charger le suivi de l’intervention. Actualisez pour réessayer.",
    )
  if (data === null) return null
  const row = workOrderFromResponse(data, quoteId, companyId)
  if (!row)
    throw new WorkOrderError(
      "Impossible de vérifier le suivi de ce devis. Actualisez pour réessayer.",
    )
  return row
}

export async function saveQuoteWorkOrder(
  quoteId: string,
  companyId: string,
  input: WorkOrderInput,
  expectedUpdatedAt: string | null,
  signal?: AbortSignal,
): Promise<QuoteWorkOrder> {
  const invalid = validateWorkOrderInput(input)
  if (invalid) throw new WorkOrderError(invalid)
  let request = supabase.rpc("save_quote_work_order", {
    p_quote_id: quoteId,
    p_status: input.status,
    p_scheduled_for: input.scheduled_for,
    p_expected_updated_at: expectedUpdatedAt,
  })
  if (signal) request = request.abortSignal(signal)
  const { data, error } = await request
  if (error) {
    if (error.code === "55000" || error.code === "40001")
      throw new WorkOrderError(
        "Le devis a changé. Actualisez avant de modifier le suivi de l’intervention.",
      )
    if (error.code === "23514")
      throw new WorkOrderError(
        "Ce devis n’est plus accepté. Actualisez le dossier avant de continuer.",
      )
    if (error.code === "22023")
      throw new WorkOrderError("Vérifiez l’état de l’intervention et sa date prévue.")
    if (error.code === "42501" || error.code === "P0002")
      throw new WorkOrderError("Vous n’avez plus accès à ce devis. Actualisez la page.")
    throw new WorkOrderError(
      "L’enregistrement n’a pas pu être confirmé. Actualisez pour vérifier l’état avant de réessayer.",
    )
  }
  const row = workOrderFromResponse(data, quoteId, companyId)
  if (!row)
    throw new WorkOrderError(
      "L’enregistrement n’a pas pu être confirmé. Actualisez pour vérifier l’état avant de réessayer.",
    )
  return row
}
