import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { supabase } from "@/lib/supabase"
import { isSchemaMissingError } from "@/lib/setup"
import { useAuth } from "@/features/auth/AuthContext"
import type { Company, MemberRole } from "@/types"

interface CompanyContextValue {
  company: Company | null
  role: MemberRole | null
  loading: boolean
  /** True when the database schema hasn't been applied yet. */
  schemaMissing: boolean
  /** Re-read membership (e.g. right after onboarding or after setup). */
  refresh: () => Promise<void>
}

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined)

/**
 * Resolves the current user's company (MVP: at most one). RLS guarantees this
 * query only ever returns the caller's own membership.
 */
export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [company, setCompany] = useState<Company | null>(null)
  const [role, setRole] = useState<MemberRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [schemaMissing, setSchemaMissing] = useState(false)

  const load = useCallback(async () => {
    if (!user) {
      setCompany(null)
      setRole(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from("company_members")
      .select("role, companies:company_id (id, name, created_at, updated_at)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error("[Cadova] failed to load company", error)
      // Distinguish "schema not set up yet" from a transient error.
      setSchemaMissing(isSchemaMissingError(error))
    } else {
      setSchemaMissing(false)
    }

    const companyRow = data?.companies as unknown as Company | null ?? null
    setCompany(companyRow)
    setRole(data?.role as MemberRole | undefined ?? null)
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  return (
    <CompanyContext.Provider
      value={{ company, role, loading, schemaMissing, refresh: load }}
    >
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error("useCompany must be used within <CompanyProvider>")
  return ctx
}
