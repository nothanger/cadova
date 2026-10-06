export const workOrderStatuses = [
  "to_schedule",
  "scheduled",
  "in_progress",
  "completed",
] as const

export type WorkOrderStatus = (typeof workOrderStatuses)[number]

export interface QuoteWorkOrder {
  quote_id: string
  company_id: string
  status: WorkOrderStatus
  scheduled_for: string | null
  created_at: string
  updated_at: string
}

export interface WorkOrderInput {
  status: WorkOrderStatus
  scheduled_for: string | null
}

export const workOrderLabels: Record<WorkOrderStatus, string> = {
  to_schedule: "À planifier",
  scheduled: "Planifiée",
  in_progress: "En cours",
  completed: "Terminée",
}

export function validWorkOrderDate(value: string): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < "1900-01-01" ||
    value > "2200-12-31"
  )
    return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return (
    Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  )
}

export function validateWorkOrderInput(input: WorkOrderInput): string | null {
  if (!workOrderStatuses.includes(input.status)) return "Choisissez un état de suivi."
  if (input.status === "scheduled" && !input.scheduled_for)
    return "Choisissez une date pour planifier l’intervention."
  if (input.status === "to_schedule" && input.scheduled_for)
    return "Retirez la date prévue pour remettre l’intervention à planifier."
  if (input.scheduled_for && !validWorkOrderDate(input.scheduled_for))
    return "Saisissez une date valide."
  return null
}

export function workOrderConfirmation(
  previous: WorkOrderStatus | null,
  next: WorkOrderStatus,
): "complete" | "reopen" | null {
  if (previous !== "completed" && next === "completed") return "complete"
  if (previous === "completed" && next !== "completed") return "reopen"
  return null
}

export function workOrderFromResponse(
  value: unknown,
  quoteId: string,
  companyId: string,
): QuoteWorkOrder | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Partial<QuoteWorkOrder>
  if (
    row.quote_id !== quoteId ||
    row.company_id !== companyId ||
    !workOrderStatuses.includes(row.status as WorkOrderStatus) ||
    !(
      row.scheduled_for === null ||
      (typeof row.scheduled_for === "string" && validWorkOrderDate(row.scheduled_for))
    ) ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string" ||
    !Number.isFinite(Date.parse(row.created_at)) ||
    !Number.isFinite(Date.parse(row.updated_at)) ||
    (row.status === "scheduled" && row.scheduled_for === null) ||
    (row.status === "to_schedule" && row.scheduled_for !== null)
  )
    return null
  return {
    quote_id: row.quote_id,
    company_id: row.company_id,
    status: row.status as WorkOrderStatus,
    scheduled_for: row.scheduled_for,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
