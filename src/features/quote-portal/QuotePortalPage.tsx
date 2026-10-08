import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useLocation } from "react-router-dom"
import {
  Check,
  Download,
  FileText,
  LockKeyhole,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  X,
} from "lucide-react"
import { CadovaLogo } from "@/components/CadovaLogo"
import { Button, Card, Field, Spinner, StatusBadge, Textarea } from "@/components/ui"
import { Dialog } from "@/components/ui/Dialog"
import { formatCents } from "@/lib/money"
import { formatDate } from "@/lib/dates"
import {
  downloadPortalDocument,
  portalError,
  portalTokenFromHash,
  respondToPortal,
  viewPortal,
  type PortalView,
} from "./api"
import { PortalConversation } from "./PortalConversation"

export function QuotePortalPage() {
  const { hash } = useLocation()
  const token = portalTokenFromHash(hash)
  useEffect(() => {
    const previousTitle = document.title
    document.title = "Suivi de votre devis · Cadova"
    const meta = document.createElement("meta")
    meta.name = "robots"
    meta.content = "noindex, nofollow"
    document.head.appendChild(meta)
    return () => {
      meta.remove()
      document.title = previousTitle
    }
  }, [])
  return (
    <div className="min-h-dvh bg-background text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <CadovaLogo className="h-8 w-32" />
          <p className="flex items-center gap-2 text-xs text-muted">
            <LockKeyhole size={14} aria-hidden="true" /> Suivi privé du devis
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        {token ? (
          <PortalContent key={token} token={token} />
        ) : (
          <Unavailable message="Ce lien est incomplet. Ouvrez le lien transmis par l’entreprise ou demandez-lui un nouveau lien." />
        )}
      </main>
      <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 pb-8 text-xs text-muted sm:px-8">
        <p>Suivi proposé par Cadova</p>
        <Link to="/privacy" className="underline underline-offset-4">
          Confidentialité
        </Link>
      </footer>
    </div>
  )
}

function Unavailable({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="mx-auto max-w-xl p-6 sm:p-8">
      <FileText size={28} className="text-muted" aria-hidden="true" />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Devis indisponible</h1>
      <p role="alert" className="mt-3 text-sm leading-6 text-muted">
        {message}
      </p>
      {onRetry && (
        <Button className="mt-5" variant="secondary" onClick={onRetry}>
          <RefreshCw size={16} /> Réessayer
        </Button>
      )}
    </Card>
  )
}

