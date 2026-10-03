import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  AlertTriangle,
  CalendarClock,
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
  listQuoteEvents,
  scheduleFollowUp,
  setQuoteStatus,
} from "./api"
import { humanizeError } from "@/lib/errors"
import { formatCents } from "@/lib/money"
import { formatDate, todayISO } from "@/lib/dates"
import { daysWaiting, isQuoteDueForFollowUp } from "@/lib/followup"
import type { QuoteEvent, QuoteStatus, QuoteWithClient } from "@/types"

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
  const navigate = useNavigate()
  const [quote, setQuote] = useState<QuoteWithClient | null>(null)
  const [events, setEvents] = useState<QuoteEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updating, setUpdating] = useState<QuoteStatus | null>(null)
  const [modal, setModal] = useState(false)
  const [template, setTemplate] = useState<Template>("first")
  const [message, setMessage] = useState("")
  const [note, setNote] = useState("")
  const [nextDate, setNextDate] = useState("")
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState("")
  const [duplicating, setDuplicating] = useState(false)

  async function load() {
    if (!quoteId) return
    setLoading(true)
    setError("")
    try {
      const q = await getQuote(quoteId)
      setQuote(q)
      setNextDate(q.next_followup_at ?? "")
      setMessage(messageFor("first", q))
      setEvents(await listQuoteEvents(quoteId).catch(() => []))
    } catch (e) {
      setError(humanizeError(e, "Devis introuvable."))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [quoteId])
  function chooseTemplate(value: Template) {
    setTemplate(value)
    if (quote) setMessage(messageFor(value, quote))
  }
  async function changeStatus(status: QuoteStatus) {
    if (!quote || updating) return
    setUpdating(status)
    try {
      await setQuoteStatus(quote.id, status)
      setQuote({ ...quote, status })
      const event = await addQuoteEvent(
        quote,
        "status_change",
        `Statut : ${status}`,
      ).catch(() => null)
      if (event) setEvents((v) => [event, ...v])
    } catch (e) {
      setError(humanizeError(e, "Mise à jour impossible."))
    } finally {
      setUpdating(null)
    }
  }
  async function recordFollowUp() {
    if (!quote) return
    setSaving(true)
    try {
      const event = await addQuoteEvent(quote, "followup", message)
      setEvents((v) => [event, ...v])
      setModal(false)
    } catch (e) {
      setError(humanizeError(e, "Impossible d’enregistrer la relance."))
    } finally {
      setSaving(false)
    }
  }
  async function copyMessage() {
    setCopyError("")
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopyError("Copie indisponible. Sélectionnez le message pour le copier.")
    }
  }
  async function duplicate() {
    if (!quote || duplicating) return
    setDuplicating(true)
    try {
      const copy = await duplicateQuote(quote)
      navigate(`/app/quotes/${copy.id}/edit`)
    } catch (e) {
      setError(humanizeError(e, "Impossible de dupliquer le devis."))
    } finally {
      setDuplicating(false)
    }
  }
  async function addNote() {
    if (!quote || !note.trim()) return
    setSaving(true)
    try {
      const event = await addQuoteEvent(quote, "note", note)
      setEvents((v) => [event, ...v])
      setNote("")
    } catch (e) {
      setError(humanizeError(e, "Impossible d’ajouter la note."))
    } finally {
      setSaving(false)
    }
  }
  async function plan() {
    if (!quote) return
    setSaving(true)
    try {
      await scheduleFollowUp(quote.id, nextDate || null)
      if (nextDate) {
        const event = await addQuoteEvent(
          quote,
          "followup_scheduled",
          `Prochaine relance : ${formatDate(nextDate)}`,
        )
        setEvents((v) => [event, ...v])
      }
      setQuote({ ...quote, next_followup_at: nextDate || null })
    } catch (e) {
      setError(humanizeError(e, "Planification impossible."))
    } finally {
      setSaving(false)
    }
  }
  if (loading) return <Spinner />
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
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-ink">
                  Historique et prochaine action
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Toutes les interactions utiles, au même endroit.
                </p>
              </div>
              <CalendarClock className="text-primary" size={20} />
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
            <div className="mt-6 space-y-4 border-l border-line pl-5">
              {events.length === 0 && (
                <p className="text-sm text-muted">Aucune activité enregistrée.</p>
              )}
              {events.map((e) => (
                <Timeline key={e.id} event={e} />
              ))}
              {quote.sent_at && (
                <Timeline
                  event={{
                    id: "sent",
                    company_id: quote.company_id,
                    quote_id: quote.id,
                    event_type: "sent",
                    content: null,
                    occurred_at: quote.sent_at,
                    created_by: null,
                  }}
                />
              )}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Input
                aria-label="Note ou réponse reçue"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ajouter une note ou une réponse reçue…"
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
          </Card>
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
                Vous gardez le contrôle : aucun envoi automatique.
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
              href={`mailto:?subject=${encodeURIComponent(`Suivi du devis ${quote.reference}`)}&body=${encodeURIComponent(message)}`}
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
function Timeline({ event }: { event: QuoteEvent }) {
  const labels: Record<QuoteEvent["event_type"], string> = {
    sent: "Devis envoyé",
    followup: "Relance effectuée",
    response: "Réponse reçue",
    note: "Note",
    status_change: "Statut modifié",
    followup_scheduled: "Relance planifiée",
  }
  return (
    <div className="relative">
      <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-primary ring-4 ring-surface" />
      <div className="flex flex-wrap justify-between gap-2">
        <p className="text-sm font-medium">{labels[event.event_type]}</p>
        <time className="text-xs text-muted">
          {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
            new Date(event.occurred_at),
          )}
        </time>
      </div>
      {event.content && (
        <p className="mt-1 break-words whitespace-pre-wrap text-sm leading-6 text-muted">
          {event.content}
        </p>
      )}
    </div>
  )
}
