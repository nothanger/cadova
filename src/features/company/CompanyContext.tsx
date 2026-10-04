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
  const { user, loading: authLoading } = useAuth()
  const [company, setCompany] = useState<Company | null>(null)
  const [role, setRole] = useState<MemberRole | null>(null)
  const [resolution, setResolution] = useState<{
    userId: string | null
    loading: boolean
  }>({ userId: null, loading: true })
  const [schemaMissing, setSchemaMissing] = useState(false)

  const load = useCallback(async () => {
    // Wait for the restored session before resolving company membership.
    if (authLoading) return
    if (!user) {
      setCompany(null)
      setRole(null)
      setResolution({ userId: null, loading: false })
      return
    }
    // Background refreshes keep the current page and its feedback mounted.
    setResolution((current) => ({
      ...current,
      loading: current.userId !== user.id,
    }))
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

    const companyRow = (data?.companies as unknown as Company | null) ?? null
    setCompany(companyRow)
    setRole((data?.role as MemberRole | undefined) ?? null)
    setResolution({ userId: user.id, loading: false })
  }, [user, authLoading])

  useEffect(() => {
    load()
  }, [load])

  return (
    <CompanyContext.Provider
      value={{
        company,
        role,
        loading:
          authLoading ||
          resolution.loading ||
          Boolean(user && resolution.userId !== user.id),
        schemaMissing,
        refresh: load,
      }}
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
