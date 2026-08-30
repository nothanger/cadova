import type { ReactNode } from "react"
import { Navigate, Outlet } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import { DatabaseSetupPage } from "@/features/company/DatabaseSetupPage"

function FullScreenLoader() {
  return (
    <div className="flex min-h-full items-center justify-center text-muted">
      <Loader2 size={22} className="animate-spin" />
    </div>
  )
}

/** Public routes (/login, /signup): bounce authenticated users into the app. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (session) return <Navigate to="/app" replace />
  return <>{children}</>
}

/** Requires a session; otherwise redirect to /login. */
export function RequireAuth() {
  const { session, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

/** Inside an authenticated area: force onboarding until a company exists. */
export function RequireCompany() {
  const { loading, company, schemaMissing } = useCompany()
  if (loading) return <FullScreenLoader />
  if (schemaMissing) return <DatabaseSetupPage />
  if (!company) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

/** The onboarding route: needs auth but no company yet. */
export function RequireNoCompany({ children }: { children: ReactNode }) {
  const { loading, company, schemaMissing } = useCompany()
  if (loading) return <FullScreenLoader />
  if (schemaMissing) return <DatabaseSetupPage />
  if (company) return <Navigate to="/app" replace />
  return <>{children}</>
}
