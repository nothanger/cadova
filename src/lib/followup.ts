import type { Quote } from "@/types"
import { daysSince } from "./dates"

/**
 * FollowUp business rule (MVP): a quote is due for follow-up when it was SENT
 * and its send date is at least 3 days ago (J+3).
 *
 *   status === 'sent'  AND  sent_at <= today - 3 days
 *
 * "À relancer" is a COMPUTED state, never a stored status. A quote overdue
 * since yesterday must still appear today, hence `<=` (not `===`). draft /
 * accepted / refused quotes are never due.
 */
export const FOLLOWUP_THRESHOLD_DAYS = 3

export function isQuoteDueForFollowUp(
  quote: Pick<Quote, "status" | "sent_at">,
  thresholdDays = FOLLOWUP_THRESHOLD_DAYS,
): boolean {
  if (quote.status !== "sent" || !quote.sent_at) return false
  return daysSince(quote.sent_at) >= thresholdDays
}

/** How many days a sent quote has been waiting (null if not applicable). */
export function daysWaiting(
  quote: Pick<Quote, "status" | "sent_at">,
): number | null {
  if (quote.status !== "sent" || !quote.sent_at) return null
  return daysSince(quote.sent_at)
}
