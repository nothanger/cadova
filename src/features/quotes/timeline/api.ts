import { supabase } from "@/lib/supabase"
import type { QuoteWithClient } from "@/types"
import type { QuoteAutomation } from "../automationApi"
import {
  getCompanyEmailSettings,
  getFollowupServiceStatus,
} from "@/features/company/contactApi"
import { emptyTimelineSources, type TimelineSources } from "./merge"

export const TIMELINE_PAGE_SIZE = 50
const reads = [
  ["events", "quote_events", "*", "occurred_at", "l’historique interne"],
  [
    "messages",
    "quote_client_messages",
    "id,company_id,quote_id,author,kind,content,created_at,nonce",
    "created_at",
    "les échanges client",
  ],
  [
    "deliveries",
    "quote_email_deliveries",
    "id,company_id,quote_id,initial_send_job_id,automation_job_id,status,provider_message_id,created_at,last_event_at",
    "last_event_at",
    "le suivi des livraisons",
  ],
  [
    "documents",
    "quote_documents",
    "id,company_id,quote_id,file_name,created_at",
    "created_at",
    "les documents",
  ],
  [
    "initialJobs",
    "quote_initial_send_jobs",
    "id,company_id,quote_id,status,body,sent_at,updated_at,created_at",
    "updated_at",
    "les envois du devis",
  ],
  [
    "followupJobs",
    "quote_followup_jobs",
    "id,company_id,quote_id,status,body,sent_at,updated_at,created_at",
    "updated_at",
    "les relances automatiques",
  ],
] as const

export async function loadQuoteTimeline(quote: QuoteWithClient, page = 0) {
  const start = page * TIMELINE_PAGE_SIZE
  const responses = await Promise.allSettled(
    reads.map(async ([key, table, columns, date, label]) => {
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .eq("company_id", quote.company_id)
        .eq("quote_id", quote.id)
        .order(date, { ascending: false })
        .order("id", { ascending: false })
        .range(start, start + TIMELINE_PAGE_SIZE)
      if (error || !Array.isArray(data)) throw new Error(label)
      return {
        key,
        rows: data.slice(0, TIMELINE_PAGE_SIZE),
        hasMore: data.length > TIMELINE_PAGE_SIZE,
      }
    }),
  )
  const sources = emptyTimelineSources()
  const unavailable: string[] = []
  let hasMore = false
  responses.forEach((result, index) => {
    if (result.status === "rejected") unavailable.push(reads[index][4])
    else {
      // Explicit tenant filters accompany RLS; the merger checks scope again.
      Object.assign(sources, { [result.value.key]: result.value.rows })
      hasMore ||= result.value.hasMore
    }
  })
  return { sources: sources as TimelineSources, unavailable, hasMore }
}

export interface TimelineAutomation {
  automation: QuoteAutomation | null
  companyPaused: boolean
  serviceReady: boolean
}
export async function loadTimelineAutomation(
  quote: QuoteWithClient,
): Promise<TimelineAutomation> {
  const [{ data, error }, settings, service] = await Promise.all([
    supabase.rpc("get_quote_followup_automation", { p_quote_id: quote.id }),
    getCompanyEmailSettings(quote.company_id),
    getFollowupServiceStatus(),
  ])
  if (error) throw error
  if (data && (data.quote_id !== quote.id || data.company_id !== quote.company_id))
    throw new Error("Scope mismatch")
  return {
    automation: data as QuoteAutomation | null,
    companyPaused: settings?.automation_paused ?? false,
    serviceReady: service.ready,
  }
}
