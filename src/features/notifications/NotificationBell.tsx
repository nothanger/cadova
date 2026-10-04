import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Link } from "react-router-dom"
import {
  Bell,
  X,
  CheckCheck,
  FileText,
  MessageSquare,
  Megaphone,
  ArrowRight,
} from "lucide-react"
import { useAuth } from "@/features/auth/AuthContext"
import { useNotifications } from "./NotificationsContext"
import { notificationAPIError } from "./api"
import type { Notification } from "./types"

function destination(item: Notification) {
  if (item.support_thread_id)
    return `/notifications?view=messages&thread=${encodeURIComponent(item.support_thread_id)}`
  if (item.related_quote_id) return `/app/quotes/${item.related_quote_id}`
  return `/notifications?notification=${encodeURIComponent(item.id)}`
}

export function NotificationBell() {
  const { user } = useAuth()
  const {
    unread: items,
    unreadCount: count,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications()
  const [open, setOpen] = useState(false)
  const [actionError, setActionError] = useState("")
  const [busy, setBusy] = useState(false)
  const [coords, setCoords] = useState<{
    left: number
    maxHeight: number
    top?: number
    bottom?: number
  }>({ left: 16, top: 72, maxHeight: 400 })
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const action = useRef(false)
  const operation = useRef(0)
  const identity = useRef(user?.id)
  identity.current = user?.id
  const mounted = useRef(true)
  const panelId = useId()

  useEffect(() => {
    mounted.current = true
    setOpen(false)
    setActionError("")
    setBusy(false)
    action.current = false
    operation.current++
    return () => {
      mounted.current = false
    }
  }, [user?.id])

  useEffect(() => {
    if (!open) return
    function outside(event: MouseEvent) {
      const target = event.target as Node
      if (!ref.current?.contains(target) && !panelRef.current?.contains(target))
        setOpen(false)
    }
    panelRef.current?.focus()
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    const resize = () => setOpen(false)
    document.addEventListener("mousedown", outside)
    window.addEventListener("keydown", keydown)
    window.addEventListener("resize", resize)
    return () => {
      document.removeEventListener("mousedown", outside)
      window.removeEventListener("keydown", keydown)
      window.removeEventListener("resize", resize)
    }
  }, [open])

  function toggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const width = Math.min(320, window.innerWidth - 32)
      const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16))
      const below = window.innerHeight - rect.bottom - 24
      const above = rect.top - 24
      setCoords(
        below >= above
          ? { left, top: rect.bottom + 8, maxHeight: Math.max(150, below) }
          : {
              left,
              bottom: window.innerHeight - rect.top + 8,
              maxHeight: Math.max(150, above),
            },
      )
      void refresh()
    }
    setOpen((value) => !value)
  }

  async function read(id?: string) {
    if (action.current) return
    const ticket = ++operation.current
    const actor = user?.id
    action.current = true
    setBusy(true)
    setActionError("")
    try {
      if (id) await markRead(id)
      else await markAllRead()
    } catch (err) {
      if (mounted.current && ticket === operation.current && actor === identity.current)
        setActionError(
          notificationAPIError(
            err,
            "Impossible de marquer ces notifications comme lues.",
          ),
        )
    } finally {
      if (ticket === operation.current && actor === identity.current) {
        action.current = false
        if (mounted.current) setBusy(false)
      }
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Notifications${count > 0 ? ` (${count} non lues)` : ""}`}
        className="relative flex h-11 w-11 items-center justify-center rounded-[10px] text-ink-soft transition-colors hover:bg-background hover:text-ink"
      >
        <Bell size={18} aria-hidden="true" />
        {count > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open &&
        createPortal(
          <div
            id={panelId}
            role="region"
            aria-label="Notifications"
            tabIndex={-1}
            ref={panelRef}
            style={coords}
            className="fixed z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[var(--radius-cadova)] border border-line bg-surface shadow-lg"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2">
              <span className="text-sm font-semibold text-ink">Notifications</span>
              <div className="flex items-center gap-1">
                {count > 0 && (
                  <button
                    aria-label="Tout marquer comme lu"
                    onClick={() => void read()}
                    disabled={busy}
                    className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs text-muted hover:bg-background hover:text-ink disabled:opacity-50"
                  >
                    <CheckCheck size={14} aria-hidden="true" /> Tout lire
                  </button>
                )}
                <button
                  aria-label="Fermer les notifications"
                  onClick={() => {
                    setOpen(false)
                    buttonRef.current?.focus()
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-background hover:text-ink"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
            {(actionError || error) && (
              <p
                role="alert"
                className="shrink-0 border-b border-line bg-danger-soft px-4 py-3 text-xs leading-5 text-danger"
              >
                {actionError || error}
              </p>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading && items.length === 0 ? (
                <p role="status" className="px-4 py-6 text-center text-sm text-muted">
                  Chargement…
                </p>
              ) : items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">
                  Aucune nouvelle notification.
                </p>
              ) : (
                items.map((item) => {
                  const Icon = item.support_thread_id
                    ? MessageSquare
                    : item.type === "admin_announcement"
                      ? Megaphone
                      : FileText
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 border-b border-line px-4 py-4 last:border-0 hover:bg-background"
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <Icon size={16} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          to={destination(item)}
                          onClick={() => {
                            void read(item.id)
                            setOpen(false)
                          }}
                          className="break-words text-sm font-medium text-ink hover:text-primary"
                        >
                          {item.title}
                        </Link>
                        <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-muted">
                          {item.message}
                        </p>
                      </div>
                      <button
                        onClick={() => void read(item.id)}
                        disabled={busy}
                        aria-label={`Marquer comme lue : ${item.title}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-line hover:text-ink disabled:opacity-50"
                      >
                        <CheckCheck size={16} aria-hidden="true" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm font-medium text-primary hover:bg-primary-soft"
            >
              Voir toutes les notifications <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>,
          document.body,
        )}
    </div>
  )
}
