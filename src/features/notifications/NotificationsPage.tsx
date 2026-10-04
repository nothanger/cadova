import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Send,
  X,
} from "lucide-react"
import { CadovaLogo } from "@/components/CadovaLogo"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Spinner,
  Textarea,
  cx,
} from "@/components/ui"
import { Dialog } from "@/components/ui/Dialog"
import { useAuth } from "@/features/auth/AuthContext"
import { useAdmin } from "@/features/admin/AdminContext"
import { AdminNotificationComposer } from "@/features/admin/AdminNotificationComposer"
import { useNotifications } from "./NotificationsContext"
import { NotificationBell } from "./NotificationBell"
import {
  getNotification,
  listNotificationHistory,
  listSupportMessages,
  listSupportThreads,
  markSupportThreadRead,
  notificationAPIError,
  sendSupportMessage,
} from "./api"
import type { Notification, SupportThread } from "./types"

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})
function displayDate(value: string) {
  return Number.isNaN(Date.parse(value))
    ? "Date indisponible"
    : dateTime.format(new Date(value))
}
function preview(text: string, max = 200) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

function usePagedResource<T>(
  loader: (page: number) => Promise<{ items: T[]; hasMore: boolean }>,
  poll = false,
) {
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<{
    items: T[]
    hasMore: boolean
    page: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const request = useRef(0)
  const load = useCallback(async () => {
    const ticket = ++request.current
    setLoading(true)
    setError("")
    try {
      const data = await loader(page)
      if (ticket === request.current) setResult({ ...data, page })
    } catch (err) {
      if (ticket === request.current)
        setError(notificationAPIError(err, "Impossible de charger ces informations."))
    } finally {
      if (ticket === request.current) setLoading(false)
    }
  }, [loader, page])
  useEffect(() => {
    void load()
    const focus = () => {
      if (!document.hidden) void load()
    }
    const timer = poll ? window.setInterval(focus, 30_000) : undefined
    if (poll) window.addEventListener("focus", focus)
    return () => {
      request.current++
      if (timer) window.clearInterval(timer)
      window.removeEventListener("focus", focus)
    }
  }, [load, poll])
  return {
    page,
    setPage,
    items: result?.page === page ? result.items : [],
    hasMore: result?.page === page && result.hasMore,
    initialLoading: loading && result?.page !== page,
    loading,
    error,
    refresh: load,
  }
}

function Pages({
  page,
  hasMore,
  busy,
  label,
  onPage,
}: {
  page: number
  hasMore: boolean
  busy: boolean
  label: string
  onPage: (page: number) => void
}) {
  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3"
    >
      <p className="text-sm text-muted">Page {page + 1}</p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          aria-label="Page précédente"
          disabled={page === 0 || busy}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Précédente</span>
        </Button>
        <Button
          variant="secondary"
          aria-label="Page suivante"
          disabled={!hasMore || busy}
          onClick={() => onPage(page + 1)}
        >
          <span className="hidden sm:inline">Suivante</span>
          <ChevronRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}

function NotificationDetail({
  id,
  onClose,
  onRead,
}: {
  id: string
  onClose: () => void
  onRead: () => void
}) {
  const [item, setItem] = useState<Notification | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { markRead } = useNotifications()
  const active = useRef(true)
  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const notification = await getNotification(id)
      if (active.current) setItem(notification)
    } catch (err) {
      if (active.current)
        setError(notificationAPIError(err, "Cette notification n’est pas accessible."))
    } finally {
      if (active.current) setLoading(false)
    }
  }, [id])
  useEffect(() => {
    active.current = true
    void load()
    return () => {
      active.current = false
    }
  }, [load])
  async function read() {
    if (!item || saving) return
    setSaving(true)
    try {
      await markRead(item.id)
      if (active.current) {
        setItem({ ...item, read_at: new Date().toISOString() })
        onRead()
      }
    } catch (err) {
      if (active.current)
        setError(
          notificationAPIError(
            err,
            "Impossible de marquer cette notification comme lue.",
          ),
        )
    } finally {
      if (active.current) setSaving(false)
    }
  }
  return (
    <Dialog titleId="notification-detail-title" onClose={onClose}>
      <div className="flex items-start justify-between gap-4">
        <h2
          id="notification-detail-title"
          className="break-words text-xl font-semibold text-ink"
        >
          {item?.title ?? "Notification"}
        </h2>
        <Button variant="ghost" onClick={onClose} aria-label="Fermer le message">
          <X size={18} aria-hidden="true" />
        </Button>
      </div>
      {loading ? (
        <Spinner />
      ) : item ? (
        <>
          <p className="mt-3 text-xs text-muted">{displayDate(item.created_at)}</p>
          <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-ink-soft">
            {item.message}
          </p>
          {!item.read_at && (
            <Button
              className="mt-6"
              variant="secondary"
              onClick={() => void read()}
              loading={saving}
            >
              <CheckCheck size={16} aria-hidden="true" /> Marquer comme lue
            </Button>
          )}
        </>
      ) : null}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
    </Dialog>
  )
}

