import { supabase } from "@/lib/supabase"
import type { Client } from "@/types"

export interface ClientInput {
  name: string
  email?: string | null
  phone?: string | null
  notes?: string | null
}

/** All clients for a company, newest first. */
export async function listClients(companyId: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Clients + their quote count, for the list page. */
export async function listClientsWithCounts(
  companyId: string,
): Promise<(Client & { quote_count: number })[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*, quotes(count)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => {
    const { quotes, ...client } = row as Client & {
      quotes: { count: number }[]
    }
    return { ...client, quote_count: quotes?.[0]?.count ?? 0 }
  })
}

export async function getClient(id: string): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single()
  if (error) throw error
  return data
}

export async function createClient(
  companyId: string,
  input: ClientInput,
): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .insert({ company_id: companyId, ...normalize(input) })
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function updateClient(
  id: string,
  input: ClientInput,
): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .update(normalize(input))
    .eq("id", id)
    .select("*")
    .single()
  if (error) throw error
  return data
}

/** Trim text fields; empty optional fields become null. */
function normalize(input: ClientInput) {
  const clean = (v?: string | null) => {
    const t = v?.trim()
    return t ? t : null
  }
  return {
    name: input.name.trim(),
    email: clean(input.email),
    phone: clean(input.phone),
    notes: clean(input.notes),
  }
}
