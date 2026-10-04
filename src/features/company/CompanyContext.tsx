import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { supabase } from "@/lib/supabase"
import { isSchemaMissingError } from "@/lib/setup"
import { useAuth } from "@/features/auth/AuthContext"
import { useAdmin } from "@/features/admin/AdminContext"
import type { Company, MemberRole } from "@/types"

interface CompanyContextValue {
  company: Company | null
  role: MemberRole | null
  loading: boolean
  /** True when the database schema hasn't been applied yet. */
  schemaMissing: boolean
  /** Re-read membership (e.g. right after onboarding or after setup). */
  refresh: () => Promise<void>
  selectCompany: (companyId: string) => Promise<void>
}

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined)

/**
 * Resolves a normal user's membership or a platform administrator's selected
 * company. RLS enforces both scopes using the server-managed administrator role.
 */
export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { isAdmin, loading: adminLoading } = useAdmin()
  const [selection, setSelection] = useState<{
    userId: string
    companyId: string
  } | null>(null)
  const selectedCompanyId = useMemo(() => {
    if (!isAdmin || !user) return null
    if (selection?.userId === user.id) return selection.companyId
    try {
      return sessionStorage.getItem(`cadova.admin-company.${user.id}`)
    } catch {
      return null
    }
  }, [isAdmin, user, selection])
  const scope = user
    ? `${user.id}:${isAdmin ? (selectedCompanyId ?? "admin") : "member"}`
    : null
  const requestId = useRef(0)
  const [company, setCompany] = useState<Company | null>(null)
  const [role, setRole] = useState<MemberRole | null>(null)
  const [resolution, setResolution] = useState<{
    scope: string | null
    loading: boolean
  }>({ scope: null, loading: true })
  const [schemaMissing, setSchemaMissing] = useState(false)

  const load = useCallback(async () => {
    // Wait for the restored session before resolving company membership.
    if (authLoading || adminLoading) return
    const request = ++requestId.current
    if (!user) {
      setCompany(null)
      setRole(null)
      setResolution({ scope: null, loading: false })
      return
    }
    if (isAdmin && !selectedCompanyId) {
      setCompany(null)
      setRole(null)
      setSchemaMissing(false)
      setResolution({ scope, loading: false })
      return
    }
    // Background refreshes keep the current page and its feedback mounted.
    setResolution((current) => ({
      ...current,
      loading: current.scope !== scope,
    }))
    const { data, error } = isAdmin
      ? await supabase
          .from("companies")
          .select("id, name, created_at, updated_at")
          .eq("id", selectedCompanyId!)
          .maybeSingle()
      : await supabase
          .from("company_members")
          .select("role, companies:company_id (id, name, created_at, updated_at)")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle()

    if (request !== requestId.current) return

    if (error) {
      console.error("[Cadova] failed to load company", error)
      // Distinguish "schema not set up yet" from a transient error.
      setSchemaMissing(isSchemaMissingError(error))
    } else {
      setSchemaMissing(false)
    }

    const membership = data as { companies?: Company; role?: MemberRole } | null
    const companyRow = isAdmin
      ? (data as Company | null)
      : (membership?.companies ?? null)
    setCompany(companyRow)
    setRole(companyRow && isAdmin ? "owner" : (membership?.role ?? null))
    setResolution({ scope, loading: false })
  }, [user, authLoading, adminLoading, isAdmin, selectedCompanyId, scope])

  const selectCompany = useCallback(
    async (companyId: string) => {
      if (!isAdmin || !user) throw new Error("Accès administrateur requis.")
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, created_at, updated_at")
        .eq("id", companyId)
        .single()
      if (error) throw error
      setSelection({ userId: user.id, companyId })
      setCompany(data as Company)
      setRole("owner")
      setSchemaMissing(false)
      setResolution({ scope: `${user.id}:${companyId}`, loading: false })
      try {
        sessionStorage.setItem(`cadova.admin-company.${user.id}`, companyId)
      } catch {
        // Selection remains available for this session when storage is blocked.
      }
    },
    [isAdmin, user],
  )

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
          adminLoading ||
          resolution.loading ||
          resolution.scope !== scope,
        schemaMissing,
        refresh: load,
        selectCompany,
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
