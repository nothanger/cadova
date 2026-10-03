import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Link } from "react-router-dom"
import { Bell, X, CheckCheck, FileText } from "lucide-react"
import { useAuth } from "@/features/auth/AuthContext"
import {
  listUnreadNotifications,
  markAllRead,
  markOneRead,
  type Notification,
} from "./api"

export function NotificationBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [coords, setCoords] = useState<{ left: number; top?: number; bottom?: number }>(
    { left: 16, top: 72 },
  )
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      setItems(await listUnreadNotifications(user.id))
    } catch {
      // Silent — bell is non-critical
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [load])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node
      if (ref.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    const resize = () => setOpen(false)
    window.addEventListener("keydown", close)
    window.addEventListener("resize", resize)
    return () => {
      window.removeEventListener("keydown", close)
      window.removeEventListener("resize", resize)
    }
  }, [open])

  async function handleMarkAll() {
    if (!user) return
    await markAllRead(user.id)
    setItems([])
  }

  async function handleMarkOne(id: string) {
    await markOneRead(id)
    setItems((prev) => prev.filter((n) => n.id !== id))
  }

  const count = items.length

  // Anchor the panel with fixed positioning so it escapes the sidebar's
  // overflow (which would otherwise clip it). We open it above the bell.
  function toggle() {
    if (!open && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect()
      const width = Math.min(320, window.innerWidth - 32)
      const left = Math.max(16, Math.min(r.left, window.innerWidth - width - 16))
      setCoords(
        r.top < window.innerHeight / 2
          ? { left, top: r.bottom + 8 }
          : { left, bottom: window.innerHeight - r.top + 8 },
      )
    }
    setOpen((v) => !v)
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? "notification-panel" : undefined}
        aria-label={`Notifications${count > 0 ? ` (${count} non lues)` : ""}`}
        className="relative flex h-11 w-11 items-center justify-center rounded-[10px] text-ink-soft transition-colors hover:bg-background hover:text-ink"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            id="notification-panel"
            role="region"
            aria-label="Notifications"
            tabIndex={-1}
            ref={panelRef}
            style={coords}
            className="fixed z-50 max-w-[calc(100vw-2rem)] w-80 rounded-[var(--radius-cadova)] border border-line bg-surface shadow-lg"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-semibold text-ink">Notifications</span>
              <div className="flex items-center gap-1">
                {count > 0 && (
                  <button
                    aria-label="Tout marquer comme lu"
                    onClick={handleMarkAll}
                    title="Tout marquer comme lu"
                    className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-muted hover:bg-background hover:text-ink"
                  >
                    <CheckCheck size={14} />
                    Tout lire
                  </button>
                )}
                <button
                  aria-label="Fermer les notifications"
                  onClick={() => {
                    setOpen(false)
                    buttonRef.current?.focus()
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-background hover:text-ink"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto">
              {loading && items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">Chargement…</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">
                  Aucune nouvelle notification.
                </p>
              ) : (
                items.map((n) => (
                  <NotifItem key={n.id} item={n} onRead={handleMarkOne} />
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

function NotifItem({
  item,
  onRead,
}: {
  item: Notification
  onRead: (id: string) => void
}) {
  return (
    <div className="flex items-start gap-3 border-b border-line px-4 py-4 last:border-0 hover:bg-background">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning">
        <FileText size={16} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        {item.related_quote_id ? (
          <Link
            to={`/app/quotes/${item.related_quote_id}`}
            onClick={() => onRead(item.id)}
            className="text-sm font-medium text-ink hover:text-primary"
          >
            {item.title}
          </Link>
        ) : (
          <p className="text-sm font-medium text-ink">{item.title}</p>
        )}
        <p className="mt-1 text-xs leading-5 text-muted">{item.message}</p>
      </div>
      <button
        onClick={() => onRead(item.id)}
        aria-label={`Marquer comme lue : ${item.title}`}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-line hover:text-ink"
      >
        <CheckCheck size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
