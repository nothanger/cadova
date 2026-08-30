import { supabase } from "@/lib/supabase"
import type { Quote, QuoteStatus, QuoteWithClient } from "@/types"

export interface QuoteInput {
  client_id: string
  reference: string
  amount_cents: number
  status: QuoteStatus
  sent_at: string | null
  notes?: string | null
}

const SELECT_WITH_CLIENT = "*, client:clients (id, name)"

export async function listQuotes(
  companyId: string,
): Promise<QuoteWithClient[]> {
  const { data, error } = await supabase
    .from("quotes")
    .select(SELECT_WITH_CLIENT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as QuoteWithClient[]
}

export async function listQuotesForClient(clientId: string): Promise<Quote[]> {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getQuote(id: string): Promise<QuoteWithClient> {
  const { data, error } = await supabase
    .from("quotes")
    .select(SELECT_WITH_CLIENT)
    .eq("id", id)
    .single()
  if (error) throw error
  return data as unknown as QuoteWithClient
}

export async function createQuote(
  companyId: string,
  input: QuoteInput,
): Promise<Quote> {
  const { data, error } = await supabase
    .from("quotes")
    .insert({ company_id: companyId, ...normalize(input) })
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function updateQuote(
  id: string,
  input: QuoteInput,
): Promise<Quote> {
  const { data, error } = await supabase
    .from("quotes")
    .update(normalize(input))
    .eq("id", id)
    .select("*")
    .single()
  if (error) throw error
  return data
}

/** Update only the status (used by "Marquer accepté/refusé"). */
export async function setQuoteStatus(
  id: string,
  status: QuoteStatus,
): Promise<Quote> {
  const { data, error } = await supabase
    .from("quotes")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single()
  if (error) throw error
  return data
}

function normalize(input: QuoteInput) {
  return {
    client_id: input.client_id,
    reference: input.reference.trim(),
    amount_cents: input.amount_cents,
    status: input.status,
    sent_at: input.sent_at, // draft may be null; the form enforces a date when sent
    notes: input.notes?.trim() ? input.notes.trim() : null,
  }
}
