import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider } from "@/features/auth/AuthContext"
import { CompanyProvider } from "@/features/company/CompanyContext"
import { AppRoutes } from "@/app/router"
import { isSupabaseConfigured } from "@/lib/supabase"
import { CadovaLogo } from "@/components/CadovaLogo"
import { LegalPage } from "@/features/legal/LegalPage"

function SetupScreen() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-[var(--radius-cadova)] border border-line bg-surface p-8">
        <CadovaLogo variant="full" className="mb-6 h-8" />
        <h1 className="text-xl font-semibold text-ink">
          Connexion à Supabase requise
        </h1>
        <p className="mt-2 text-sm text-muted">
          Cadova FollowUp a besoin d’un projet Supabase pour l’authentification
          et les données. Créez un fichier <code>.env.local</code> à partir de{" "}
          <code>.env.example</code>, puis renseignez :
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-ink-soft">
          <li>
            <code>VITE_SUPABASE_URL</code>
          </li>
          <li>
            <code>VITE_SUPABASE_ANON_KEY</code>
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted">
          Dans les deux cas, exécutez ensuite, dans l’ordre, les migrations{" "}
          <code>supabase/migrations/0001_initial_schema.sql</code> et{" "}
          <code>supabase/migrations/0002_notifications.sql</code> dans le SQL
          editor de votre projet Supabase.
        </p>
      </div>
    </div>
  )
}

function SetupRoutes() {
  return (
    <Routes>
      <Route path="/privacy" element={<LegalPage kind="privacy" />} />
      <Route path="/terms" element={<LegalPage kind="terms" />} />
      <Route path="/legal-notice" element={<LegalPage kind="legal-notice" />} />
      <Route path="/cookies" element={<LegalPage kind="cookies" />} />
      <Route path="*" element={<SetupScreen />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      {!isSupabaseConfigured ? (
        <SetupRoutes />
      ) : (
        <AuthProvider>
          <CompanyProvider>
            <AppRoutes />
          </CompanyProvider>
        </AuthProvider>
      )}
    </BrowserRouter>
  )
}
