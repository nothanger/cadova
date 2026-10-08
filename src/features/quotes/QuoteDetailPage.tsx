import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import {
  Check,
  Clipboard,
  ChevronDown,
  Copy,
  Mail,
  MessageSquarePlus,
  Pencil,
  Send,
  X,
} from "lucide-react"
import { Dialog } from "@/components/ui/Dialog"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  Button,
  Card,
  ErrorState,
  Input,
  LinkButton,
  Spinner,
  StatusBadge,
  Textarea,
} from "@/components/ui"
import {
  addQuoteEvent,
  duplicateQuote,
  getQuote,
  scheduleFollowUp,
  setQuoteStatus,
} from "./api"
import { humanizeError } from "@/lib/errors"
import { formatCents } from "@/lib/money"
import { formatDate, todayISO } from "@/lib/dates"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import { useAdmin } from "@/features/admin/AdminContext"
import { AutomationPanel } from "./AutomationPanel"
import { QuoteDocumentPanel } from "./QuoteDocumentPanel"
import { QuoteClientPortalPanel } from "./QuoteClientPortalPanel"
import { QuoteEmailTrackingPanel } from "./QuoteEmailTrackingPanel"
import { QuoteTimeline } from "./timeline/QuoteTimeline"
import { QuoteWorkOrderPanel } from "./work-orders/QuoteWorkOrderPanel"
import { CompanyMessageControl } from "@/features/message-templates/CompanyMessageControl"
import { recordQuoteResponse } from "./automationApi"
import { resolveQuoteSituation } from "./situation"
import { getQuoteSituationContext } from "./situationApi"
import type { QuoteStatus, QuoteWithClient } from "@/types"

type Section =
  | "document"
  | "conversation"
  | "delivery"
  | "followups"
  | "response"
  | "work"
  | "details"
  | "history"
type SituationContext = Awaited<ReturnType<typeof getQuoteSituationContext>>

type Template = "first" | "second" | "expiry"
const templateLabels: Record<Template, string> = {
  first: "Première relance",
  second: "Deuxième relance",
  expiry: "Expiration proche",
}
function messageFor(kind: Template, quote: QuoteWithClient) {
  const client = quote.client?.name ?? ""
  if (kind === "second")
    return `Bonjour ${client},\n\nJe me permets de revenir vers vous concernant le devis ${quote.reference}. Avez-vous eu l’occasion de l’étudier ?\n\nJe reste disponible pour répondre à vos questions.\n\nBien cordialement,`
  if (kind === "expiry")
    return `Bonjour ${client},\n\nLe devis ${quote.reference} arrive prochainement à expiration. Souhaitez-vous que nous le validions ensemble ou que je vous prépare une version actualisée ?\n\nBien cordialement,`
  return `Bonjour ${client},\n\nJe reviens vers vous au sujet du devis ${quote.reference} envoyé récemment. Avez-vous pu en prendre connaissance ?\n\nJe reste à votre disposition pour toute question.\n\nBien cordialement,`
}

