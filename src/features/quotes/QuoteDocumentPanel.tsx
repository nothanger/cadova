import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { Check, Download, FileText, RefreshCw, Send, Upload, X } from "lucide-react"
import { Button, Card, Field, Input, Spinner, Textarea } from "@/components/ui"
import { Dialog } from "@/components/ui/Dialog"
import type { QuoteWithClient } from "@/types"
import { formatCents } from "@/lib/money"
import { CompanyMessageControl } from "@/features/message-templates/CompanyMessageControl"
import {
  attachQuoteDocument,
  documentError,
  downloadQuoteDocument,
  getInitialSendJob,
  initialSendError,
  loadDocumentContext,
  sendQuoteDocument,
  type InitialSendJob,
} from "./documentApi"

type Context = Awaited<ReturnType<typeof loadDocumentContext>>

/** Mounted with a user/quote key: a late request never replaces another workspace. */
export function QuoteDocumentPanel({
  quote,
  onChanged,
}: {
  quote: QuoteWithClient
  onChanged: () => Promise<void>
}) {
  const [context, setContext] = useState<Context | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [recipient, setRecipient] = useState("")
  const [subject, setSubject] = useState(`Devis ${quote.reference}`)
  const [message, setMessage] = useState(
    `Bonjour,\n\nVous trouverez en pièce jointe le devis ${quote.reference}. Je reste disponible pour toute question.\n\nBien cordialement,`,
  )
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState<"send" | "upload" | "download" | "refresh" | null>(
    null,
  )
  const active = useRef(true)
  const locked = useRef(false)
  const request = useRef(0)
  const jobRequest = useRef(0)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const ticket = ++request.current
    setLoading(true)
    setError("")
    try {
      const data = await loadDocumentContext(quote)
      if (!active.current || request.current !== ticket) return
      setContext(data)
      setRecipient(data.job?.recipient_email ?? data.client.email ?? "")
      if (data.job) {
        setSubject(data.job.subject)
        setMessage(data.job.body)
      }
    } catch (e) {
      if (active.current && request.current === ticket)
        setError(
          documentError(
            e,
            "Impossible de charger le document et les informations d’envoi.",
          ),
        )
    } finally {
      if (active.current && request.current === ticket) setLoading(false)
    }
    // The parent remounts this component whenever the quote or account changes.
  }, [quote.id])

  useEffect(() => {
    active.current = true
    void load()
    return () => {
      active.current = false
      request.current++
      jobRequest.current++
    }
  }, [load])

  const refreshJob = useCallback(async () => {
    const ticket = ++jobRequest.current
    const job = await getInitialSendJob(quote.id)
    if (!active.current || ticket !== jobRequest.current) return
    setContext((current) => {
      if (!current || (current.job?.status === "sent" && job?.status !== "sent"))
        return current
      return { ...current, job }
    })
    if (job?.status === "sent") await onChanged()
  }, [quote.id, onChanged])

  const job = context?.job
  const pending = job?.status === "preparing" || job?.status === "processing"
  const unknown = job?.status === "delivery_unknown"
  const sent =
    quote.status !== "draft" || Boolean(quote.sent_at) || job?.status === "sent"
  const frozen = pending || unknown || sent
  const canReconcile =
    Boolean(job?.provider_message_id) ||
    Boolean(
      job?.first_attempt_at &&
      Date.now() - Date.parse(job.first_attempt_at) < 23 * 60 * 60 * 1000 &&
      job.attempts < 5,
    )

  // Poll metadata only. A refresh must never send an email.
  useEffect(() => {
    if (!pending) return
    let attempts = 0
    let running = false
    const timer = setInterval(() => {
      if (running) return
      if (++attempts > 20) {
        clearInterval(timer)
        return
      }
      running = true
      void refreshJob()
        .catch(() => {})
        .finally(() => {
          running = false
        })
    }, 3000)
    return () => clearInterval(timer)
  }, [pending, refreshJob])

  async function perform(kind: NonNullable<typeof busy>, action: () => Promise<void>) {
    if (locked.current) return
    locked.current = true
    setBusy(kind)
    setError("")
    try {
      await action()
    } catch (e) {
      if (active.current)
        setError(
          documentError(
            e,
            "L’opération n’a pas pu être confirmée. Actualisez le devis avant de réessayer.",
          ),
        )
    } finally {
      locked.current = false
      if (active.current) setBusy(null)
    }
  }

  function confirmPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      !busy &&
      context?.document &&
      context.settings?.reply_to &&
      context.service.ready &&
      !sent
    )
      setPreview(true)
  }

  async function send() {
    await perform("send", async () => {
      try {
        const result = await sendQuoteDocument(quote.id, {
          recipientEmail: recipient,
          subject,
          message,
          retry: Boolean(job),
        })
        if (!active.current) return
        setPreview(false)
        if (result.job)
          setContext((current) =>
            current ? { ...current, job: result.job! } : current,
          )
        if (result.state === "failed")
          setError(initialSendError(result.error ?? result.job?.last_error_code))
        // Re-read persisted state, including the quote date and history.
        await refreshJob()
      } catch (e) {
        if (active.current) setPreview(false)
        await refreshJob().catch(() => {})
        throw e
      }
    })
  }

  async function attach(file: File) {
    await perform("upload", async () => {
      const document = await attachQuoteDocument(quote, file)
      if (active.current)
        setContext((current) => (current ? { ...current, document } : current))
    })
  }

  async function download() {
    if (!context?.document) return
    const document = context.document
    await perform("download", async () => {
      const blob = await downloadQuoteDocument(document)
      if (!active.current) return
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement("a")
      anchor.href = url
      anchor.download = document.file_name
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    })
  }

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-semibold text-ink">
        <FileText size={19} aria-hidden="true" /> Document et envoi
      </h2>
      {loading ? (
        <Spinner />
      ) : (
        <>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger"
            >
              {error}
            </p>
          )}
          {!context ? (
            <Button className="mt-4" variant="secondary" onClick={load}>
              Réessayer
            </Button>
          ) : (
            <>
              {context.document ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-medium">
                      {context.document.file_name}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      PDF · {Math.max(1, Math.ceil(context.document.size_bytes / 1024))}{" "}
                      Ko · Accès privé
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    loading={busy === "download"}
                    disabled={Boolean(busy)}
                    onClick={download}
                  >
                    <Download size={16} /> Télécharger
                  </Button>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-sm leading-6 text-muted">
                    {sent
                      ? "Aucun document joint à ce devis."
                      : "Ajoutez le PDF original pour l’envoyer directement à votre client."}
                  </p>
                  {!sent && (
                    <>
                      <input
                        ref={fileInput}
                        className="sr-only"
                        type="file"
                        accept="application/pdf,.pdf"
                        aria-label="Ajouter le PDF du devis"
                        disabled={Boolean(busy)}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          event.target.value = ""
                          if (file) void attach(file)
                        }}
                      />
                      <Button
                        className="mt-3"
                        variant="secondary"
                        loading={busy === "upload"}
                        disabled={Boolean(busy)}
                        onClick={() => fileInput.current?.click()}
                      >
                        <Upload size={16} /> Ajouter le PDF
                      </Button>
                      <p className="mt-2 text-xs text-muted">10 Mo maximum.</p>
                    </>
                  )}
                </div>
              )}

              {job && <SendState job={job} />}
              {(pending || unknown) && (
                <Button
                  className="mt-3"
                  variant="secondary"
                  loading={busy === "refresh"}
                  disabled={Boolean(busy)}
                  onClick={() => perform("refresh", refreshJob)}
                >
                  <RefreshCw size={16} /> Actualiser l’état
                </Button>
              )}
              {sent && !job && (
                <p className="mt-4 text-sm leading-6 text-muted">
                  Ce devis est déjà suivi. Aucun email ne sera envoyé depuis cet écran.
                </p>
              )}

              {!sent && context.document && (
                <>
                  {!context.settings?.reply_to && (
                    <p className="mt-4 text-sm leading-6 text-muted">
                      Renseignez votre adresse de réponse dans les{" "}
                      <Link
                        to="/app/settings"
                        className="font-medium text-primary underline"
                      >
                        paramètres de l’entreprise
                      </Link>{" "}
                      pour que le client puisse vous répondre.
                    </p>
                  )}
                  {!context.service.ready && (
                    <p className="mt-4 text-sm text-muted">
                      Le service email n’est pas disponible pour le moment. Votre
                      brouillon reste enregistré.
                    </p>
                  )}
                  <form className="mt-5 space-y-4" onSubmit={confirmPreview}>
                    <CompanyMessageControl
                      companyId={quote.company_id}
                      kind="quote_send"
                      values={{
                        client_name: context.client.name,
                        quote_reference: quote.reference,
                        company_name: "",
                        amount_formatted: formatCents(quote.amount_cents),
                      }}
                      current={{ subject, body: message }}
                      disabled={
                        frozen || Boolean(busy) || Boolean(job?.first_attempt_at)
                      }
                      onApply={(draft) => {
                        setSubject(draft.subject)
                        setMessage(draft.body)
                      }}
                    />
                    <Field label="Destinataire" htmlFor="quote-recipient" required>
                      <Input
                        id="quote-recipient"
                        type="email"
                        required
                        maxLength={254}
                        autoComplete="email"
                        value={recipient}
                        disabled={frozen || Boolean(busy)}
                        onChange={(e) => setRecipient(e.target.value)}
                      />
                    </Field>
                    <Field label="Objet" htmlFor="quote-subject" required>
                      <Input
                        id="quote-subject"
                        required
                        maxLength={160}
                        value={subject}
                        disabled={frozen || Boolean(busy)}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </Field>
                    <Field label="Message au client" htmlFor="quote-message" required>
                      <Textarea
                        id="quote-message"
                        required
                        maxLength={4000}
                        rows={6}
                        value={message}
                        disabled={frozen || Boolean(busy)}
                        onChange={(e) => setMessage(e.target.value)}
                      />
                    </Field>
                    {context.settings?.reply_to && (
                      <p className="break-words text-xs leading-5 text-muted">
                        Envoyé par Cadova pour votre entreprise. Les réponses arrivent à{" "}
                        {context.settings.reply_to}.
                      </p>
                    )}
                    {(!unknown || canReconcile) && (
                      <Button
                        type="submit"
                        disabled={
                          Boolean(busy) ||
                          !context.settings?.reply_to ||
                          !context.service.ready ||
                          !recipient.trim() ||
                          !subject.trim() ||
                          !message.trim()
                        }
                      >
                        <Send size={16} />{" "}
                        {pending || unknown
                          ? "Vérifier et reprendre l’envoi"
                          : job?.status === "failed"
                            ? "Vérifier et réessayer"
                            : "Vérifier avant d’envoyer"}
                      </Button>
                    )}
                    {unknown && !canReconcile && (
                      <p className="text-sm leading-6 text-muted">
                        Contactez l’administrateur pour vérifier cet envoi auprès du
                        service email. Un nouvel envoi est bloqué pour éviter un
                        doublon.
                      </p>
                    )}
                  </form>
                </>
              )}
            </>
          )}
        </>
      )}
      {preview && context?.document && (
        <Dialog
          titleId="quote-send-title"
          onClose={() => {
            if (!busy) setPreview(false)
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="quote-send-title" className="text-lg font-semibold">
              Envoyer ce devis au client
            </h2>
            <Button
              variant="ghost"
              aria-label="Fermer la vérification"
              disabled={Boolean(busy)}
              onClick={() => setPreview(false)}
            >
              <X size={18} />
            </Button>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="text-muted">À</dt>
              <dd className="break-all font-medium">{recipient}</dd>
            </div>
            <div>
              <dt className="text-muted">Objet</dt>
              <dd className="break-words font-medium">{subject}</dd>
            </div>
            <div>
              <dt className="text-muted">Pièce jointe</dt>
              <dd className="break-all">{context.document.file_name}</dd>
            </div>
          </dl>
          <p className="mt-5 whitespace-pre-wrap break-words rounded-lg bg-background p-4 text-sm leading-6">
            {message}
          </p>
          <p className="mt-4 text-sm leading-6 text-muted">
            {pending || unknown
              ? "Cette action reprend le même envoi avec une protection contre les doublons."
              : "Le PDF sera envoyé à cette adresse. Le devis passera en « Envoyé » lorsque le service email aura accepté le message."}{" "}
            Les relances automatiques s’activent séparément dans le suivi du devis.
          </p>
          <p className="mt-3 rounded-lg border border-primary/20 bg-primary-soft/40 p-3 text-sm leading-6 text-ink-soft">
            L’email inclura aussi un lien privé : le client pourra consulter le devis,
            poser une question ou vous transmettre sa décision sans créer de compte.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              disabled={Boolean(busy)}
              onClick={() => setPreview(false)}
            >
              Revenir au message
            </Button>
            <Button loading={busy === "send"} disabled={Boolean(busy)} onClick={send}>
              <Send size={16} />{" "}
              {pending || unknown ? "Reprendre cet envoi" : "Envoyer le devis"}
            </Button>
          </div>
        </Dialog>
      )}
    </Card>
  )
}

