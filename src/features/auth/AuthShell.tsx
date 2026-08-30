import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { CadovaLogo } from "@/components/CadovaLogo"

/** Centered card shell for /login and /signup. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-background hover:text-ink"
          >
            <ArrowLeft size={16} />
            Accueil
          </Link>
        </div>
        <div className="mb-8 flex justify-center">
          <Link to="/" aria-label="Retour à l'accueil">
            <CadovaLogo variant="full" className="h-8" />
          </Link>
        </div>
        <div className="rounded-[var(--radius-cadova)] border border-line bg-surface p-8">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <div className="mt-6 text-center text-sm text-muted">{footer}</div>
      </div>
    </div>
  )
}
