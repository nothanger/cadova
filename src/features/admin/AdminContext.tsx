import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useAuth } from "@/features/auth/AuthContext"
import { supabase } from "@/lib/supabase"

interface AdminContextValue {
  isAdmin: boolean
  loading: boolean
  error: string
  refresh: () => Promise<void>
}

const AdminContext = createContext<AdminContextValue | undefined>(undefined)

export function AdminProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const requestId = useRef(0)
  const [access, setAccess] = useState({
    userId: null as string | null,
    isAdmin: false,
    loading: true,
    error: "",
  })

  const refresh = useCallback(async () => {
    const request = ++requestId.current
    if (authLoading) return
    if (!user) {
      setAccess({ userId: null, isAdmin: false, loading: false, error: "" })
      return
    }
    setAccess((current) => ({
      ...current,
      loading: current.userId !== user.id,
    }))
    let isAdmin = false
    let accessError = ""
    try {
      const { data, error } = await supabase.rpc("is_platform_admin")
      isAdmin = !error && data === true
      if (error) accessError = "Impossible de vérifier l’accès à l’administration."
    } catch {
      accessError = "Impossible de vérifier l’accès à l’administration."
    }
    if (request !== requestId.current) return
    setAccess({
      userId: user.id,
      isAdmin,
      loading: false,
      error: accessError,
    })
  }, [user, authLoading])

  useEffect(() => {
    refresh()
    return () => {
      requestId.current++
    }
  }, [refresh])

  return (
    <AdminContext.Provider
      value={{
        isAdmin: access.userId === user?.id && access.isAdmin,
        loading:
          authLoading || access.loading || Boolean(user && access.userId !== user.id),
        error: access.userId === user?.id ? access.error : "",
        refresh,
      }}
    >
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (!context) throw new Error("useAdmin must be used within AdminProvider")
  return context
}
