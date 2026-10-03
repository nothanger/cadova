import { useEffect, useRef, useState } from "react"
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

const nav = [{ to: "/app", label: "Tableau de bord", icon: LayoutDashboard, end: true }]
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
          "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
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
  const toggleRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const first = sidebarRef.current?.querySelector<HTMLElement>("a, button")
    first?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
      if (e.key === "Tab") {
        const elements = sidebarRef.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not(:disabled)",
        )
        if (!elements?.length) return
        const first = elements[0],
          last = elements[elements.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(false)
    }
    window.addEventListener("keydown", handleKey)
    window.addEventListener("resize", onResize)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKey)
      window.removeEventListener("resize", onResize)
      toggleRef.current?.focus()
    }
  }, [open])

  return (
    <div className="flex min-h-screen">
      <a href="#app-content" className="skip-link">
        Aller au contenu
      </a>
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-surface px-4 md:hidden">
        <Link to="/" aria-label="Retour à l'accueil">
          <CadovaLogo variant="full" className="h-6" />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            ref={toggleRef}
            aria-expanded={open}
            aria-controls="app-navigation"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg p-2 text-ink hover:bg-background"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {open && (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-30 bg-ink/30 md:hidden"
          onClick={close}
        />
      )}

      {/* Sidebar */}
      <aside
        id="app-navigation"
        ref={sidebarRef}
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto border-r border-line bg-surface px-4 py-5 transition-transform md:sticky md:top-0 md:h-screen md:shrink-0 md:translate-x-0",
          open ? "visible translate-x-0" : "invisible -translate-x-full md:visible",
        )}
      >
        <div className="px-2">
          <Link to="/" aria-label="Retour à l'accueil" onClick={close}>
            <CadovaLogo variant="full" className="h-7" />
          </Link>
        </div>

        <nav
          aria-label="Navigation de votre espace"
          className="mt-8 flex min-h-0 flex-1 flex-col gap-1"
        >
          {nav.map((item) => (
            <NavItem key={item.to} {...item} onNavigate={close} />
          ))}

          <p className="mt-6 px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Suivi commercial
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
            <p className="truncate text-xs break-all text-muted">{user?.email}</p>
          </div>
          <button
            onClick={signOut}
            className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-ink-soft transition-colors hover:bg-background"
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main
        id="app-content"
        tabIndex={-1}
        className="min-w-0 flex-1 px-5 pb-16 pt-24 md:px-8 md:pt-9 lg:px-10"
      >
        <div className="mx-auto w-full max-w-[1120px]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
