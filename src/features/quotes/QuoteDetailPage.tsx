import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  AlertTriangle,
  Check,
  Clipboard,
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
import { daysWaiting, isQuoteDueForFollowUp } from "@/lib/followup"
import { useAuth } from "@/features/auth/AuthContext"
import { AutomationPanel } from "./AutomationPanel"
import { QuoteDocumentPanel } from "./QuoteDocumentPanel"
import { QuoteClientPortalPanel } from "./QuoteClientPortalPanel"
import { QuoteEmailTrackingPanel } from "./QuoteEmailTrackingPanel"
import { QuoteTimeline } from "./timeline/QuoteTimeline"
import { QuoteWorkOrderPanel } from "./work-orders/QuoteWorkOrderPanel"
import { CompanyMessageControl } from "@/features/message-templates/CompanyMessageControl"
import type { QuoteStatus, QuoteWithClient } from "@/types"

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
  const navigate = useNavigate()
  const [quote, setQuote] = useState<QuoteWithClient | null>(null)
  const [timelineRevision, setTimelineRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updating, setUpdating] = useState<QuoteStatus | null>(null)
  const [modal, setModal] = useState(false)
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
  const scope = `${user?.id}:${quoteId}`
  const identity = useRef(scope)
  identity.current = scope

  const load = useCallback(async () => {
    if (!quoteId) return
    const ticket = ++request.current
    const currentScope = `${user?.id}:${quoteId}`
    setLoading(true)
    setError("")
    setQuote(null)
    setTimelineRevision(0)
    setModal(false)
    setNote("")
    setCopied(false)
    setCopyError("")
    setUpdating(null)
    setSaving(false)
    setDuplicating(false)
    try {
      const q = await getQuote(quoteId)
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
  }, [quoteId, user?.id])
  useEffect(() => {
    active.current = true
    void load()
    return () => {
      active.current = false
      request.current++
    }
  }, [load])
  const refreshDetails = useCallback(async () => {
    if (!quoteId) return
    const currentScope = `${user?.id}:${quoteId}`
    try {
      const updatedQuote = await getQuote(quoteId)
      if (!active.current || identity.current !== currentScope) return
      setQuote(updatedQuote)
      setTimelineRevision((value) => value + 1)
    } catch {
      if (active.current && identity.current === currentScope)
        setError(
          "La modification a été enregistrée, mais l’historique n’a pas pu être actualisé. Rechargez le devis.",
        )
    }
  }, [quoteId, user?.id])
  function chooseTemplate(value: Template) {
    setTemplate(value)
    if (quote) {
      setMessage(messageFor(value, quote))
      setSubject(`Suivi du devis ${quote.reference}`)
    }
  }
  async function changeStatus(status: QuoteStatus) {
    if (!quote || updating) return
    const currentScope = scope
    setUpdating(status)
    try {
      await setQuoteStatus(quote.id, status)
      if (active.current && identity.current === currentScope)
        setQuote({ ...quote, status })
      const event = await addQuoteEvent(
        quote,
        "status_change",
        `Statut : ${status === "accepted" ? "accepté" : status === "refused" ? "refusé" : status}`,
      ).catch(() => null)
      if (event && active.current && identity.current === currentScope)
        setTimelineRevision((value) => value + 1)
    } catch (e) {
      if (active.current && identity.current === currentScope)
        setError(humanizeError(e, "Mise à jour impossible."))
    } finally {
      if (active.current && identity.current === currentScope) setUpdating(null)
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
  const due = isQuoteDueForFollowUp(quote)
  return (
    <>
      <PageHeader
        title={quote.reference}
        subtitle={quote.client ? `Client : ${quote.client.name}` : undefined}
        back={{ to: "/app/quotes", label: "Retour aux devis" }}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" loading={duplicating} onClick={duplicate}>
              <Copy size={16} /> Dupliquer
            </Button>
            <LinkButton variant="secondary" to={`/app/quotes/${quote.id}/edit`}>
              <Pencil size={16} /> Modifier
            </LinkButton>
          </div>
        }
      />
      {due && (
        <div className="mb-6 flex gap-3 rounded-[var(--radius-cadova)] border border-warning/30 bg-warning-soft p-4">
          <AlertTriangle className="text-warning" size={20} />
          <div>
            <p className="font-semibold text-warning">À relancer</p>
            <p className="text-sm text-warning/90">
              Envoyé il y a {daysWaiting(quote)} jours, sans réponse enregistrée.
            </p>
          </div>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-[10px] bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <dl className="grid gap-5 sm:grid-cols-2">
              <Detail label="Montant" value={formatCents(quote.amount_cents)} mono />
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted">Statut</dt>
                <dd className="mt-1">
                  <StatusBadge status={quote.status} />
                </dd>
              </div>
              <Detail label="Date d’envoi" value={formatDate(quote.sent_at)} />
              {quote.expires_at && (
                <Detail label="Valable jusqu’au" value={formatDate(quote.expires_at)} />
              )}
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted">Client</dt>
                <dd className="mt-1">
                  {quote.client ? (
                    <Link
                      to={`/app/clients/${quote.client.id}`}
                      className="text-primary hover:underline"
                    >
                      {quote.client.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wider text-muted">Notes</dt>
                <dd className="mt-1 whitespace-pre-wrap text-ink-soft">
                  {quote.notes || "—"}
                </dd>
              </div>
            </dl>
          </Card>
          <QuoteWorkOrderPanel quote={quote} onChanged={refreshDetails} />
          <QuoteTimeline quote={quote} revision={timelineRevision}>
            <div>
              <h3 className="text-sm font-semibold">Prévoir une relance manuelle</h3>
              <p className="mt-1 text-xs leading-5 text-muted">
                Ce rappel n’envoie aucun email. Les relances automatiques se règlent
                dans les outils ci-dessous.
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Input
                aria-label="Date de la prochaine relance"
                type="date"
                min={todayISO()}
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
              />
              <Button variant="secondary" loading={saving} onClick={plan}>
                Planifier
              </Button>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Input
                aria-label="Note de suivi"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ajouter une note de suivi…"
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
          </QuoteTimeline>
          <section className="space-y-6" aria-label="Outils du devis">
            <h2 className="font-semibold text-ink">Outils du devis</h2>
            <QuoteDocumentPanel key={scope} quote={quote} onChanged={refreshDetails} />
            <QuoteClientPortalPanel
              key={`portal:${scope}`}
              quote={quote}
              onChanged={refreshDetails}
              showConversation={false}
            />
            <AutomationPanel quote={quote} onChanged={refreshDetails} showHistory />
            <QuoteEmailTrackingPanel
              key={`email:${scope}`}
              quote={quote}
              showHistory={false}
            />
          </section>
        </div>
        <Card className="h-fit p-6">
          <h2 className="text-sm font-semibold text-ink">Actions</h2>
          <div className="mt-4 flex flex-col gap-3">
            <Button onClick={() => setModal(true)}>
              <Send size={16} /> Préparer la relance
            </Button>
            <Button
              variant="secondary"
              loading={updating === "accepted"}
              disabled={quote.status === "accepted"}
              onClick={() => changeStatus("accepted")}
            >
              <Check size={16} /> Marquer accepté
            </Button>
            <Button
              variant="secondary"
              loading={updating === "refused"}
              disabled={quote.status === "refused"}
              onClick={() => changeStatus("refused")}
            >
              Marquer refusé
            </Button>
          </div>
        </Card>
      </div>
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
              href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}
            >
              <Mail size={16} /> Ouvrir l’email
            </a>
            <Button loading={saving} onClick={recordFollowUp}>
              Enregistrer
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
