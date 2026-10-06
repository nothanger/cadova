// Only the browser test runner serves this module. No production services.
import { supabase, isSupabaseConfigured } from "/__search-base-fixture.mjs"
export { supabase, isSupabaseConfigured }
const options = window.__scenario || {}
const originalRpc = supabase.rpc
const db = window.__testStore
window.__searchQueries = []
window.__searchFailure = false
supabase.rpc = (name, args) => {
  if (name !== "search_company_records") return originalRpc(name, args)
  window.__searchQueries.push({ ...args })
  const request = (async () => {
    if (
      args.p_query === options.searchDelayQuery &&
      (!options.searchDelayCompany || args.p_company_id === options.searchDelayCompany)
    )
      await new Promise((resolve) => setTimeout(resolve, options.searchDelayMs ?? 900))
    if (window.__searchFailure)
      return { data: null, error: { message: "Search unavailable" } }
    const normalize = (text) =>
      String(text ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    const query = normalize(args.p_query)
    const items = [
      ...db.clients
        .filter(
          (client) =>
            client.company_id === args.p_company_id &&
            [client.name, client.email, client.phone].some((field) =>
              normalize(field).includes(query),
            ),
        )
        .map((client) => ({
          kind: "client",
          id: client.id,
          company_id: client.company_id,
          label: client.name,
          detail: client.email ?? client.phone ?? null,
          client_name: client.name,
          amount_cents: null,
          status: null,
        })),
      ...db.quotes
        .filter(
          (quote) =>
            quote.company_id === args.p_company_id &&
            [
              quote.reference,
              db.clients.find((client) => client.id === quote.client_id)?.name,
              quote.amount_cents / 100,
            ].some((field) => normalize(field).includes(query)),
        )
        .map((quote) => ({
          kind: "quote",
          id: quote.id,
          company_id: quote.company_id,
          label: quote.reference,
          detail: "Détail du devis",
          client_name:
            db.clients.find((client) => client.id === quote.client_id)?.name ?? null,
          amount_cents: quote.amount_cents,
          status: quote.status,
        })),
    ]
    if (options.searchForeign && items.length)
      items[0] = { ...items[0], company_id: "forbidden-company" }
    return {
      data: {
        items: items.slice(0, 20),
        hasMore: options.searchMore ?? items.length > 20,
      },
      error: null,
    }
  })()
  // Ignore cancellation deliberately: the UI must also reject late responses.
  request.abortSignal = () => request
  return request
}
