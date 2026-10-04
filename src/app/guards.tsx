import type { ReactNode } from "react"
import { Link, Navigate, Outlet } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import { DatabaseSetupPage } from "@/features/company/DatabaseSetupPage"
import { useAdmin } from "@/features/admin/AdminContext"
import { Button, Card } from "@/components/ui"

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
  const { isAdmin, loading: adminLoading } = useAdmin()
  if (loading || (session && adminLoading)) return <FullScreenLoader />
  if (session) return <Navigate to={isAdmin ? "/admin" : "/app"} replace />
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
  const { isAdmin, loading: adminLoading } = useAdmin()
  if (loading || adminLoading) return <FullScreenLoader />
  if (schemaMissing) return <DatabaseSetupPage />
  if (!company) return <Navigate to={isAdmin ? "/admin" : "/onboarding"} replace />
  return <Outlet />
}

/** The onboarding route: needs auth but no company yet. */
export function RequireNoCompany({ children }: { children: ReactNode }) {
  const { loading, company, schemaMissing } = useCompany()
  const { isAdmin, loading: adminLoading } = useAdmin()
  if (loading || adminLoading) return <FullScreenLoader />
  if (isAdmin) return <Navigate to="/admin" replace />
  if (schemaMissing) return <DatabaseSetupPage />
  if (company) return <Navigate to="/app" replace />
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, loading, error, refresh } = useAdmin()
  if (loading) return <FullScreenLoader />
  if (error || !isAdmin) {
    return (
      <main tabIndex={-1} className="page-container py-16">
        <Card className="mx-auto max-w-lg p-6">
          <h1 className="text-2xl font-semibold">
            {error ? "Administration indisponible" : "Accès réservé"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            {error || "Cette page est réservée aux administrateurs de Cadova."}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            {error && <Button onClick={refresh}>Réessayer</Button>}
            <Link to="/app" className="text-sm font-medium text-primary underline">
              Retour à mon espace
            </Link>
          </div>
        </Card>
      </main>
    )
  }
  return <>{children}</>
}
