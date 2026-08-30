import { useState } from "react"
import { Link, NavLink, Outlet } from "react-router-dom"
import {
  LayoutDashboard,
  Users,
  FileText,
  LogOut,
  Menu,
  X,
  Settings,
} from "lucide-react"
import { CadovaLogo } from "@/components/CadovaLogo"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import { cx } from "@/components/ui"
import { NotificationBell } from "@/features/notifications/NotificationBell"

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
]
const followup = [
  { to: "/app/clients", label: "Clients", icon: Users },
  { to: "/app/quotes", label: "Devis", icon: FileText },
]
const bottom = [{ to: "/app/settings", label: "Paramètres", icon: Settings }]

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  onNavigate,
}: {
  to: string
  label: string
  icon: typeof Users
  end?: boolean
  onNavigate: () => void
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cx(
          "flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary-soft text-primary"
            : "text-ink-soft hover:bg-background",
        )
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  )
}

export function AppLayout() {
  const { user, signOut } = useAuth()
  const { company } = useCompany()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <div className="flex min-h-full overflow-x-hidden">
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface px-4 md:hidden">
        <Link to="/" aria-label="Retour à l'accueil">
          <CadovaLogo variant="full" className="h-6" />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg p-2 text-ink hover:bg-background"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-ink/30 md:hidden"
          onClick={close}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto border-r border-line bg-surface px-4 py-5 transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="px-2">
          <Link to="/" aria-label="Retour à l'accueil" onClick={close}>
            <CadovaLogo variant="full" className="h-7" />
          </Link>
        </div>

        <nav className="mt-8 flex min-h-0 flex-1 flex-col gap-1">
          {nav.map((item) => (
            <NavItem key={item.to} {...item} onNavigate={close} />
          ))}

          <p className="mt-6 px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">
            FollowUp
          </p>
          {followup.map((item) => (
            <NavItem key={item.to} {...item} onNavigate={close} />
          ))}

          <div className="mt-auto pt-4">
            {bottom.map((item) => (
              <NavItem key={item.to} {...item} onNavigate={close} />
            ))}
          </div>
        </nav>

        {/* Notifications (desktop) */}
        <div className="hidden md:flex items-center justify-between px-2 pb-2">
          <span className="text-xs text-muted">Notifications</span>
          <NotificationBell />
        </div>

        {/* Footer: company / user / logout */}
        <div className="mt-4 border-t border-line pt-4">
          <div className="px-2">
            <p className="truncate text-sm font-semibold text-ink">
              {company?.name ?? "—"}
            </p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
          </div>
          <button
            onClick={signOut}
            className="mt-3 flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-background"
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1 px-5 pb-16 pt-20 md:px-10 md:pt-10">
        <div className="mx-auto w-full max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
