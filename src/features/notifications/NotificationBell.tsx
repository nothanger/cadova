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
  const [coords, setCoords] = useState<{ left: number; bottom: number }>({
    left: 0,
    bottom: 0,
  })
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
      if (ref.current?.contains(target) || panelRef.current?.contains(target))
        return
      setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
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
      setCoords({ left: r.left, bottom: window.innerHeight - r.top + 8 })
    }
    setOpen((v) => !v)
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-label={`Notifications${count > 0 ? ` (${count} non lues)` : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-[10px] text-ink-soft transition-colors hover:bg-background hover:text-ink"
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
            ref={panelRef}
            style={{ left: coords.left, bottom: coords.bottom }}
            className="fixed z-50 max-w-[calc(100vw-2rem)] w-80 rounded-[var(--radius-cadova)] border border-line bg-surface shadow-lg"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-semibold text-ink">
                Notifications
              </span>
              <div className="flex items-center gap-1">
                {count > 0 && (
                  <button
                    onClick={handleMarkAll}
                    title="Tout marquer comme lu"
                    className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-muted hover:bg-background hover:text-ink"
                  >
                    <CheckCheck size={14} />
                    Tout lire
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-background hover:text-ink"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto">
              {loading && items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">
                  Chargement…
                </p>
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
  const content = (
    <div className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-background">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning">
        <FileText size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink leading-tight">
          {item.title}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          {item.message}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.preventDefault()
          onRead(item.id)
        }}
        title="Marquer comme lu"
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted hover:bg-line hover:text-ink"
      >
        <X size={12} />
      </button>
    </div>
  )

  if (item.related_quote_id) {
    return (
      <Link
        to={`/app/quotes/${item.related_quote_id}`}
        onClick={() => onRead(item.id)}
      >
        {content}
      </Link>
    )
  }
  return <div>{content}</div>
}
