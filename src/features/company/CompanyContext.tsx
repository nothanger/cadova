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
  /** A failed read is not evidence that the user has no company. */
  error: string
  /** Re-read membership (e.g. right after onboarding or after setup). */
  refresh: () => Promise<void>
  /** The callback runs after the server confirms access, before consumers remount. */
  selectCompany: (companyId: string, onSelected?: () => void) => Promise<void>
  clearSelectedCompany: () => void
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
    companyId: string | null
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
  const selectionRequest = useRef(0)
  const actor = `${user?.id ?? "anonymous"}:${isAdmin}`
  const activeActor = useRef(actor)
  activeActor.current = actor
  const [company, setCompany] = useState<Company | null>(null)
  const [role, setRole] = useState<MemberRole | null>(null)
  const [resolution, setResolution] = useState<{
    scope: string | null
    loading: boolean
  }>({ scope: null, loading: true })
  const [schemaMissing, setSchemaMissing] = useState(false)
  const [loadError, setLoadError] = useState("")

  const load = useCallback(async () => {
    // Wait for the restored session before resolving company membership.
    if (authLoading || adminLoading) return
    const request = ++requestId.current
    if (!user) {
      setCompany(null)
      setRole(null)
      setLoadError("")
      setSchemaMissing(false)
      setResolution({ scope: null, loading: false })
      return
    }
    if (isAdmin && !selectedCompanyId) {
      setCompany(null)
      setRole(null)
      setSchemaMissing(false)
      setLoadError("")
      setResolution({ scope, loading: false })
      return
    }
    // Background refreshes keep the current page and its feedback mounted.
    setResolution((current) => ({
      ...current,
      loading: current.scope !== scope,
    }))
    try {
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

      if (error) throw error
      setSchemaMissing(false)
      setLoadError("")

      const membership = data as { companies?: Company; role?: MemberRole } | null
      const companyRow = isAdmin
        ? (data as Company | null)
        : (membership?.companies ?? null)
      setCompany(companyRow)
      setRole(companyRow && isAdmin ? "owner" : (membership?.role ?? null))
      setResolution({ scope, loading: false })
    } catch (error) {
      if (request !== requestId.current) return
      const missing = isSchemaMissingError(error)
      setSchemaMissing(missing)
      setLoadError(
        missing
          ? ""
          : "Votre espace n’a pas pu être chargé. Réessayez pour retrouver votre entreprise et vos devis.",
      )
      // Never redirect to company creation, or expose a previous tenant, after a failed read.
      setCompany(null)
      setRole(null)
      setResolution({ scope, loading: false })
    }
  }, [user, authLoading, adminLoading, isAdmin, selectedCompanyId, scope])

  const selectCompany = useCallback(
    async (companyId: string, onSelected?: () => void) => {
      if (!isAdmin || !user) throw new Error("Accès administrateur requis.")
      const ticket = ++selectionRequest.current
      const currentActor = `${user.id}:${isAdmin}`
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, created_at, updated_at")
        .eq("id", companyId)
        .single()
      if (error) throw error
      if (ticket !== selectionRequest.current || currentActor !== activeActor.current)
        throw new Error(
          "L’espace sélectionné a changé. Ouvrez à nouveau le dossier souhaité.",
        )
      requestId.current++
      setSelection({ userId: user.id, companyId })
      setCompany(data as Company)
      setRole("owner")
      setSchemaMissing(false)
      setLoadError("")
      setResolution({ scope: `${user.id}:${companyId}`, loading: false })
      try {
        sessionStorage.setItem(`cadova.admin-company.${user.id}`, companyId)
      } catch {
        // Selection remains available for this session when storage is blocked.
      }
      onSelected?.()
    },
    [isAdmin, user],
  )

  const clearSelectedCompany = useCallback(() => {
    if (!isAdmin || !user) return
    requestId.current++
    selectionRequest.current++
    try {
      sessionStorage.removeItem(`cadova.admin-company.${user.id}`)
    } catch {
      // Memory selection is still cleared when browser storage is unavailable.
    }
    setSelection({ userId: user.id, companyId: null })
    setCompany(null)
    setRole(null)
    setSchemaMissing(false)
    setLoadError("")
    setResolution({ scope: `${user.id}:admin`, loading: false })
  }, [isAdmin, user])

  useEffect(() => {
    void load()
    return () => {
      requestId.current++
    }
  }, [load])

  useEffect(
    () => () => {
      selectionRequest.current++
    },
    [actor],
  )

  return (
    <CompanyContext.Provider
      value={{
        company: resolution.scope === scope ? company : null,
        role: resolution.scope === scope ? role : null,
        loading:
          authLoading ||
          adminLoading ||
          resolution.loading ||
          resolution.scope !== scope,
        schemaMissing,
        error: resolution.scope === scope ? loadError : "",
        refresh: load,
        selectCompany,
        clearSelectedCompany,
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
