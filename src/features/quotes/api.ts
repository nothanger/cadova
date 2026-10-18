import { supabase } from "@/lib/supabase"
import type {
  Quote,
  QuoteEvent,
  QuoteEventType,
  QuoteStatus,
  QuoteWithClient,
} from "@/types"

export interface QuoteInput {
  client_id: string
  reference: string
  amount_cents: number
  status: QuoteStatus
  sent_at: string | null
  expires_at?: string | null
  notes?: string | null
}

export class QuoteConflictError extends Error {
  constructor() {
    super("Le dossier a changé depuis son ouverture.")
    this.name = "QuoteConflictError"
  }
}

function throwQuoteError(error: { code?: string } | null) {
  if (!error) return
  if (error.code === "40001") throw new QuoteConflictError()
  throw error
}

const SELECT_WITH_CLIENT = "*, client:clients (id, name)"

export async function listQuotes(companyId: string): Promise<QuoteWithClient[]> {
  const { data, error } = await supabase
    .from("quotes")
    .select(SELECT_WITH_CLIENT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as QuoteWithClient[]
}

export async function listQuotesForClient(
  clientId: string,
  companyId?: string,
): Promise<Quote[]> {
  let query = supabase.from("quotes").select("*").eq("client_id", clientId)
  if (companyId) query = query.eq("company_id", companyId)
  const { data, error } = await query.order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getQuote(
  id: string,
  companyId?: string,
): Promise<QuoteWithClient> {
  let query = supabase.from("quotes").select(SELECT_WITH_CLIENT).eq("id", id)
  if (companyId) query = query.eq("company_id", companyId)
  const { data, error } = await query.single()
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
  expectedUpdatedAt: string,
): Promise<Quote> {
  const normalized = normalize(input)
  const { data, error } = await supabase.rpc("update_quote_if_current", {
    p_quote_id: id,
    p_expected_updated_at: expectedUpdatedAt,
    p_client_id: normalized.client_id,
    p_reference: normalized.reference,
    p_amount_cents: normalized.amount_cents,
    p_status: normalized.status,
    p_sent_at: normalized.sent_at,
    p_expires_at: normalized.expires_at ?? null,
    p_notes: normalized.notes,
  })
  throwQuoteError(error)
  return data as Quote
}

/** Update only the status (used by "Marquer accepté/refusé"). */
export async function setQuoteStatus(
  id: string,
  status: Extract<QuoteStatus, "accepted" | "refused">,
  expectedUpdatedAt: string,
  content: string,
): Promise<Quote> {
  const { data, error } = await supabase.rpc("set_quote_status_if_current", {
    p_quote_id: id,
    p_expected_updated_at: expectedUpdatedAt,
    p_status: status,
    p_content: content,
  })
  throwQuoteError(error)
  return data as Quote
}

export async function duplicateQuote(quote: Quote): Promise<Quote> {
  return createQuote(quote.company_id, {
    client_id: quote.client_id,
    reference: `${quote.reference}-COPIE`,
    amount_cents: quote.amount_cents,
    status: "draft",
    sent_at: null,
    notes: quote.notes,
  })
}

export async function listQuoteEvents(quoteId: string): Promise<QuoteEvent[]> {
  const { data, error } = await supabase
    .from("quote_events")
    .select("*")
    .eq("quote_id", quoteId)
    .order("occurred_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function addQuoteEvent(
  quote: Quote,
  eventType: QuoteEventType,
  content?: string,
): Promise<QuoteEvent> {
  const { data, error } = await supabase
    .from("quote_events")
    .insert({
      company_id: quote.company_id,
      quote_id: quote.id,
      event_type: eventType,
      content: content?.trim() || null,
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    })
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function scheduleFollowUp(id: string, date: string | null) {
  const { error } = await supabase
    .from("quotes")
    .update({ next_followup_at: date })
    .eq("id", id)
  if (error) throw error
}

function normalize(input: QuoteInput) {
  return {
    client_id: input.client_id,
    reference: input.reference.trim(),
    amount_cents: input.amount_cents,
    status: input.status,
    sent_at: input.sent_at, // draft may be null; the form enforces a date when sent
    ...(input.expires_at !== undefined ? { expires_at: input.expires_at || null } : {}),
    notes: input.notes?.trim() ? input.notes.trim() : null,
  }
}
