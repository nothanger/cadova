/**
 * Money helpers. Amounts are stored as integer cents (bigint in Postgres) and
 * never as floating-point numbers — 0.1 + 0.2 !== 0.3 in IEEE-754, and such
 * rounding drift is unacceptable for money. Integers are exact.
 *
 * MVP is EUR only; formatting is fr-FR.
 */

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
})

/** 125050 -> "1 250,50 €" */
export function formatCents(cents: number): string {
  return eur.format(cents / 100)
}

/**
 * Parse a user-typed euro amount into integer cents.
 * Accepts "1250,50", "1 250.50", "1250" etc. Returns null when invalid.
 */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/\s/g, "")
    .replace(/€/g, "")
    .replace(",", ".")
  if (cleaned === "") return null
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const euros = Number.parseFloat(cleaned)
  if (Number.isNaN(euros)) return null
  return Math.round(euros * 100)
}

/** 125050 -> "1250.50" for pre-filling an <input> when editing. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2)
}