function SendState({ job }: { job: InitialSendJob }) {
  if (job.status === "sent")
    return (
      <p role="status" className="mt-4 flex gap-2 text-sm leading-6 text-ink">
        <Check size={18} className="mt-0.5 shrink-0 text-primary" />
        <span>
          Devis envoyé à{" "}
          <span className="break-all font-medium">{job.recipient_email}</span>. Le
          service email a accepté le message et sa pièce jointe.
        </span>
      </p>
    )
  if (job.status === "delivery_unknown")
    return (
      <p
        role="status"
        className="mt-4 rounded-lg bg-warning-soft p-3 text-sm leading-6 text-warning"
      >
        L’envoi reste à confirmer. Le message a peut-être été accepté par le service
        email. Actualisez son état avant de reprendre le même envoi.
      </p>
    )
  if (job.status === "failed")
    return (
      <p
        role="status"
        className="mt-4 rounded-lg bg-danger-soft p-3 text-sm leading-6 text-danger"
      >
        {initialSendError(job.last_error_code)}
      </p>
    )
  if (job.status === "preparing" || job.status === "processing")
    return (
      <p role="status" className="mt-4 text-sm leading-6 text-muted">
        Envoi en cours de vérification. Vous pouvez actualiser son état sans renvoyer le
        message.
      </p>
    )
  return null
}
