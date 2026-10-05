import { supabase } from "@/lib/supabase"

export type EmailDeliveryStatus =
  | "accepted" | "delayed" | "delivered" | "bounced" | "failed" | "complained"

export interface QuoteEmailDelivery {
  id: string
  company_id: string
  quote_id: string
  initial_send_job_id: string | null
  automation_job_id: string | null
  provider_message_id: string
  status: EmailDeliveryStatus
  created_at: string
  last_event_at: string
}

export interface QuoteEmailTrackingService {
  deliveryReady: boolean
  receivingReady: boolean
  code: "unconfigured" | "delivery_only" | "ready"
}

export function deliveryStatusLabel(status: EmailDeliveryStatus) {
  return {
    accepted: "Envoi accepté",
    delayed: "Livraison retardée",
    delivered: "Email livré",
    bounced: "Email non livré",
    failed: "Échec de livraison",
    complained: "Email signalé comme indésirable",
  }[status]
}

export function deliveryStatusDetail(status: EmailDeliveryStatus) {
  return {
    accepted: "Le service d’envoi a accepté cet email. Sa livraison n’est pas encore confirmée.",
    delayed: "Le serveur du destinataire retarde la livraison. Le service d’envoi peut réessayer.",
    delivered: "Le serveur du destinataire a accepté cet email. Cela ne confirme pas sa lecture.",
    bounced: "Le serveur du destinataire a refusé cet email. Vérifiez l’adresse avant un nouvel envoi.",
    failed: "Le service d’envoi n’a pas pu livrer cet email. Les relances automatiques sont arrêtées.",
    complained: "Cet email a été signalé comme indésirable. Les relances automatiques sont arrêtées.",
  }[status]
}

export async function getQuoteEmailTracking(quoteId: string): Promise<{
  deliveries: QuoteEmailDelivery[]
  service: QuoteEmailTrackingService
}> {
  const [deliveries, service] = await Promise.all([
    supabase.from("quote_email_deliveries").select("*")
      .eq("quote_id", quoteId).order("last_event_at", { ascending: false }),
    supabase.rpc("read_quote_email_tracking_status"),
  ])
  const state = service.data as Partial<QuoteEmailTrackingService> | null
  if (deliveries.error || service.error || !Array.isArray(deliveries.data) ||
    !state || typeof state.deliveryReady !== "boolean" ||
    typeof state.receivingReady !== "boolean" ||
    !["unconfigured", "delivery_only", "ready"].includes(state.code ?? ""))
    throw new Error("Le suivi des emails est momentanément indisponible.")
  return {
    deliveries: deliveries.data as QuoteEmailDelivery[],
    service: state as QuoteEmailTrackingService,
  }
}
