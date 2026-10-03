import { Database } from "lucide-react"
import { CadovaLogo } from "@/components/CadovaLogo"

export function DatabaseSetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-[var(--radius-cadova)] border border-line bg-surface p-8">
        <CadovaLogo variant="full" className="mb-6 h-8" />
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Database size={22} />
        </div>
        <h1 className="text-xl font-semibold text-ink">
          Base de données à initialiser
        </h1>
        <p className="mt-2 text-sm text-muted">
          Votre projet Supabase est connecté mais les tables de Cadova
          n’existent pas encore. Exécutez, dans l’ordre, les fichiers présents
          dans <code>supabase/migrations</code> depuis le SQL Editor de votre
          projet, puis rechargez cette page.
        </p>
      </div>
    </div>
  )
}
