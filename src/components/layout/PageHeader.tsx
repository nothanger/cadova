import { usePageTitle } from "@/lib/usePageTitle"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ChevronLeft } from "lucide-react"

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  back?: { to: string; label: string }
}) {
  usePageTitle(title)
  return (
    <div className="mb-8 border-b border-line pb-6">
      {back && (
        <Link
          to={back.to}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
        >
          <ChevronLeft size={16} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <h1 className="break-words text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-tight tracking-[-0.03em] text-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>
        )}
      </div>
    </div>
  )
}
