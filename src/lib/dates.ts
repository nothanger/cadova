/**
 * Date helpers. `sent_at` is a Postgres `date` (day only, no time/zone), so we
 * work with `yyyy-mm-dd` strings and local-day arithmetic to avoid timezone
 * off-by-one errors that a full `Date`/UTC round-trip introduces.
 */

/** Today as a local `yyyy-mm-dd` string. */
export function todayISO(): string {
  const d = new Date()
  return toISODate(d)
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Whole days between two `yyyy-mm-dd` dates (b - a), timezone-safe. */
export function daysBetween(aISO: string, bISO: string): number {
  const a = Date.parse(`${aISO}T00:00:00`)
  const b = Date.parse(`${bISO}T00:00:00`)
  return Math.round((b - a) / 86_400_000)
}

/** Days elapsed since an ISO date up to today (>= 0 when in the past). */
export function daysSince(dateISO: string): number {
  return daysBetween(dateISO, todayISO())
}

/** "10 sept. 2025" */
const fmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})
export function formatDate(dateISO: string | null): string {
  if (!dateISO) return "—"
  return fmt.format(new Date(`${dateISO}T00:00:00`))
}
