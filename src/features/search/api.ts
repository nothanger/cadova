import { supabase } from "@/lib/supabase"
import {
  isSearchQueryValid,
  normalizeSearchQuery,
  parseSearchResults,
  SEARCH_LIMIT,
} from "./search"

export async function searchCompanyRecords(
  companyId: string,
  query: string,
  signal?: AbortSignal,
) {
  if (!companyId || !isSearchQueryValid(query))
    throw new Error("Saisissez entre 2 et 120 caractères.")
  let request = supabase.rpc("search_company_records", {
    p_company_id: companyId,
    p_query: normalizeSearchQuery(query),
    p_limit: SEARCH_LIMIT,
  })
  if (signal) request = request.abortSignal(signal)
  const { data, error } = await request
  if (error) throw new Error("La recherche est momentanément indisponible.")
  return parseSearchResults(data, companyId)
}
