import type { QuoteStatus } from "@/types"

export interface SearchRecord {
  kind: "client" | "quote"
  id: string
  company_id: string
  label: string
  detail: string | null
  client_name: string | null
  amount_cents: number | null
  status: QuoteStatus | null
}

export interface SearchResults {
  items: SearchRecord[]
  hasMore: boolean
}

export const SEARCH_MIN_LENGTH = 2
export const SEARCH_MAX_LENGTH = 120
export const SEARCH_LIMIT = 20

export function normalizeSearchQuery(query: string) {
  return query.trim()
}

export function isSearchQueryValid(query: string) {
  const value = normalizeSearchQuery(query)
  return value.length >= SEARCH_MIN_LENGTH && value.length <= SEARCH_MAX_LENGTH
}

/** Refuse malformed or foreign-company data rather than render it. */
export function parseSearchResults(data: unknown, companyId: string): SearchResults {
  const result = data as Partial<SearchResults> | null
  if (
    !result ||
    !Array.isArray(result.items) ||
    result.items.length > SEARCH_LIMIT ||
    typeof result.hasMore !== "boolean"
  )
    throw new Error("Réponse de recherche invalide.")
  for (const item of result.items) {
    if (
      !item ||
      (item.kind !== "client" && item.kind !== "quote") ||
      typeof item.id !== "string" ||
      !item.id ||
      item.company_id !== companyId ||
      typeof item.label !== "string" ||
      !item.label.trim() ||
      (item.detail !== null && typeof item.detail !== "string") ||
      (item.client_name !== null && typeof item.client_name !== "string") ||
      (item.amount_cents !== null &&
        (!Number.isSafeInteger(item.amount_cents) || item.amount_cents < 0)) ||
      (item.status !== null &&
        !["draft", "sent", "accepted", "refused"].includes(item.status))
    )
      throw new Error("Réponse de recherche invalide.")
  }
  return result as SearchResults
}

export function searchRecordPath(record: Pick<SearchRecord, "kind" | "id">) {
  return `/app/${record.kind === "client" ? "clients" : "quotes"}/${encodeURIComponent(record.id)}`
}