function PortalContent({ token }: { token: string }) {
  const [view, setView] = useState<PortalView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [unavailable, setUnavailable] = useState(false)
  const [question, setQuestion] = useState("")
  const [decision, setDecision] = useState<"accepted" | "refused" | null>(null)
  const [decisionNote, setDecisionNote] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState<"question" | "decision" | "download" | null>(null)
  const [notice, setNotice] = useState("")
  const active = useRef(true)
  const locked = useRef(false)
  const requestId = useRef(0)
  const controllers = useRef(new Set<AbortController>())
  const pendingSend = useRef<{ key: string; nonce: string } | null>(null)
  function controller() {
    const next = new AbortController()
    controllers.current.add(next)
    return next
  }
  const load = useCallback(async () => {
    const ticket = ++requestId.current
    const abort = new AbortController()
    controllers.current.add(abort)
    setLoading(true)
    setError("")
    try {
      const data = await viewPortal(token, abort.signal)
      if (active.current && ticket === requestId.current) {
        setView(data)
        setUnavailable(false)
      }
    } catch (e) {
      if (active.current && ticket === requestId.current && !abort.signal.aborted) {
        setError(portalError(e))
        setUnavailable(
          typeof e === "object" &&
            e !== null &&
            "code" in e &&
            e.code === "link_unavailable",
        )
      }
    } finally {
      controllers.current.delete(abort)
      if (active.current && ticket === requestId.current) setLoading(false)
    }
  }, [token])
  useEffect(() => {
    active.current = true
    void load()
    const pending = controllers.current
    return () => {
      active.current = false
      requestId.current++
      pending.forEach((entry) => entry.abort())
      pending.clear()
    }
  }, [load])

  async function respond(kind: "question" | "accepted" | "refused", message: string) {
    if (
      locked.current ||
      loading ||
      !view?.can_respond ||
      (kind !== "question" && !confirmed)
    )
      return
    locked.current = true
    const abort = controller()
    setBusy(kind === "question" ? "question" : "decision")
    setError("")
    setNotice("")
    const key = `${kind}:${message.trim()}`
    if (pendingSend.current?.key !== key)
      pendingSend.current = { key, nonce: crypto.randomUUID() }
    try {
      const data = await respondToPortal(
        token,
        kind,
        message.trim(),
        pendingSend.current.nonce,
        abort.signal,
      )
      if (!active.current) return
      setView(data)
      pendingSend.current = null
      setQuestion("")
      setDecision(null)
      setDecisionNote("")
      setConfirmed(false)
      setNotice(
        kind === "question"
          ? "Votre question a été transmise à l’entreprise."
          : "Votre décision a été transmise à l’entreprise.",
      )
    } catch (e) {
      if (active.current && !abort.signal.aborted) {
        setError(portalError(e))
        if (
          typeof e === "object" &&
          e !== null &&
          "code" in e &&
          e.code === "link_unavailable"
        )
          setUnavailable(true)
      }
    } finally {
      controllers.current.delete(abort)
      locked.current = false
      if (active.current) setBusy(null)
    }
  }
  async function download() {
    if (locked.current || loading || !view) return
    locked.current = true
    const abort = controller()
    setBusy("download")
    setError("")
    try {
      const blob = await downloadPortalDocument(token, abort.signal)
      if (!active.current) return
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${view.quote.reference.replace(/[^a-zA-Z0-9_-]/g, "_") || "devis"}.pdf`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      if (active.current && !abort.signal.aborted) setError(portalError(e))
    } finally {
      controllers.current.delete(abort)
      locked.current = false
      if (active.current) setBusy(null)
    }
  }
  function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (question.trim()) void respond("question", question)
  }

  if (loading && !view)
    return (
      <div role="status" aria-label="Chargement du devis">
        <Spinner />
      </div>
    )
  if (!view || unavailable)
    return <Unavailable message={error} onRetry={unavailable ? undefined : load} />
  const quote = view.quote
  return (
    <>
      <div className="mb-7">
        <p className="break-words text-sm font-medium text-primary">
          {quote.company_name}
        </p>
        <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight sm:text-4xl">
          Votre devis {quote.reference}
        </h1>
        <p className="mt-3 break-words text-sm leading-6 text-muted">
          Pour {quote.client_name}.{" "}
          {quote.status === "sent" && view.can_respond
            ? "Consultez le document, puis posez une question ou indiquez votre décision."
            : quote.status === "accepted"
              ? "Votre accord est enregistré. Retrouvez ici le document et vos échanges avec l’entreprise."
              : quote.status === "refused"
                ? "Votre refus est enregistré. Retrouvez ici le document et vos échanges avec l’entreprise."
                : "Retrouvez ici le document et vos échanges avec l’entreprise."}
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg bg-danger-soft p-4 text-sm leading-6 text-danger"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mb-5 rounded-lg border border-primary/20 bg-primary-soft p-4 text-sm leading-6 text-primary"
        >
          {notice}
        </p>
      )}
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card className="min-w-0 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted">Montant du devis</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {formatCents(quote.amount_cents)}
              </p>
            </div>
            <StatusBadge status={quote.status} />
          </div>
          {quote.expires_at && (
            <p className="mt-4 text-sm text-muted">
              Valable jusqu’au {formatDate(quote.expires_at)}.
            </p>
          )}
          <div className="mt-6 border-t border-line pt-5">
            <h2 className="font-semibold">Le document</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Le PDF original contient le détail des prestations et les conditions
              proposées par l’entreprise.
            </p>
            {quote.document_available ? (
              <Button
                className="mt-4 w-full sm:w-auto"
                loading={busy === "download"}
                disabled={Boolean(busy) || loading}
                onClick={download}
              >
                <Download size={16} /> Consulter le PDF
              </Button>
            ) : (
              <p className="mt-4 text-sm text-muted">
                Le PDF n’est pas disponible sur ce lien. Vous pouvez le demander à
                l’entreprise.
              </p>
            )}
          </div>
          {quote.status === "sent" && view.can_respond ? (
            <div className="mt-6 border-t border-line pt-5">
              <h2 className="font-semibold">Votre décision</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Après lecture du devis, indiquez votre décision à l’entreprise. Vous
                pourrez la vérifier avant de confirmer.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  disabled={Boolean(busy) || loading}
                  onClick={() => {
                    setDecision("accepted")
                    setConfirmed(false)
                    setDecisionNote("")
                    setError("")
                  }}
                >
                  <Check size={16} /> Accepter le devis
                </Button>
                <Button
                  variant="secondary"
                  disabled={Boolean(busy) || loading}
                  onClick={() => {
                    setDecision("refused")
                    setConfirmed(false)
                    setDecisionNote("")
                    setError("")
                  }}
                >
                  Refuser le devis
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-6 rounded-lg bg-background p-4 text-sm leading-6 text-muted">
              {quote.status === "accepted"
                ? `Votre accord est enregistré.${view.can_respond ? " Vous pouvez encore échanger avec l’entreprise." : ""}`
                : quote.status === "refused"
                  ? "Le refus de ce devis est enregistré."
                  : "Ce devis n’est plus ouvert aux réponses. Contactez l’entreprise pour poursuivre."}
            </p>
          )}
        </Card>
        <Card
          className="min-w-0 p-5 sm:p-7"
          role="region"
          aria-labelledby="portal-exchanges-title"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2
              id="portal-exchanges-title"
              className="flex min-w-0 items-start gap-2 font-semibold"
            >
              <MessageSquare size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span className="break-words">Échanges avec {quote.company_name}</span>
            </h2>
            <Button
              variant="ghost"
              loading={loading}
              disabled={Boolean(busy) || loading}
              onClick={load}
            >
              <RefreshCw size={16} aria-hidden="true" /> Actualiser
            </Button>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">
            Vos questions et les réponses de l’entreprise restent au même endroit.
            Revenez sur ce lien pour suivre la conversation.
          </p>
          <div className="mt-5">
            <PortalConversation
              messages={view.messages}
              companyName={quote.company_name}
            />
          </div>
          {view.can_respond ? (
            <form className="mt-6 space-y-4 border-t border-line pt-5" onSubmit={ask}>
              <Field label="Votre question" htmlFor="portal-question" required>
                <Textarea
                  id="portal-question"
                  required
                  rows={4}
                  maxLength={2000}
                  value={question}
                  disabled={Boolean(busy) || loading}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Un délai, une prestation ou un point à préciser ?"
                />
              </Field>
              <Button
                type="submit"
                className="w-full sm:w-auto"
                loading={busy === "question"}
                disabled={Boolean(busy) || loading || !question.trim()}
              >
                <Send size={16} aria-hidden="true" /> Envoyer ma question
              </Button>
            </form>
          ) : (
            <p className="mt-5 border-t border-line pt-5 text-sm leading-6 text-muted">
              Les réponses sont fermées pour ce devis. Contactez directement
              l’entreprise.
            </p>
          )}
          {quote.company_email && (
            <a
              href={`mailto:${encodeURIComponent(quote.company_email)}`}
              className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline underline-offset-4"
            >
              <Mail size={16} aria-hidden="true" /> Contacter l’entreprise
            </a>
          )}
        </Card>
      </div>
      <p className="mt-6 text-xs leading-5 text-muted">
        Ce lien est réservé au suivi de ce devis. Toute personne qui le possède peut y
        accéder : évitez de le partager.
      </p>
      {decision && (
        <Dialog
          titleId="portal-decision-title"
          onClose={() => {
            if (!busy) setDecision(null)
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="portal-decision-title" className="text-xl font-semibold">
              {decision === "accepted"
                ? "Confirmer votre accord"
                : "Confirmer votre refus"}
            </h2>
            <Button
              variant="ghost"
              disabled={Boolean(busy) || loading}
              aria-label="Fermer la confirmation"
              onClick={() => setDecision(null)}
            >
              <X size={18} />
            </Button>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted">
            Vous transmettez à {quote.company_name} votre décision concernant le devis{" "}
            <strong className="break-words text-ink">{quote.reference}</strong> de{" "}
            {formatCents(quote.amount_cents)}.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted">
            Cette confirmation sera enregistrée dans le suivi du devis. Elle ne
            constitue pas une signature électronique.
          </p>
          <Field
            label="Un message pour l’entreprise (facultatif)"
            htmlFor="portal-decision-note"
          >
            <Textarea
              id="portal-decision-note"
              className="mt-3"
              maxLength={2000}
              rows={3}
              value={decisionNote}
              disabled={Boolean(busy) || loading}
              onChange={(event) => setDecisionNote(event.target.value)}
            />
          </Field>
          <label className="mt-5 flex items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-primary"
              checked={confirmed}
              disabled={Boolean(busy) || loading}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              {decision === "accepted"
                ? "J’ai consulté le devis et je confirme mon accord."
                : "Je confirme que je refuse ce devis."}
            </span>
          </label>
          {error && (
            <p role="alert" className="mt-4 text-sm leading-6 text-danger">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button
              variant="secondary"
              disabled={Boolean(busy) || loading}
              onClick={() => setDecision(null)}
            >
              Revenir au devis
            </Button>
            <Button
              loading={busy === "decision"}
              disabled={Boolean(busy) || !confirmed}
              onClick={() => respond(decision, decisionNote)}
            >
              {decision === "accepted" ? "Confirmer mon accord" : "Confirmer mon refus"}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
