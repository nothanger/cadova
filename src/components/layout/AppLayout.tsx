import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Users,
  FileText,
  LogOut,
  Menu,
  X,
  Settings,
  ShieldCheck,
  Search,
  Plus,
  CircleHelp,
} from "lucide-react"
import { CadovaLogo } from "@/components/CadovaLogo"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import { cx, LinkButton } from "@/components/ui"
import { NotificationBell } from "@/features/notifications/NotificationBell"
import { useAdmin } from "@/features/admin/AdminContext"
import { SearchDialog } from "@/features/search/SearchDialog"

const primaryNavigation = [
  { to: "/app", label: "Aujourd’hui", icon: LayoutDashboard, end: true },
  { to: "/app/quotes", label: "Devis", icon: FileText },
  { to: "/app/clients", label: "Clients", icon: Users },
]
const bottom = [
  { to: "/app/settings", label: "Paramètres", icon: Settings },
  { to: "/notifications?view=messages", label: "Aide Cadova", icon: CircleHelp },
]

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
  const location = useLocation()
  const queryMatches =
    !to.includes("?") ||
    new URLSearchParams(location.search).get("view") ===
      new URLSearchParams(to.split("?")[1]).get("view")
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      aria-current={queryMatches ? undefined : false}
      className={({ isActive }) =>
        cx(
          "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
          isActive && queryMatches
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

export function AppLayout({ children }: { children?: ReactNode } = {}) {
  const { user, signOut } = useAuth()
  const { isAdmin } = useAdmin()
  const { company } = useCompany()
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const close = () => setOpen(false)

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.repeat ||
        (!event.metaKey && !event.ctrlKey) ||
        event.key.toLowerCase() !== "k"
      )
        return
      event.preventDefault()
      setOpen(false)
      setSearchOpen(true)
    }
    window.addEventListener("keydown", handleSearchShortcut)
    return () => window.removeEventListener("keydown", handleSearchShortcut)
  }, [])

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
        <Link to="/app" aria-label="Cadova, aujourd’hui">
          <CadovaLogo variant="full" className="h-6" />
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Rechercher un client ou un devis"
            aria-haspopup="dialog"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-ink hover:bg-background"
          >
            <Search size={20} aria-hidden="true" />
          </button>
          <NotificationBell />
          <button
            ref={toggleRef}
            aria-expanded={open}
            aria-controls="app-navigation"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((v) => !v)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-ink hover:bg-background"
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
          <Link to="/app" aria-label="Cadova, aujourd’hui" onClick={close}>
            <CadovaLogo variant="full" className="h-7" />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-haspopup="dialog"
          aria-keyshortcuts="Control+K Meta+K"
          className="mt-6 hidden w-full items-center gap-2 rounded-lg border border-line px-3 py-2.5 text-sm text-ink-soft transition-colors hover:bg-background md:flex"
        >
          <Search size={17} aria-hidden="true" />
          Client ou devis
          <kbd
            aria-hidden="true"
            className="ml-auto whitespace-nowrap rounded border border-line bg-background px-1 text-xs text-muted"
          >
            Ctrl/⌘ K
          </kbd>
        </button>

        <LinkButton
          variant="secondary"
          to="/app/quotes/new"
          onClick={close}
          className="mt-5 w-full"
        >
          <Plus size={17} aria-hidden="true" /> Ajouter un devis
        </LinkButton>

        <nav
          aria-label="Navigation de votre espace"
          className="mt-5 flex min-h-0 flex-1 flex-col gap-1"
        >
          <div className="hidden space-y-1 md:block">
            {primaryNavigation.map((item) => (
              <NavItem key={item.to} {...item} onNavigate={close} />
            ))}
          </div>
          <p className="px-3 py-2 text-sm font-semibold text-ink md:hidden">
            Votre espace
          </p>
          <Link
            to="/notifications"
            onClick={close}
            className="rounded-lg px-3 py-3 text-sm font-medium text-ink-soft hover:bg-background md:hidden"
          >
            Toutes les notifications
          </Link>

          <div className="mt-auto pt-4">
            {isAdmin && (
              <NavItem
                to="/admin"
                label="Administration"
                icon={ShieldCheck}
                onNavigate={close}
              />
            )}
            {bottom.map((item) => (
              <NavItem
                key={item.to}
                {...item}
                label={
                  isAdmin && item.to.includes("view=messages")
                    ? "Messages des utilisateurs"
                    : item.label
                }
                onNavigate={close}
              />
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
        className="min-w-0 flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-22 sm:px-5 md:px-8 md:pb-16 md:pt-9 lg:px-10"
      >
        <div className="mx-auto w-full max-w-[1120px]">
          {isAdmin && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary-soft px-4 py-3 text-sm">
              <p className="text-ink">Vous gérez l’entreprise {company?.name}.</p>
              <Link to="/admin" className="font-medium text-primary underline">
                Changer d’entreprise
              </Link>
            </div>
          )}
          {children ?? <Outlet key={`${user?.id}:${company?.id}`} />}
        </div>
      </main>
      <nav
        aria-label="Navigation principale mobile"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-line bg-surface px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:hidden"
      >
        {primaryNavigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={close}
            className={({ isActive }) =>
              cx(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary-soft text-primary"
                  : "text-ink-soft hover:bg-background",
              )
            }
          >
            <Icon size={20} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
      {searchOpen && company && (
        <SearchDialog
          key={`${user?.id}:${company.id}`}
          companyId={company.id}
          companyName={company.name}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  )
}
