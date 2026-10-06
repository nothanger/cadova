import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { CalendarClock, FileText, Mail, MessageSquare, RefreshCw } from "lucide-react"
import { Button, Card, Spinner } from "@/components/ui"
import { useAuth } from "@/features/auth/AuthContext"
import { todayISO } from "@/lib/dates"
import type { QuoteWithClient } from "@/types"
import {
  loadQuoteTimeline,
  loadTimelineAutomation,
  type TimelineAutomation,
} from "./api"
import {
  appendTimelineSources,
  emptyTimelineSources,
  formatTimelineDate,
  mergeQuoteTimeline,
  type TimelineFilter,
  type TimelineItem,
} from "./merge"

const filters: { value: TimelineFilter; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "messages", label: "Messages" },
  { value: "sending", label: "Envois" },
  { value: "tracking", label: "Suivi" },
]
const icons = { messages: MessageSquare, sending: Mail, tracking: FileText }

export function QuoteTimeline({
  quote,
  revision = 0,
  children,
}: {
  quote: QuoteWithClient
  revision?: number
  children?: ReactNode
}) {
  const { user } = useAuth()
  const [sources, setSources] = useState(emptyTimelineSources)
  const [unavailable, setUnavailable] = useState<string[]>([])
  const [plannedState, setPlannedState] = useState<TimelineAutomation | null>(null)
  const [automationUnavailable, setAutomationUnavailable] = useState(false)
  const [filter, setFilter] = useState<TimelineFilter>("all")
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [loadedScope, setLoadedScope] = useState("")
  const [visibleCount, setVisibleCount] = useState(25)
  const [retryPage, setRetryPage] = useState<number | null>(null)
  const scope = `${user?.id}:${quote.company_id}:${quote.id}`
  const identity = useRef(scope)
  identity.current = scope
  const requests = useRef(0)
  const active = useRef(true)
  const locked = useRef(false)

  const load = useCallback(
    async (nextPage = 0) => {
      if (locked.current && nextPage) return
      locked.current = true
      const ticket = ++requests.current
      const currentScope = `${user?.id}:${quote.company_id}:${quote.id}`
      setLoading(true)
      if (!nextPage) {
        setLoaded(false)
        setLoadedScope("")
        setSources(emptyTimelineSources())
        setPlannedState(null)
        setUnavailable([])
        setAutomationUnavailable(false)
        setRetryPage(null)
        setPage(0)
        setVisibleCount(25)
      }
      try {
        const [history, planned] = await Promise.all([
          loadQuoteTimeline(quote, nextPage),
          nextPage
            ? Promise.resolve(null)
            : loadTimelineAutomation(quote)
                .then((value) => ({ value, available: true }))
                .catch(() => ({ value: null, available: false })),
        ])
        if (
          !active.current ||
          ticket !== requests.current ||
          identity.current !== currentScope
        )
          return
        // A failed continuation must be retried at the same page: never skip unseen rows.
        if (nextPage && history.unavailable.length) {
          setUnavailable(history.unavailable)
          setRetryPage(nextPage)
          return
        }
        setSources((previous) =>
          nextPage ? appendTimelineSources(previous, history.sources) : history.sources,
        )
        setUnavailable(history.unavailable)
        setRetryPage(null)
        setHasMore(history.hasMore)
        setPage(nextPage)
        if (nextPage) setVisibleCount((count) => count + 25)
        if (planned) {
          setPlannedState(planned.value)
          setAutomationUnavailable(!planned.available)
        }
        setLoadedScope(currentScope)
        setLoaded(true)
      } catch {
        if (
          active.current &&
          ticket === requests.current &&
          identity.current === currentScope
        ) {
          setUnavailable(["l’activité du devis"])
          if (nextPage) setRetryPage(nextPage)
        }
      } finally {
        if (
          active.current &&
          ticket === requests.current &&
          identity.current === currentScope
        ) {
          locked.current = false
          setLoading(false)
        }
      }
    },
    [quote, user?.id],
  )
  useEffect(() => {
    active.current = true
    locked.current = false
    void load()
    return () => {
      active.current = false
      requests.current++
    }
  }, [load, revision])

  const items = useMemo(() => mergeQuoteTimeline(quote, sources), [quote, sources])
  const matching =
    filter === "all" ? items : items.filter((item) => item.category === filter)
  const displayed = matching.slice(0, visibleCount)
  const current = loadedScope === scope
  const pendingSends = [
    ...sources.initialJobs.map((job) => ({ ...job, kind: "initial" as const })),
    ...sources.followupJobs.map((job) => ({ ...job, kind: "followup" as const })),
  ].filter(
    (job) =>
      job.company_id === quote.company_id &&
      job.quote_id === quote.id &&
      (job.status === "processing" ||
        (job.kind === "initial" && job.status === "queued")),
  )
  const automation = plannedState?.automation
  const automaticDate =
    quote.status === "sent" &&
    automation?.enabled &&
    !automation.paused &&
    !automation.stop_reason &&
    plannedState?.serviceReady &&
    !plannedState.companyPaused
      ? automation.next_send_at
      : null
  const reminderDate =
    !automaticDate && quote.status === "sent" && !automation?.enabled
      ? quote.next_followup_at
      : null
  function more() {
    if (retryPage !== null) {
      void load(retryPage)
      return
    }
    if (unavailable.length) {
      // Recover page zero before advancing any source that previously failed.
      void load()
      return
    }
    // Fetch every source before showing buffered older entries from another one.
    if (hasMore) void load(page + 1)
    else setVisibleCount((count) => count + 25)
  }
  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">Activité du devis</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Documents, échanges et envois dans un seul fil.
          </p>
        </div>
        <Button
          variant="ghost"
          loading={loading}
          aria-label="Actualiser l’activité du devis"
          onClick={() => void load()}
        >
          <RefreshCw size={16} aria-hidden="true" /> Actualiser
        </Button>
      </div>
      {current && pendingSends.length > 0 && (
        <div className="mt-5 space-y-3 rounded-lg bg-warning-soft p-4" role="status">
          {pendingSends.map((job) => (
            <div key={`${job.kind}:${job.id}`}>
              <p className="text-sm font-semibold text-warning">
                {job.kind === "initial" ? "Envoi du devis" : "Relance automatique"}{" "}
                {job.status === "processing" ? "en cours" : "en attente"}
              </p>
              <p className="mt-1 text-xs leading-5 text-warning">
                Le résultat n’est pas encore confirmé. Actualisez avant de préparer un
                nouvel envoi.
              </p>
            </div>
          ))}
        </div>
      )}
      {current && (automaticDate || reminderDate) && (
        <div className="mt-5 flex gap-3 rounded-lg border border-line bg-background p-4">
          <CalendarClock
            size={19}
            className="mt-0.5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {automaticDate
                ? Date.parse(automaticDate) <= Date.now()
                  ? "En attente d’envoi"
                  : "À venir"
                : reminderDate! < todayISO()
                  ? "Rappel à traiter"
                  : "À venir"}
            </p>
            <p className="mt-1 text-sm font-medium">
              {automaticDate ? "Prochaine relance automatique" : "Rappel de relance"} :{" "}
              {formatTimelineDate((automaticDate || reminderDate)!)}{" "}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {automaticDate
                ? "Envoi prévu si le devis reste sans réponse et si les relances restent actives."
                : "Ce rappel n’envoie aucun email."}
            </p>
          </div>
        </div>
      )}
      {current && automation?.enabled && automation.paused && (
        <p className="mt-4 text-sm leading-6 text-muted">
          Les relances automatiques de ce devis sont en pause.
        </p>
      )}
      {current &&
        automation?.enabled &&
        !automation.paused &&
        plannedState?.companyPaused && (
          <p className="mt-4 text-sm leading-6 text-muted">
            Les relances automatiques sont en pause pour votre entreprise.
          </p>
        )}
      {current &&
        automation?.enabled &&
        !plannedState?.serviceReady &&
        !automationUnavailable && (
          <p className="mt-4 text-sm leading-6 text-muted">
            Le service d’envoi automatique est indisponible. Aucun prochain envoi n’est
            confirmé.
          </p>
        )}
      {(unavailable.length > 0 || automationUnavailable) && (
        <div
          role="status"
          className="mt-4 rounded-lg bg-warning-soft p-3 text-sm leading-6 text-warning"
        >
          {unavailable.length
            ? `Activité partielle : ${unavailable.join(", ")} ne peuvent pas être chargés.`
            : "La prochaine relance automatique n’a pas pu être vérifiée."}
          {unavailable.length > 0 &&
            automationUnavailable &&
            " La prochaine relance automatique n’a pas pu être vérifiée."}
          <p className="mt-1">
            Actualisez pour réessayer. Les éléments manquants ne sont pas comptés comme
            absents.
          </p>
        </div>
      )}
      <div
        className="mt-5 flex flex-wrap gap-2"
        role="group"
        aria-label="Filtrer l’activité du devis"
      >
        {filters.map((entry) => (
          <button
            key={entry.value}
            type="button"
            aria-pressed={filter === entry.value}
            onClick={() => {
              setFilter(entry.value)
              setVisibleCount(25)
            }}
            className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${filter === entry.value ? "border-primary bg-primary-soft text-primary" : "border-line text-muted hover:border-line-strong hover:text-ink"}`}
          >
            {entry.label}
          </button>
        ))}
      </div>
      {loading && (!loaded || !current) ? (
        <Spinner />
      ) : (
        <>
          <ol aria-label="Historique chronologique du devis" className="mt-6 space-y-6">
            {current &&
              displayed.map((item) => <TimelineRow key={item.id} item={item} />)}
          </ol>
          {current && displayed.length === 0 && (
            <p className="mt-5 text-sm leading-6 text-muted">
              {unavailable.length
                ? "Aucune activité disponible dans ce filtre pour le moment."
                : filter === "all"
                  ? "Aucune activité enregistrée pour ce devis."
                  : "Aucune activité dans ce filtre."}
            </p>
          )}
          {current &&
            (hasMore || matching.length > visibleCount || retryPage !== null) && (
              <Button
                className="mt-6"
                variant="secondary"
                loading={loading}
                onClick={more}
              >
                {retryPage !== null
                  ? "Réessayer le chargement de la suite"
                  : "Afficher plus d’activité"}
              </Button>
            )}
        </>
      )}
      {children && (
        <div className="mt-6 space-y-5 border-t border-line pt-5">{children}</div>
      )}
    </Card>
  )
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const Icon = icons[item.category]
  return (
    <li className="flex min-w-0 gap-3 sm:gap-4">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.tone === "danger" ? "bg-danger-soft text-danger" : item.tone === "warning" ? "bg-warning-soft text-warning" : "bg-background text-muted"}`}
      >
        <Icon size={17} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 border-b border-line pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold">{item.title}</p>
          <time dateTime={item.at} className="text-xs leading-5 text-muted">
            {formatTimelineDate(item.at)}
          </time>
        </div>
        {item.content &&
          (item.content.length > 600 ? (
            <details className="group mt-2">
              <summary className="cursor-pointer list-none rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                <span className="block break-words whitespace-pre-wrap text-sm leading-6 text-ink-soft group-open:hidden [overflow-wrap:anywhere]">
                  {item.content.slice(0, 400).trimEnd()}…
                </span>
                <span className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary group-open:hidden">
                  Lire le message complet
                </span>
                <span className="hidden min-h-11 items-center text-sm font-medium text-primary group-open:inline-flex">
                  Replier le message
                </span>
              </summary>
              <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-6 text-ink-soft [overflow-wrap:anywhere]">
                {item.content}
              </p>
            </details>
          ) : (
            <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-6 text-ink-soft [overflow-wrap:anywhere]">
              {item.content}
            </p>
          ))}
        {item.detail && (
          <p className="mt-2 text-xs leading-5 text-muted">{item.detail}</p>
        )}
      </div>
    </li>
  )
}
