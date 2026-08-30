import { supabase } from "@/lib/supabase"
import type { QuoteWithClient } from "@/types"
import { isQuoteDueForFollowUp, FOLLOWUP_THRESHOLD_DAYS } from "@/lib/followup"

export interface DashboardData {
  followUp: { count: number; amountCents: number }
  pending: { count: number; amountCents: number }
  accepted: { count: number; amountCents: number }
  /** Quotes due for follow-up, most overdue first. */
  priority: QuoteWithClient[]
  /** Most recently created quotes. */
  latest: QuoteWithClient[]
}

/**
 * Everything the dashboard needs, from a single read of the company's quotes.
 * Aggregations (follow-up / pending / accepted) are computed in JS from real
 * rows — no hardcoded numbers. "À relancer" is derived, not stored.
 */
export async function getDashboardData(
  companyId: string,
  followupDelayDays = FOLLOWUP_THRESHOLD_DAYS,
): Promise<DashboardData> {
  const { data, error } = await supabase
    .from("quotes")
    .select("*, client:clients (id, name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
  if (error) throw error

  const quotes = (data ?? []) as unknown as QuoteWithClient[]

  const followUp = { count: 0, amountCents: 0 }
  const pending = { count: 0, amountCents: 0 }
  const accepted = { count: 0, amountCents: 0 }
  const priority: QuoteWithClient[] = []

  for (const q of quotes) {
    if (q.status === "sent") {
      pending.count++
      pending.amountCents += q.amount_cents
      if (isQuoteDueForFollowUp(q, followupDelayDays)) {
        followUp.count++
        followUp.amountCents += q.amount_cents
        priority.push(q)
      }
    } else if (q.status === "accepted") {
      accepted.count++
      accepted.amountCents += q.amount_cents
    }
  }

  // Most overdue first (oldest sent_at first).
  priority.sort((a, b) => (a.sent_at ?? "").localeCompare(b.sent_at ?? ""))

  return {
    followUp,
    pending,
    accepted,
    priority,
    latest: quotes.slice(0, 5),
  }
}
