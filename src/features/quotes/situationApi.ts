import { supabase } from "@/lib/supabase"
import type { QuoteWithClient } from "@/types"
import type {
  ReadState,
  WorkspaceContext,
  WorkspaceQuote,
  WorkspaceAutomation,
  WorkspaceMessage,
  WorkspaceEvent,
  WorkspaceDelivery,
  WorkspaceSendJob,
} from "@/features/dashboard/workspaceActions"
import { getFollowupServiceStatus } from "@/features/company/contactApi"
import { getReminderPrefs } from "@/features/notifications/api"
import { getQuoteWorkOrder } from "./work-orders/api"

/** Each source is explicit about availability, and every business read is scoped. */
export async function getQuoteSituationContext(
  quote: QuoteWithClient,
  options: { isAdmin?: boolean } = {},
): Promise<WorkspaceContext> {
  const readRows = async <T>(
    table: string,
    columns: string,
    quoteScoped = true,
  ): Promise<{ data: T[]; state: ReadState }> => {
    try {
      let query = supabase
        .from(table)
        .select(columns)
        .eq("company_id", quote.company_id)
      if (quoteScoped) query = query.eq("quote_id", quote.id)
      const result = await query
      if (result.error || !Array.isArray(result.data))
        throw new Error("Source unavailable")
      return { data: result.data as T[], state: "available" }
    } catch {
      return { data: [], state: "unavailable" }
    }
  }
  const [
    automation,
    messages,
    events,
    deliveries,
    sendJobs,
    settings,
    client,
    work,
    service,
    preferences,
  ] = await Promise.all([
    readRows<WorkspaceAutomation>(
      "quote_followup_automations",
      "quote_id,company_id,enabled,paused,next_send_at,stop_reason",
    ),
    readRows<WorkspaceMessage>(
      "quote_client_messages",
      "id,company_id,quote_id,author,kind,created_at",
    ),
    readRows<WorkspaceEvent>(
      "quote_events",
      "company_id,quote_id,event_type,occurred_at",
    ),
    readRows<WorkspaceDelivery>(
      "quote_email_deliveries",
      "id,company_id,quote_id,status,last_event_at,created_at",
    ),
    readRows<WorkspaceSendJob>(
      "quote_initial_send_jobs",
      "company_id,quote_id,status,created_at",
    ),
    readRows<{
      company_id: string
      reply_to: string | null
      automation_paused: boolean
    }>("company_email_settings", "company_id,reply_to,automation_paused", false),
    (async () => {
      try {
        const { data, error } = await supabase
          .from("clients")
          .select("id,company_id,name,email")
          .eq("company_id", quote.company_id)
          .eq("id", quote.client_id)
          .single()
        if (
          error ||
          !data ||
          data.id !== quote.client_id ||
          data.company_id !== quote.company_id
        )
          return null
        return data as {
          id: string
          company_id: string
          name: string
          email: string | null
        }
      } catch {
        return null
      }
    })(),
    getQuoteWorkOrder(quote.id, quote.company_id)
      .then((data) => ({ data, state: "available" as const }))
      .catch(() => ({ data: null, state: "unavailable" as const })),
    getFollowupServiceStatus()
      .then((data) => data.ready)
      .catch(() => null),
    (async () => {
      if (options.isAdmin)
        return { data: { followupDelayDays: 3, reminderHour: 8 }, available: true }
      try {
        const { data, error } = await supabase.auth.getUser()
        if (error || !data.user) throw new Error("No user")
        return {
          data: await getReminderPrefs(data.user.id, quote.company_id),
          available: true,
        }
      } catch {
        return { data: null, available: false }
      }
    })(),
  ])
  const emailSettings = settings.data.find((row) => row.company_id === quote.company_id)
  const currentQuote: WorkspaceQuote = { ...quote, client: client ?? quote.client }
  return {
    companyId: quote.company_id,
    quotes: [currentQuote],
    automations: automation.data,
    messages: messages.data,
    events: events.data,
    deliveries: deliveries.data,
    sendJobs: sendJobs.data,
    replyTo: emailSettings?.reply_to ?? null,
    companyPaused: emailSettings?.automation_paused ?? false,
    reads: {
      automation: automation.state,
      messages: messages.state,
      events: events.state,
      deliveries: deliveries.state,
      sendJobs: sendJobs.state,
      settings: settings.state,
    },
    workOrders: work.data ? [work.data] : [],
    workOrdersRead: work.state,
    serviceReady: service,
    followupDelayDays: preferences.data?.followupDelayDays,
    preferencesUnavailable: !preferences.available,
    clientRead: client ? "available" : "unavailable",
  }
}
