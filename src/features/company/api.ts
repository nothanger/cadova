import { supabase } from "@/lib/supabase"

/**
 * Create the company and the owner membership in one atomic server-side
 * transaction (see the create_company_with_owner RPC in the migration).
 * Returns the new company id.
 */
export async function createCompanyWithOwner(
  companyName: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("create_company_with_owner", {
    company_name: companyName,
  })
  if (error) throw error
  return data as string
}