function NotificationHistory() {
  const history = usePagedResource(listNotificationHistory, true)
  const { unreadCount, refresh, markRead, markAllRead } = useNotifications()
  const [params, setParams] = useSearchParams()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const locked = useRef(false)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  async function read(id?: string) {
    if (locked.current) return
    locked.current = true
    setSaving(true)
    setError("")
    try {
      if (id) await markRead(id)
      else await markAllRead()
      if (active.current) await history.refresh()
    } catch (err) {
      if (active.current)
        setError(
          notificationAPIError(
            err,
            "Impossible de marquer ces notifications comme lues.",
          ),
        )
    } finally {
      locked.current = false
      if (active.current) setSaving(false)
    }
  }
  function closeDetail() {
    const next = new URLSearchParams(params)
    next.delete("notification")
    setParams(next, { replace: true })
  }
  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Votre historique</h2>
          <p className="mt-1 text-sm text-muted">
            Les notifications restent disponibles après leur lecture.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              void refresh()
              void history.refresh()
            }}
            loading={history.loading}
          >
            <RefreshCw size={16} aria-hidden="true" /> Actualiser
          </Button>
          <Button
            variant="secondary"
            disabled={unreadCount === 0}
            loading={saving}
            onClick={() => void read()}
          >
            <CheckCheck size={16} aria-hidden="true" /> Tout marquer comme lu
          </Button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-danger-soft p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {history.initialLoading ? (
        <Spinner />
      ) : history.error ? (
        <ErrorState message={history.error} onRetry={history.refresh} />
      ) : (
        <Card className="overflow-hidden">
          {history.items.length === 0 ? (
            <EmptyState
              title="Aucune notification"
              description="Les nouvelles de votre compte et de vos échanges apparaîtront ici."
            />
          ) : (
            <ul className="divide-y divide-line">
              {history.items.map((item) => {
                const Icon = item.support_thread_id
                  ? MessageSquare
                  : item.type === "admin_announcement"
                    ? Megaphone
                    : FileText
                const target = item.support_thread_id
                  ? `/notifications?view=messages&thread=${encodeURIComponent(item.support_thread_id)}`
                  : item.related_quote_id
                    ? `/app/quotes/${item.related_quote_id}`
                    : `/notifications?notification=${encodeURIComponent(item.id)}`
                return (
                  <li
                    key={item.id}
                    className={cx(
                      "flex items-start gap-3 p-4 sm:gap-4 sm:p-6",
                      !item.read_at && "bg-primary-soft/40",
                    )}
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-sm font-semibold text-ink">
                          {item.title}
                        </h3>
                        {!item.read_at && (
                          <span className="rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                            Nouvelle
                          </span>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">
                        {preview(item.message)}
                      </p>
                      <p className="mt-2 text-xs text-muted">
                        {displayDate(item.created_at)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Link
                          to={target}
                          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
                        >
                          {item.support_thread_id
                            ? "Voir la conversation"
                            : item.related_quote_id
                              ? "Voir le devis"
                              : "Lire le message"}
                        </Link>
                        {!item.read_at && (
                          <Button
                            variant="ghost"
                            disabled={saving}
                            aria-label={`Marquer comme lue : ${item.title}`}
                            onClick={() => void read(item.id)}
                          >
                            <CheckCheck size={16} aria-hidden="true" /> Marquer comme
                            lue
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <Pages
            page={history.page}
            hasMore={history.hasMore}
            busy={history.loading}
            label="Pagination des notifications"
            onPage={history.setPage}
          />
        </Card>
      )}
      {params.get("notification") && (
        <NotificationDetail
          key={params.get("notification")}
          id={params.get("notification")!}
          onClose={closeDetail}
          onRead={() => void history.refresh()}
        />
      )}
    </>
  )
}

function Conversation({
  threadId,
  isAdmin,
  email,
  onSent,
  onViewed,
}: {
  threadId: string | null
  isAdmin: boolean
  email?: string
  onSent: (thread: string) => void
  onViewed: () => Promise<void>
}) {
  const { user } = useAuth()
  const loader = useCallback(
    (page: number) =>
      threadId
        ? listSupportMessages(threadId, page)
        : Promise.resolve({ items: [], hasMore: false }),
    [threadId],
  )
  const history = usePagedResource(loader, true)
  const { refresh } = useNotifications()
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const pending = useRef<{
    body: string
    threadId: string | null
    requestId: string
  } | null>(null)
  const locked = useRef(false)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const latestReceived =
    history.page === 0
      ? history.items.find(
          (message) => message.sender_role !== (isAdmin ? "admin" : "user"),
        )?.id
      : undefined
  useEffect(() => {
    if (!threadId || history.page !== 0 || history.error || history.initialLoading)
      return
    let current = true
    markSupportThreadRead(threadId)
      .then(() => {
        if (current) {
          void refresh()
          void onViewed()
        }
      })
      .catch((err) => {
        if (current)
          setError(
            notificationAPIError(
              err,
              "Impossible d’actualiser la lecture de cette conversation.",
            ),
          )
      })
    return () => {
      current = false
    }
  }, [
    threadId,
    latestReceived,
    history.page,
    history.error,
    history.initialLoading,
    refresh,
    onViewed,
  ])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || trimmed.length > 4000 || locked.current || (isAdmin && !threadId))
      return
    locked.current = true
    setSaving(true)
    setError("")
    setNotice("")
    if (
      !pending.current ||
      pending.current.body !== trimmed ||
      pending.current.threadId !== threadId
    )
      pending.current = { body: trimmed, threadId, requestId: crypto.randomUUID() }
    try {
      const nextThread = await sendSupportMessage(
        trimmed,
        threadId,
        pending.current.requestId,
      )
      if (!active.current) return
      pending.current = null
      setBody("")
      setNotice("Votre message a été envoyé.")
      onSent(nextThread)
      if (nextThread === threadId) {
        if (history.page === 0) await history.refresh()
        else history.setPage(0)
      }
      await refresh()
    } catch (err) {
      if (active.current)
        setError(
          notificationAPIError(
            err,
            "Votre message n’a pas pu être envoyé. Vous pouvez réessayer.",
          ),
        )
    } finally {
      locked.current = false
      if (active.current) setSaving(false)
    }
  }
  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="border-b border-line p-4 sm:p-6">
        <h2 className="break-all text-lg font-semibold text-ink">
          {isAdmin ? (email ?? "Conversation") : "Contacter Cadova"}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          {isAdmin
            ? "Vos réponses sont visibles dans l’espace de ce compte."
            : "Posez une question ou signalez un problème. Vos échanges sont conservés ici."}
        </p>
      </div>
      {history.initialLoading ? (
        <Spinner />
      ) : history.error ? (
        <ErrorState message={history.error} onRetry={history.refresh} />
      ) : (
        <>
          {history.items.length === 0 ? (
            <p className="p-5 text-sm leading-6 text-muted">
              Envoyez votre premier message pour commencer la conversation.
            </p>
          ) : (
            <ol
              aria-label="Historique de la conversation"
              className="space-y-4 p-4 sm:p-6"
            >
              {[...history.items].reverse().map((message) => {
                const own = message.sender_id === user?.id
                return (
                  <li
                    key={message.id}
                    className={cx(
                      "max-w-[94%] rounded-lg border p-3 sm:max-w-[85%] sm:p-4",
                      own
                        ? "ml-auto border-primary/20 bg-primary-soft"
                        : "border-line bg-background",
                    )}
                  >
                    <p className="text-xs font-semibold text-ink">
                      {own
                        ? "Vous"
                        : message.sender_role === "admin"
                          ? "Cadova"
                          : (email ?? "Utilisateur")}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">
                      {message.body}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      <time dateTime={message.created_at}>
                        {displayDate(message.created_at)}
                      </time>
                    </p>
                  </li>
                )
              })}
            </ol>
          )}
          {(history.page > 0 || history.hasMore) && (
            <nav
              aria-label="Pagination des messages"
              className="flex flex-wrap items-center justify-between gap-2 border-t border-line p-4"
            >
              <Button
                variant="secondary"
                disabled={!history.hasMore || history.loading}
                onClick={() => history.setPage(history.page + 1)}
              >
                <ChevronLeft size={16} aria-hidden="true" /> Messages précédents
              </Button>
              <Button
                variant="secondary"
                disabled={history.page === 0 || history.loading}
                onClick={() => history.setPage(history.page - 1)}
              >
                Messages suivants <ChevronRight size={16} aria-hidden="true" />
              </Button>
            </nav>
          )}
        </>
      )}
      <form onSubmit={submit} className="border-t border-line p-4 sm:p-6">
        <Field
          htmlFor="support-message"
          label={isAdmin ? "Votre réponse" : "Votre message"}
          required
          hint="4 000 caractères maximum."
        >
          <Textarea
            id="support-message"
            rows={4}
            maxLength={4000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            disabled={saving}
            required
            placeholder={
              isAdmin ? "Écrivez votre réponse…" : "Comment pouvons-nous vous aider ?"
            }
          />
        </Field>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted" aria-live="off">
            {body.length.toLocaleString("fr-FR")} / 4 000
          </p>
          <Button
            type="submit"
            loading={saving}
            disabled={!body.trim() || (isAdmin && !threadId)}
          >
            <Send size={16} aria-hidden="true" />{" "}
            {isAdmin ? "Envoyer la réponse" : "Envoyer le message"}
          </Button>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger"
          >
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-4 text-sm text-success">
            {notice}
          </p>
        )}
      </form>
    </Card>
  )
}

function Messages({ isAdmin }: { isAdmin: boolean }) {
  const threads = usePagedResource(listSupportThreads, true)
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState("")
  const [createdThread, setCreatedThread] = useState<string | null>(null)
  const requestedThread = params.get("thread")
  const ownThread = createdThread ?? threads.items[0]?.id ?? null
  const selectedId = isAdmin ? requestedThread : ownThread
  const selected = threads.items.find((thread) => thread.id === selectedId)
  const visible = threads.items.filter((thread) =>
    (thread.user_email ?? "")
      .toLocaleLowerCase("fr")
      .includes(filter.trim().toLocaleLowerCase("fr")),
  )
  function select(id: string) {
    const next = new URLSearchParams(params)
    next.set("view", "messages")
    next.set("thread", id)
    setParams(next)
  }
  const inaccessible = !isAdmin && requestedThread && requestedThread !== ownThread
  function sent(id: string) {
    if (!isAdmin && id !== selectedId) {
      setCreatedThread(id)
      select(id)
    }
    void threads.refresh()
  }
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">
            {isAdmin ? "Messages reçus" : "Votre conversation"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            {isAdmin
              ? "Consultez les demandes des comptes Cadova et répondez directement."
              : "Un échange direct avec l’équipe Cadova."}
          </p>
        </div>
        <Button variant="secondary" loading={threads.loading} onClick={threads.refresh}>
          <RefreshCw size={16} aria-hidden="true" /> Actualiser
        </Button>
      </div>
      {threads.initialLoading ? (
        <Spinner />
      ) : threads.error ? (
        <ErrorState message={threads.error} onRetry={threads.refresh} />
      ) : inaccessible ? (
        <ErrorState message="Cette conversation n’est pas accessible avec votre compte." />
      ) : (
        <div
          className={cx("grid gap-5", isAdmin && "lg:grid-cols-[320px_minmax(0,1fr)]")}
        >
          {isAdmin && (
            <Card
              className={cx("h-fit overflow-hidden", selectedId && "hidden lg:block")}
            >
              <div className="border-b border-line p-4">
                <Field
                  htmlFor="thread-search"
                  label="Filtrer les conversations de cette page"
                >
                  <Input
                    id="thread-search"
                    type="search"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    placeholder="Rechercher une adresse email"
                  />
                </Field>
              </div>
              {visible.length === 0 ? (
                <p className="p-5 text-sm text-muted">
                  Aucune conversation sur cette page.
                </p>
              ) : (
                <ul className="max-h-[32rem] divide-y divide-line overflow-y-auto">
                  {visible.map((thread: SupportThread) => (
                    <li key={thread.id}>
                      <button
                        aria-label={`Ouvrir la conversation avec ${thread.user_email ?? "ce compte"}`}
                        aria-pressed={thread.id === selectedId}
                        onClick={() => select(thread.id)}
                        className={cx(
                          "flex w-full flex-col gap-2 p-4 text-left hover:bg-background",
                          thread.id === selectedId && "bg-primary-soft",
                        )}
                      >
                        <span className="flex w-full items-start justify-between gap-2">
                          <span className="min-w-0 break-all text-sm font-medium text-ink">
                            {thread.user_email ?? "Compte supprimé"}
                          </span>
                          {thread.unread_count > 0 && (
                            <span className="shrink-0 rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-white">
                              {thread.unread_count}{" "}
                              <span className="sr-only">messages non lus</span>
                            </span>
                          )}
                        </span>
                        <span className="line-clamp-2 break-words text-sm leading-5 text-muted">
                          {preview(thread.last_body ?? "", 120)}
                        </span>
                        <span className="text-xs text-muted">
                          {displayDate(thread.updated_at)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Pages
                page={threads.page}
                hasMore={threads.hasMore}
                busy={threads.loading}
                label="Pagination des conversations"
                onPage={(page) => {
                  threads.setPage(page)
                  setFilter("")
                }}
              />
            </Card>
          )}
          {isAdmin && !selectedId ? (
            <EmptyState
              title="Choisissez une conversation"
              description="Ouvrez un échange pour consulter son historique et répondre au compte."
            />
          ) : (
            <div className="min-w-0">
              {isAdmin && selectedId && (
                <Button
                  variant="secondary"
                  className="mb-4 lg:hidden"
                  onClick={() => {
                    const next = new URLSearchParams(params)
                    next.delete("thread")
                    setParams(next)
                  }}
                >
                  <ArrowLeft size={16} aria-hidden="true" /> Retour aux conversations
                </Button>
              )}
              <Conversation
                key={selectedId ?? "new"}
                threadId={selectedId}
                isAdmin={isAdmin}
                email={selected?.user_email ?? undefined}
                onSent={sent}
                onViewed={threads.refresh}
              />
            </div>
          )}
        </div>
      )}
    </>
  )
}

function NotificationsContent({ isAdmin }: { isAdmin: boolean }) {
  const [params, setParams] = useSearchParams()
  const view = params.get("view") === "messages" ? "messages" : "notifications"
  const { refresh } = useNotifications()
  const [revision, setRevision] = useState(0)
  function changeView(nextView: string) {
    const next = new URLSearchParams(params)
    next.set("view", nextView)
    next.delete("notification")
    setParams(next)
  }
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            to={isAdmin ? "/admin" : "/app"}
            aria-label="Cadova, retour à mon espace"
          >
            <CadovaLogo className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link
              to={isAdmin ? "/admin" : "/app"}
              className="ui-button border border-line bg-surface text-ink hover:bg-background"
            >
              <ArrowLeft size={16} aria-hidden="true" />{" "}
              {isAdmin ? "Administration" : "Mon espace"}
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
        <PageHeader
          title="Notifications et messages"
          subtitle="Les nouvelles de votre compte et vos échanges avec Cadova."
        />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={view === "notifications" ? "primary" : "secondary"}
              aria-pressed={view === "notifications"}
              onClick={() => changeView("notifications")}
            >
              <Bell size={16} aria-hidden="true" /> Notifications
            </Button>
            <Button
              variant={view === "messages" ? "primary" : "secondary"}
              aria-pressed={view === "messages"}
              onClick={() => changeView("messages")}
            >
              <MessageSquare size={16} aria-hidden="true" /> Messages
            </Button>
          </div>
          {isAdmin && (
            <AdminNotificationComposer
              onSent={() => {
                void refresh()
                setRevision((current) => current + 1)
              }}
            />
          )}
        </div>
        {view === "notifications" ? (
          <NotificationHistory key={revision} />
        ) : (
          <Messages isAdmin={isAdmin} />
        )}
      </main>
    </div>
  )
}

export function NotificationsPage() {
  const { user, loading } = useAuth()
  const { isAdmin, loading: adminLoading, error, refresh } = useAdmin()
  if (loading || adminLoading) return <Spinner />
  if (error) return <ErrorState message={error} onRetry={refresh} />
  if (!user)
    return (
      <ErrorState message="Connectez-vous pour consulter vos notifications et messages." />
    )
  return <NotificationsContent key={`${user.id}:${isAdmin}`} isAdmin={isAdmin} />
}
