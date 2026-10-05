import { supabase } from "@/lib/supabase"
import type { QuoteWithClient } from "@/types"
import { FOLLOWUP_THRESHOLD_DAYS } from "@/lib/followup"
import {
  buildWorkspaceActions,
  type WorkspaceContext,
  type WorkspaceQuote,
  type WorkspaceAutomation,
  type WorkspaceMessage,
  type WorkspaceEvent,
  type WorkspaceDelivery,
  type WorkspaceSendJob,
  type WorkAction,
  type ScheduledAction,
  type ReadState,
} from "./workspaceActions"

export interface DashboardData {
  followUp: { count: number; amountCents: number; complete: boolean }
  pending: { count: number; amountCents: number }
  accepted: { count: number; amountCents: number }
  /** Quotes due for follow-up, most overdue first. */
  priority: QuoteWithClient[]
  /** Most recently created quotes. */
  latest: QuoteWithClient[]
  acceptanceRate: number
  wonThisMonthCents: number
  averageAcceptanceDays: number | null
  staleCount: number
  actions: WorkAction[]
  scheduled: ScheduledAction[]
  reads: WorkspaceContext["reads"]
  gettingStarted: {
    replyTo: string | null
    firstQuote: WorkspaceQuote | null
    trackingChosen: boolean
  }
}

/**
 * Indicators use real quote rows; optional feature reads never hide a failed
 * read behind a claim that no action is needed. Every query is tenant-scoped.
 * Aggregations (follow-up / pending / accepted) are computed in JS from real
 * rows — no hardcoded numbers. "À relancer" is derived, not stored.
 */
export async function getDashboardData(
  companyId: string,
  followupDelayDays = FOLLOWUP_THRESHOLD_DAYS,
): Promise<DashboardData> {
  const { data, error } = await supabase
    .from("quotes")
    .select("*, client:clients (id, name, email)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
  if (error) throw error

  const quotes = ((data ?? []) as unknown as WorkspaceQuote[]).filter(
    (quote) => quote.company_id === companyId,
  )
  const [automation, messages, events, deliveries, settings, sendJobs] =
    await Promise.all([
      readOptional<WorkspaceAutomation[]>(() =>
        supabase
          .from("quote_followup_automations")
          .select("*")
          .eq("company_id", companyId),
      ),
      readOptional<WorkspaceMessage[]>(() =>
        supabase
          .from("quote_client_messages")
          .select("id,company_id,quote_id,author,kind,created_at")
          .eq("company_id", companyId),
      ),
      readOptional<WorkspaceEvent[]>(() =>
        supabase
          .from("quote_events")
          .select("company_id,quote_id,event_type,occurred_at")
          .eq("company_id", companyId),
      ),
      readOptional<WorkspaceDelivery[]>(() =>
        supabase.from("quote_email_deliveries").select("*").eq("company_id", companyId),
      ),
      readOptional<{
        company_id: string
        reply_to: string | null
        automation_paused: boolean
      } | null>(() =>
        supabase
          .from("company_email_settings")
          .select("company_id,reply_to,automation_paused")
          .eq("company_id", companyId)
          .maybeSingle(),
      ),
      readOptional<WorkspaceSendJob[]>(() =>
        supabase
          .from("quote_initial_send_jobs")
          .select("company_id,quote_id,status,created_at")
          .eq("company_id", companyId),
      ),
    ])
  const reads = {
    automation: automation.state,
    messages: messages.state,
    events: events.state,
    deliveries: deliveries.state,
    settings: settings.state,
    sendJobs: sendJobs.state,
  }
  const emailSettings = settings.data?.company_id === companyId ? settings.data : null
  const workspace = buildWorkspaceActions(
    {
      companyId,
      quotes,
      automations: automation.data ?? [],
      messages: messages.data ?? [],
      events: events.data ?? [],
      deliveries: deliveries.data ?? [],
      sendJobs: sendJobs.data ?? [],
      replyTo: emailSettings?.reply_to ?? null,
      companyPaused: emailSettings?.automation_paused ?? false,
      reads,
    },
    followupDelayDays,
  )

  const followUp = {
    count: workspace.manualDue.length,
    amountCents: workspace.manualDue.reduce(
      (sum, quote) => sum + quote.amount_cents,
      0,
    ),
    complete: workspace.followupsKnown,
  }
  const pending = { count: 0, amountCents: 0 }
  const accepted = { count: 0, amountCents: 0 }
  const priority: QuoteWithClient[] = workspace.manualDue
  const decided = quotes.filter(
    (q) => q.status === "accepted" || q.status === "refused",
  )
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const wonThisMonthCents = quotes
    .filter((q) => q.status === "accepted" && new Date(q.updated_at) >= monthStart)
    .reduce((sum, q) => sum + q.amount_cents, 0)
  const acceptanceDurations = quotes
    .filter((q) => q.status === "accepted" && q.sent_at)
    .map((q) =>
      Math.max(
        0,
        Math.round(
          (new Date(q.updated_at).getTime() - new Date(q.sent_at!).getTime()) /
            86400000,
        ),
      ),
    )

  for (const q of quotes) {
    if (q.status === "sent") {
      pending.count++
      pending.amountCents += q.amount_cents
    } else if (q.status === "accepted") {
      accepted.count++
      accepted.amountCents += q.amount_cents
    }
  }

  const firstQuote =
    [...quotes].sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null
  const trackingChosen = quotes.some(
    (quote) =>
      quote.status === "accepted" ||
      quote.status === "refused" ||
      (quote.status === "sent" &&
        (quote.next_followup_at ||
          (automation.data ?? []).some(
            (row) =>
              row.company_id === companyId && row.quote_id === quote.id && row.enabled,
          ))),
  )

  return {
    followUp,
    pending,
    accepted,
    priority,
    latest: quotes.slice(0, 5),
    acceptanceRate: decided.length
      ? Math.round((accepted.count / decided.length) * 100)
      : 0,
    wonThisMonthCents,
    averageAcceptanceDays: acceptanceDurations.length
      ? Math.round(
          acceptanceDurations.reduce((a, b) => a + b, 0) / acceptanceDurations.length,
        )
      : null,
    staleCount: quotes.filter(
      (q) => q.status === "sent" && daysBetween(q.updated_at) >= 14,
    ).length,
    actions: workspace.actions,
    scheduled: workspace.scheduled,
    reads,
    gettingStarted: {
      replyTo: emailSettings?.reply_to ?? null,
      firstQuote,
      trackingChosen: Boolean(trackingChosen),
    },
  }
}

function daysBetween(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

async function readOptional<T>(
  query: () => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<{ data: T | null; state: ReadState }> {
  try {
    const result = await query()
    if (result.error) return { data: null, state: "unavailable" }
    return { data: result.data as T, state: "available" }
  } catch {
    return { data: null, state: "unavailable" }
  }
}