export function QuoteDetailPage() {
  const { quoteId } = useParams()
  const { user } = useAuth()
  const { company } = useCompany()
  const { isAdmin } = useAdmin()
  const navigate = useNavigate()
  const location = useLocation()
  const [quote, setQuote] = useState<QuoteWithClient | null>(null)
  const [timelineRevision, setTimelineRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updating, setUpdating] = useState<QuoteStatus | null>(null)
  const [modal, setModal] = useState(false)
  const [responseOpen, setResponseOpen] = useState(false)
  const [responseKind, setResponseKind] = useState<"message" | "accepted" | "refused">(
    "message",
  )
  const [responseContent, setResponseContent] = useState("")
  const [responseError, setResponseError] = useState("")
  const [responseConfirmed, setResponseConfirmed] = useState(false)
  const [context, setContext] = useState<SituationContext | null>(null)
  const [contextLoading, setContextLoading] = useState(true)
  const [contextError, setContextError] = useState(false)
  const [expanded, setExpanded] = useState<Section | null>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [template, setTemplate] = useState<Template>("first")
  const [message, setMessage] = useState("")
  const [subject, setSubject] = useState("")
  const [note, setNote] = useState("")
  const [nextDate, setNextDate] = useState("")
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState("")
  const [duplicating, setDuplicating] = useState(false)
  const [loadedScope, setLoadedScope] = useState("")
  const active = useRef(true)
  const request = useRef(0)
  const contextRequest = useRef(0)
  const responseLock = useRef(false)
  const focusedRequest = useRef("")
  const scope = `${user?.id}:${company?.id}:${quoteId}`
  const identity = useRef(scope)
  identity.current = scope

  const load = useCallback(async () => {
    if (!quoteId) return
    const ticket = ++request.current
    const currentScope = `${user?.id}:${company?.id}:${quoteId}`
    setLoading(true)
    setError("")
    setQuote(null)
    setTimelineRevision(0)
    setModal(false)
    setResponseOpen(false)
    setContext(null)
    setContextLoading(true)
    setContextError(false)
    setExpanded(null)
    setOptionsOpen(false)
    focusedRequest.current = ""
    setNote("")
    setCopied(false)
    setCopyError("")
    setUpdating(null)
    setSaving(false)
    setDuplicating(false)
    try {
      const q = await getQuote(quoteId, company?.id)
      if (ticket !== request.current || identity.current !== currentScope) return
      setQuote(q)
      setLoadedScope(currentScope)
      setNextDate(q.next_followup_at ?? "")
      setMessage(messageFor("first", q))
      setSubject(`Suivi du devis ${q.reference}`)
    } catch (e) {
      if (ticket === request.current && identity.current === currentScope)
        setError(humanizeError(e, "Devis introuvable."))
    } finally {
      if (ticket === request.current && identity.current === currentScope)
        setLoading(false)
    }
  }, [quoteId, user?.id, company?.id])
  useEffect(() => {
    active.current = true
    void load()
    return () => {
      active.current = false
      request.current++
      contextRequest.current++
    }
  }, [load])
  const refreshDetails = useCallback(async () => {
    if (!quoteId) return
    const currentScope = `${user?.id}:${company?.id}:${quoteId}`
    try {
      const updatedQuote = await getQuote(quoteId, company?.id)
      if (!active.current || identity.current !== currentScope) return
      setQuote(updatedQuote)
      setTimelineRevision((value) => value + 1)
    } catch {
      if (active.current && identity.current === currentScope)
        setError(
          "La modification a été enregistrée, mais l’historique n’a pas pu être actualisé. Rechargez le devis.",
        )
    }
  }, [quoteId, user?.id, company?.id])
  const loadSituation = useCallback(async () => {
    if (!quote) return
    const ticket = ++contextRequest.current
    const currentScope = scope
    setContext(null)
    setContextLoading(true)
    setContextError(false)
    try {
      const value = await getQuoteSituationContext(quote, { isAdmin })
      if (
        active.current &&
        ticket === contextRequest.current &&
        identity.current === currentScope
      )
        setContext(value)
    } catch {
      if (
        active.current &&
        ticket === contextRequest.current &&
        identity.current === currentScope
      )
        setContextError(true)
    } finally {
      if (
        active.current &&
        ticket === contextRequest.current &&
        identity.current === currentScope
      )
        setContextLoading(false)
    }
  }, [quote, scope, isAdmin])
  useEffect(() => {
    void loadSituation()
  }, [loadSituation, timelineRevision])
  const focusSection = useCallback((section: Section) => {
    if (section === "response") {
      setResponseKind("message")
      setResponseContent("")
      setResponseError("")
      setResponseConfirmed(false)
      setResponseOpen(true)
      return
    }
    setExpanded(section)
    requestAnimationFrame(() => {
      const element = document.getElementById(`quote-${section}`)
      element?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      })
      element?.focus({ preventScroll: true })
    })
  }, [])
  useEffect(() => {
    if (!quote || contextLoading || loadedScope !== scope) return
    const target = new URLSearchParams(location.search).get("focus")
    if (
      !target ||
      ![
        "document",
        "conversation",
        "delivery",
        "followups",
        "work",
        "details",
        "response",
        "history",
      ].includes(target)
    )
      return
    const key = `${scope}:${target}`
    if (focusedRequest.current === key) return
    focusedRequest.current = key
    focusSection(target as Section)
  }, [quote, contextLoading, loadedScope, scope, location.search, focusSection])
  function chooseTemplate(value: Template) {
    setTemplate(value)
    if (quote) {
      setMessage(messageFor(value, quote))
      setSubject(`Suivi du devis ${quote.reference}`)
    }
  }
  async function recordResponse() {
    if (
      !quote ||
      updating ||
      saving ||
      responseLock.current ||
      !responseConfirmed ||
      (responseKind === "message" && !responseContent.trim())
    )
      return
    const currentScope = scope
    setSaving(true)
    setResponseError("")
    responseLock.current = true
    try {
      if (responseKind === "message") {
        await recordQuoteResponse(quote.id, responseContent)
      } else {
        setUpdating(responseKind)
        await setQuoteStatus(quote.id, responseKind)
        await addQuoteEvent(
          quote,
          "status_change",
          `Devis ${responseKind === "accepted" ? "accepté" : "refusé"}${responseContent.trim() ? ` : ${responseContent.trim()}` : ""}`,
        ).catch(() => {
          if (active.current && identity.current === currentScope)
            setError(
              "La décision est enregistrée, mais son entrée dans l’historique n’a pas pu être ajoutée. Actualisez pour vérifier le dossier.",
            )
        })
      }
      if (!active.current || identity.current !== currentScope) return
      setResponseOpen(false)
      await refreshDetails()
    } catch (e) {
      if (active.current && identity.current === currentScope)
        setResponseError(
          humanizeError(
            e,
            "La réponse n’a pas pu être enregistrée. Actualisez le dossier avant de réessayer.",
          ),
        )
    } finally {
      responseLock.current = false
      if (active.current && identity.current === currentScope) {
        setUpdating(null)
        setSaving(false)
      }
    }
  }
  async function recordFollowUp() {
    if (!quote) return
    const currentScope = scope
    setSaving(true)
    try {
      await addQuoteEvent(quote, "followup", message)
      if (!active.current || identity.current !== currentScope) return
      setTimelineRevision((value) => value + 1)
      setModal(false)
    } catch (e) {
      if (active.current && identity.current === currentScope)
        setError(humanizeError(e, "Impossible d’enregistrer la relance."))
    } finally {
      if (active.current && identity.current === currentScope) setSaving(false)
    }
  }
  async function copyMessage() {
    const currentScope = scope
    setCopyError("")
    try {
      await navigator.clipboard.writeText(message)
      if (!active.current || identity.current !== currentScope) return
      setCopied(true)
      setTimeout(() => {
        if (active.current && identity.current === currentScope) setCopied(false)
      }, 1500)
    } catch {
      if (active.current && identity.current === currentScope)
        setCopyError("Copie indisponible. Sélectionnez le message pour le copier.")
    }
  }
  async function duplicate() {
    if (!quote || duplicating) return
    const currentScope = scope
    setDuplicating(true)
    try {
      const copy = await duplicateQuote(quote)
      if (!active.current || identity.current !== currentScope) return
      navigate(`/app/quotes/${copy.id}/edit`)
    } catch (e) {
      if (active.current && identity.current === currentScope)
        setError(humanizeError(e, "Impossible de dupliquer le devis."))
    } finally {
      if (active.current && identity.current === currentScope) setDuplicating(false)
    }
  }
  async function addNote() {
    if (!quote || !note.trim()) return
    const currentScope = scope
    setSaving(true)
    try {
      await addQuoteEvent(quote, "note", note)
      if (!active.current || identity.current !== currentScope) return
      setTimelineRevision((value) => value + 1)
      setNote("")
    } catch (e) {
      if (active.current && identity.current === currentScope)
        setError(humanizeError(e, "Impossible d’ajouter la note."))
    } finally {
      if (active.current && identity.current === currentScope) setSaving(false)
    }
  }
  async function plan() {
    if (!quote) return
    const currentScope = scope
    setSaving(true)
    try {
      await scheduleFollowUp(quote.id, nextDate || null)
      if (nextDate) {
        await addQuoteEvent(
          quote,
          "followup_scheduled",
          `Prochaine relance : ${formatDate(nextDate)}`,
        )
        if (active.current && identity.current === currentScope)
          setTimelineRevision((value) => value + 1)
      }
      if (active.current && identity.current === currentScope)
        setQuote({ ...quote, next_followup_at: nextDate || null })
    } catch (e) {
      if (active.current && identity.current === currentScope)
        setError(humanizeError(e, "Planification impossible."))
    } finally {
      if (active.current && identity.current === currentScope) setSaving(false)
    }
  }
  if (loading || (quote && loadedScope !== scope)) return <Spinner />
  if (error && !quote) return <ErrorState message={error} onRetry={load} />
  if (!quote) return null
  const situation = context
    ? resolveQuoteSituation(
        context.quotes.find(
          (row) => row.id === quote.id && row.company_id === quote.company_id,
        ) ?? quote,
        context,
        context.followupDelayDays ?? 3,
      )
    : null
  const sent = quote.status === "sent"
  const primaryDocument = quote.status === "draft" || situation?.target === "document"
  const primaryConversation = situation?.target === "conversation"
  const primaryDelivery = situation?.target === "delivery"
  const clientEmail =
    context?.quotes.find((value) => value.id === quote.id)?.client?.email ?? ""
  const validClientEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)
    ? clientEmail
    : ""
  return (
    <>
      <PageHeader
        title={quote.reference}
        subtitle={quote.client ? quote.client.name : "Dossier du devis"}
        back={{ to: "/app/quotes", label: "Tous les devis" }}
        actions={
          <Button
            variant="secondary"
            onClick={() => setOptionsOpen((value) => !value)}
            aria-expanded={optionsOpen}
            aria-controls="quote-options"
          >
            Options du devis <ChevronDown size={16} aria-hidden="true" />
          </Button>
        }
      />
      {optionsOpen && (
        <div
          id="quote-options"
          className="mb-5 flex flex-wrap gap-2 rounded-xl border border-line bg-surface p-3"
        >
          <LinkButton variant="secondary" to={`/app/quotes/${quote.id}/edit`}>
            <Pencil size={16} /> Modifier les informations
          </LinkButton>
          <Button variant="secondary" loading={duplicating} onClick={duplicate}>
            <Copy size={16} /> Dupliquer
          </Button>
          <Button variant="ghost" onClick={() => focusSection("details")}>
            Informations du dossier
          </Button>
          {!sent && (
            <Button variant="ghost" onClick={() => focusSection("response")}>
              Enregistrer une décision reçue
            </Button>
          )}
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <div className="mb-6 rounded-xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatCents(quote.amount_cents)}
          </p>
          <StatusBadge status={quote.status} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          {quote.client && (
            <Link
              to={`/app/clients/${quote.client.id}`}
              className="font-medium text-primary hover:underline"
            >
              Voir le client
            </Link>
          )}
          {quote.sent_at && <span>Envoyé le {formatDate(quote.sent_at)}</span>}
          {quote.expires_at && (
            <span>Valable jusqu’au {formatDate(quote.expires_at ?? null)}</span>
          )}
        </div>
        <div className="mt-5 border-t border-line pt-5" aria-live="polite">
          {contextLoading ? (
            <p className="text-sm text-muted">Vérification de la prochaine étape…</p>
          ) : situation ? (
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {situation.automatic
                    ? "Cadova s’en charge"
                    : situation.kind === "unknown"
                      ? "À vérifier"
                      : situation.kind === "refused" ||
                          situation.kind === "work_completed"
                        ? "Dossier terminé"
                        : !situation.attention
                          ? "Suivi du devis"
                          : "Prochaine étape"}
                </p>
                <h2
                  className={`mt-2 text-lg font-semibold ${situation.tone === "danger" ? "text-danger" : situation.tone === "warning" ? "text-warning" : "text-ink"}`}
                >
                  {situation.title}
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
                  {situation.detail}
                </p>
              </div>
              <Button
                variant={
                  situation.automatic || !situation.attention ? "secondary" : "primary"
                }
                className="w-full shrink-0 sm:w-auto"
                onClick={() =>
                  situation.kind === "unknown"
                    ? void loadSituation()
                    : situation.destination
                      ? navigate(situation.destination)
                      : focusSection(situation.target)
                }
              >
                {situation.kind === "unknown"
                  ? "Réessayer la vérification"
                  : situation.label}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p role="status" className="text-sm leading-6 text-warning">
                {contextError
                  ? "La prochaine étape n’a pas pu être vérifiée. Les informations du dossier restent accessibles."
                  : "La situation du dossier reste à vérifier."}
              </p>
              <Button variant="secondary" onClick={() => void loadSituation()}>
                Réessayer
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-6">
        {quote.status === "accepted" && (
          <div
            id="quote-work"
            tabIndex={-1}
            className="scroll-mt-6 rounded-xl focus:outline-none"
          >
            <QuoteWorkOrderPanel quote={quote} onChanged={refreshDetails} />
          </div>
        )}
        <details
          open={primaryDocument || expanded === "document" || undefined}
          className={primaryDocument ? "" : "rounded-xl border border-line bg-surface"}
        >
          <summary
            className={`min-h-12 cursor-pointer px-5 py-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary ${primaryDocument ? "hidden" : ""}`}
          >
            Document du devis
          </summary>
          <div
            id="quote-document"
            tabIndex={-1}
            className="scroll-mt-6 rounded-xl focus:outline-none"
          >
            <QuoteDocumentPanel
              key={scope}
              quote={quote}
              onChanged={() => {
                // Keep the result visible when a draft becomes sent.
                setExpanded("document")
                return refreshDetails()
              }}
            />
          </div>
        </details>
        {quote.status !== "draft" && (
          <div
            id="quote-conversation"
            tabIndex={-1}
            className="scroll-mt-6 rounded-xl focus:outline-none"
          >
            <QuoteClientPortalPanel
              key={`portal:${scope}`}
              quote={quote}
              onChanged={refreshDetails}
              showConversation={primaryConversation || expanded === "conversation"}
              compact
            />
          </div>
        )}
        {sent && (
          <div
            id="quote-followups"
            tabIndex={-1}
            className="scroll-mt-6 space-y-4 rounded-xl focus:outline-none"
          >
            <Card className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold">Réponses et relances</h2>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    Enregistrez une réponse reçue par téléphone ou email pour arrêter
                    les relances.
                  </p>
                </div>
                <Button variant="secondary" onClick={() => focusSection("response")}>
                  Enregistrer la réponse du client
                </Button>
              </div>
              <details
                className="mt-5 border-t border-line pt-4"
                open={situation?.kind === "followup" || undefined}
              >
                <summary className="min-h-11 cursor-pointer text-sm font-medium leading-6 focus-visible:outline-2 focus-visible:outline-primary">
                  Relancer moi-même
                </summary>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Préparez un message à envoyer depuis votre messagerie.
                </p>
                <Button
                  variant="secondary"
                  className="mt-3"
                  onClick={() => setModal(true)}
                >
                  <Send size={16} /> Préparer la relance
                </Button>
                <div className="mt-5">
                  <h3 className="text-sm font-medium">Me rappeler de relancer</h3>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Ce rappel n’envoie aucun email.
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <Input
                    aria-label="Date de la prochaine relance"
                    type="date"
                    min={todayISO()}
                    value={nextDate}
                    onChange={(event) => setNextDate(event.target.value)}
                  />
                  <Button variant="secondary" loading={saving} onClick={plan}>
                    Enregistrer le rappel
                  </Button>
                </div>
              </details>
            </Card>
            <details
              open={!primaryConversation || expanded === "followups" || undefined}
              className={
                primaryConversation ? "rounded-xl border border-line bg-surface" : ""
              }
            >
              <summary
                className={
                  primaryConversation
                    ? "min-h-12 cursor-pointer px-5 py-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary"
                    : "hidden"
                }
              >
                Relances automatiques
              </summary>
              <AutomationPanel
                quote={quote}
                onChanged={refreshDetails}
                showHistory
                showResponseAction={false}
                compact
                revision={timelineRevision}
              />
            </details>
          </div>
        )}
        <details
          open={primaryDelivery || expanded === "delivery" || undefined}
          className="rounded-xl border border-line bg-surface"
        >
          <summary className="min-h-12 cursor-pointer px-5 py-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">
            Livraison des emails
          </summary>
          <div
            id="quote-delivery"
            tabIndex={-1}
            className="scroll-mt-6 rounded-xl focus:outline-none"
          >
            {primaryDelivery && quote.status === "draft" && (
              <p className="px-5 pb-3 text-sm text-muted">
                L’état de l’envoi et sa vérification sont disponibles dans le document
                ci-dessus.
              </p>
            )}
            <QuoteEmailTrackingPanel key={`email:${scope}`} quote={quote} showHistory />
          </div>
        </details>
        <div
          id="quote-history"
          tabIndex={-1}
          className="scroll-mt-6 rounded-xl focus:outline-none"
        >
          <QuoteTimeline quote={quote} revision={timelineRevision}>
            <details>
              <summary className="min-h-11 cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary">
                Ajouter une note interne
              </summary>
              <p className="mt-1 text-xs leading-5 text-muted">
                Cette note reste dans votre entreprise. Elle n’enregistre pas une
                réponse client.
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <Input
                  aria-label="Note de suivi"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Votre note…"
                />
                <Button
                  variant="secondary"
                  loading={saving}
                  onClick={addNote}
                  disabled={!note.trim()}
                >
                  <MessageSquarePlus size={16} /> Ajouter
                </Button>
              </div>
            </details>
          </QuoteTimeline>
        </div>
        <details
          open={expanded === "details" || undefined}
          className="rounded-xl border border-line bg-surface"
        >
          <summary className="min-h-12 cursor-pointer px-5 py-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary">
            Informations du dossier
          </summary>
          <div
            id="quote-details"
            tabIndex={-1}
            className="scroll-mt-6 px-5 pb-5 focus:outline-none"
          >
            <dl className="grid gap-5 sm:grid-cols-2">
              <Detail label="Référence" value={quote.reference} mono />
              <Detail label="Montant" value={formatCents(quote.amount_cents)} mono />
              <Detail label="Date d’envoi" value={formatDate(quote.sent_at)} />
              <Detail
                label="Valable jusqu’au"
                value={formatDate(quote.expires_at ?? null)}
              />
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wider text-muted">
                  Notes du devis
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-ink-soft">
                  {quote.notes || "Aucune note."}
                </dd>
              </div>
            </dl>
          </div>
        </details>
      </div>
      {responseOpen && (
        <Dialog
          titleId="quote-response-title"
          onClose={() => {
            if (!saving) setResponseOpen(false)
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void recordResponse()
            }}
          >
            <h2 id="quote-response-title" className="text-xl font-semibold">
              Enregistrer la réponse du client
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Pour une réponse reçue par téléphone, email ou en personne. Aucun message
              ne sera envoyé.
            </p>
            <fieldset className="mt-5 space-y-2">
              <legend className="mb-2 text-sm font-medium">
                Que vous a répondu le client ?
              </legend>
              {(
                [
                  ["message", "Il a répondu ou posé une question"],
                  ["accepted", "Il accepte le devis"],
                  ["refused", "Il refuse le devis"],
                ] as const
              ).map(([kind, label]) => (
                <label
                  key={kind}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm"
                >
                  <input
                    type="radio"
                    name="client-response-kind"
                    value={kind}
                    checked={responseKind === kind}
                    disabled={saving}
                    onChange={() => {
                      setResponseKind(kind)
                      setResponseConfirmed(false)
                    }}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label
              htmlFor="quote-client-response"
              className="mt-5 block text-sm font-medium"
            >
              {responseKind === "message"
                ? "Réponse du client"
                : "Précision facultative"}
            </label>
            <Textarea
              id="quote-client-response"
              className="mt-2 min-h-28"
              maxLength={4000}
              required={responseKind === "message"}
              value={responseContent}
              disabled={saving}
              onChange={(event) => setResponseContent(event.target.value)}
            />
            <p className="mt-3 rounded-lg bg-background p-3 text-sm leading-6 text-ink-soft">
              {responseKind === "accepted"
                ? "Le devis passera en « Accepté ». Vous pourrez ensuite planifier l’intervention."
                : responseKind === "refused"
                  ? "Le devis passera en « Refusé ». Son historique sera conservé."
                  : "La réponse sera conservée dans le dossier."}{" "}
              Les prochaines relances automatiques seront arrêtées.
            </p>
            <label className="mt-4 flex min-h-11 items-start gap-3 text-sm leading-6">
              <input
                type="checkbox"
                className="mt-1"
                checked={responseConfirmed}
                disabled={saving}
                onChange={(event) => setResponseConfirmed(event.target.checked)}
              />
              Je confirme avoir reçu cette réponse du client.
            </label>
            {responseError && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {responseError}
              </p>
            )}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => setResponseOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                loading={saving}
                disabled={
                  !responseConfirmed ||
                  (responseKind === "message" && !responseContent.trim())
                }
              >
                Confirmer la réponse
              </Button>
            </div>
          </form>
        </Dialog>
      )}
      {modal && (
        <Dialog titleId="followup-title" onClose={() => setModal(false)}>
          <div className="flex justify-between">
            <div>
              <h2 id="followup-title" className="text-lg font-semibold">
                Préparer la relance
              </h2>
              <p className="mt-1 text-sm text-muted">
                Adaptez le message, puis envoyez-le depuis votre messagerie.
              </p>
            </div>
            <button
              onClick={() => setModal(false)}
              aria-label="Fermer la relance"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-background"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {(Object.keys(templateLabels) as Template[]).map((key) => (
              <button
                key={key}
                aria-pressed={template === key}
                onClick={() => chooseTemplate(key)}
                className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-medium ${template === key ? "border-primary bg-primary text-white" : "border-line-strong"}`}
              >
                {templateLabels[key]}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <CompanyMessageControl
              companyId={quote.company_id}
              kind={
                template === "first"
                  ? "first_followup"
                  : template === "second"
                    ? "second_followup"
                    : "expiry_followup"
              }
              values={{
                client_name: quote.client?.name ?? "",
                quote_reference: quote.reference,
                company_name: "",
                amount_formatted: formatCents(quote.amount_cents),
              }}
              current={{ subject, body: message }}
              onApply={(draft) => {
                setSubject(draft.subject)
                setMessage(draft.body)
              }}
              disabled={saving}
            />
          </div>
          <Input
            aria-label="Objet de la relance"
            className="mt-4"
            value={subject}
            maxLength={160}
            onChange={(event) => setSubject(event.target.value)}
          />
          <Textarea
            aria-label="Message de relance"
            className="mt-4 min-h-56"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {copyError && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {copyError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={copyMessage}>
              {copied ? <Check size={16} /> : <Clipboard size={16} />}{" "}
              {copied ? "Copié" : "Copier"}
            </Button>
            <a
              className="ui-button border border-line-strong hover:bg-background"
              href={`mailto:${encodeURIComponent(validClientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}
            >
              <Mail size={16} /> Ouvrir l’email
            </a>
            <Button loading={saving} onClick={recordFollowUp}>
              J’ai envoyé cette relance
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
function Detail({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className={`mt-1 text-ink ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  )
}
