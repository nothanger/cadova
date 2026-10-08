import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react"
import { useNavigate } from "react-router-dom"
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Mail,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  Settings2,
  Square,
} from "lucide-react"
import { Button, Card, Field, Input, Spinner, Textarea, cx } from "@/components/ui"
import { Dialog } from "@/components/ui/Dialog"
import { useAuth } from "@/features/auth/AuthContext"
import { useAdmin } from "@/features/admin/AdminContext"
import { useCompany } from "@/features/company/CompanyContext"
import { formatCents } from "@/lib/money"
import type { QuoteWithClient } from "@/types"
import { CompanyMessageControl } from "@/features/message-templates/CompanyMessageControl"
import {
  automationError,
  listAutomationJobs,
  loadAutomationContext,
  pauseQuoteAutomation,
  recordQuoteResponse,
  saveQuoteAutomation,
  type FollowupJob,
  type QuoteAutomation,
} from "./automationApi"
import {
  AUTOMATION_VARIABLES,
  automationTemplateError,
  DEFAULT_AUTOMATION_MESSAGES,
  renderAutomationMessage,
} from "./automationMessages"

type ContextData = Awaited<ReturnType<typeof loadAutomationContext>>
type Editor = {
  firstDays: string
  secondDays: string
  subject: string
  body: string
  nextDate: string
}

const datetime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
})
function parisDates() {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Paris",
  }).formatToParts(new Date())
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
  const today = `${value("year")}-${value("month")}-${value("day")}`
  const next = new Date(`${today}T12:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return { today, tomorrow: next.toISOString().slice(0, 10) }
}
function dateLabel(date: string | null) {
  return date && !Number.isNaN(Date.parse(date))
    ? datetime.format(new Date(date))
    : "Aucune date programmée"
}
function editorFrom(config: QuoteAutomation | null): Editor {
  return {
    firstDays: String(config?.first_delay_days ?? 5),
    secondDays: String(config?.second_delay_days ?? 12),
    subject: config?.subject_template ?? DEFAULT_AUTOMATION_MESSAGES.firstSubject,
    body: config?.body_template ?? DEFAULT_AUTOMATION_MESSAGES.firstBody,
    nextDate: "",
  }
}

const stopLabels: Record<string, string> = {
  completed: "Les deux relances sont terminées.",
  accepted: "Le devis a été accepté.",
  refused: "Le devis a été refusé.",
  draft: "Le devis est un brouillon.",
  expired: "Le devis a expiré.",
  response_received: "Une réponse du client a été enregistrée.",
  actor_unavailable: "Le compte ayant activé les relances n’est plus disponible.",
  delivery_unknown: "Le résultat d’un envoi doit être vérifié avant de poursuivre.",
  delivery_failed: "L’envoi a échoué et les relances sont arrêtées.",
  disabled: "Aucun email ne sera envoyé automatiquement pour ce devis.",
}
const jobLabels: Record<FollowupJob["status"], string> = {
  queued: "Programmé",
  processing: "Envoi en cours",
  sent: "Envoyé",
  failed: "Échec",
  cancelled: "Annulé",
  delivery_unknown: "Résultat à vérifier",
}

function ResponseDialog({
  onClose,
  onSubmit,
  busy,
  error,
}: {
  onClose: () => void
  onSubmit: (content: string) => void
  busy: boolean
  error: string
}) {
  const [content, setContent] = useState("")
  return (
    <Dialog titleId="automation-response-title" onClose={() => !busy && onClose()}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (content.trim() && !busy) onSubmit(content)
        }}
      >
        <h2 id="automation-response-title" className="text-xl font-semibold text-ink">
          Marquer une réponse reçue
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Enregistrez ce que le client vous a répondu. Les relances automatiques
          suivantes seront arrêtées.
        </p>
        <div className="mt-5">
          <Field
            htmlFor="automation-response"
            label="Réponse du client"
            required
            hint="4 000 caractères maximum."
          >
            <Textarea
              id="automation-response"
              rows={5}
              maxLength={4000}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
              disabled={busy}
            />
          </Field>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={busy} disabled={!content.trim()}>
            Enregistrer la réponse
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function AutomationContent({
  quote,
  onChanged,
  showHistory = true,
  showResponseAction = true,
  compact = false,
  revision = 0,
}: {
  quote: QuoteWithClient
  onChanged: () => Promise<void>
  showHistory?: boolean
  showResponseAction?: boolean
  compact?: boolean
  revision?: number
}) {
  const navigate = useNavigate()
  const { isAdmin } = useAdmin()
  const { selectCompany } = useCompany()
  const [data, setData] = useState<ContextData | null>(null)
  const [editor, setEditor] = useState<Editor>(editorFrom(null))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const [showEditor, setShowEditor] = useState(!compact)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [responseOpen, setResponseOpen] = useState(false)
  const [jobs, setJobs] = useState<FollowupJob[]>([])
  const [jobPage, setJobPage] = useState(0)
  const [jobsMore, setJobsMore] = useState(false)
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobsError, setJobsError] = useState("")
  const active = useRef(true)
  const request = useRef(0)
  const jobRequest = useRef(0)
  const initialized = useRef(false)
  const locked = useRef(false)
  const contextInput = useMemo(
    () => ({ id: quote.id, company_id: quote.company_id, client_id: quote.client_id }),
    [quote.id, quote.company_id, quote.client_id],
  )
  const load = useCallback(async () => {
    const ticket = ++request.current
    setLoadError("")
    try {
      const result = await loadAutomationContext(contextInput)
      if (!active.current || ticket !== request.current) return
      setData(result)
      if (!initialized.current) {
        setEditor(editorFrom(result.automation))
        setShowEditor(!compact && !result.automation?.enabled)
        initialized.current = true
      }
    } catch (err) {
      if (active.current && ticket === request.current)
        setLoadError(
          automationError(err, "Impossible de charger les relances automatiques."),
        )
    } finally {
      if (active.current && ticket === request.current) setLoading(false)
    }
  }, [contextInput, compact])
  const loadJobs = useCallback(async () => {
    const ticket = ++jobRequest.current
    setJobsLoading(true)
    setJobsError("")
    try {
      const result = await listAutomationJobs(quote.id, jobPage)
      if (!active.current || ticket !== jobRequest.current) return
      setJobs(result.items)
      setJobsMore(result.hasMore)
    } catch (err) {
      if (active.current && ticket === jobRequest.current)
        setJobsError(
          automationError(err, "Impossible de charger l’historique des envois."),
        )
    } finally {
      if (active.current && ticket === jobRequest.current) setJobsLoading(false)
    }
  }, [quote.id, jobPage])
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      request.current++
      jobRequest.current++
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load, quote.status, quote.expires_at, revision])
  useEffect(() => {
    void loadJobs()
    return () => {
      jobRequest.current++
    }
  }, [loadJobs, revision])
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden && !locked.current) {
        void load()
        void loadJobs()
      }
    }
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener("focus", refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [load, loadJobs])

  const config = data?.automation ?? null
  const firstDays = Number(editor.firstDays)
  const secondDays = Number(editor.secondDays)
  const firstError =
    Number.isInteger(firstDays) && firstDays >= 1 && firstDays <= 90
      ? ""
      : "Choisissez un délai entre 1 et 90 jours."
  const secondError =
    Number.isInteger(secondDays) && secondDays > firstDays && secondDays <= 90
      ? ""
      : "Le second délai doit dépasser le premier, jusqu’à 90 jours."
  const subjectError =
    editor.subject.length > 160
      ? "160 caractères maximum."
      : automationTemplateError(editor.subject)
  const bodyError =
    editor.body.length > 4000
      ? "4 000 caractères maximum."
      : automationTemplateError(editor.body)
  const invalid = Boolean(firstError || secondError || subjectError || bodyError)
  const { today: todayParis, tomorrow: tomorrowISO } = parisDates()
  const dateError =
    editor.nextDate && editor.nextDate < tomorrowISO
      ? "Choisissez une date à partir de demain."
      : ""
  const clientEmailValid = Boolean(
    data?.client.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.client.email),
  )
  const eligible =
    quote.status === "sent" &&
    Boolean(quote.sent_at) &&
    (!quote.expires_at || quote.expires_at > todayParis)
  const uncertain =
    config?.stop_reason === "delivery_unknown" ||
    Boolean(data?.hasUnresolvedSend) ||
    jobs.some(
      (job) =>
        job.status === "processing" ||
        job.status === "delivery_unknown" ||
        (job.status === "queued" && job.first_attempt_at !== null),
    )
  const canActivate = Boolean(
    data?.service.ready &&
    data.settings?.reply_to &&
    !data.settings?.automation_paused &&
    clientEmailValid &&
    eligible &&
    !uncertain &&
    !["completed", "response_received"].includes(config?.stop_reason ?? ""),
  )
  const statusLabel = config?.enabled
    ? config.paused || data?.settings?.automation_paused
      ? "En pause"
      : "Actives"
    : config?.stop_reason && config.stop_reason !== "disabled"
      ? "Arrêtées"
      : "Désactivées"

  async function run(action: () => Promise<void>) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError("")
    setNotice("")
    request.current++
    jobRequest.current++
    setJobsLoading(false)
    try {
      await action()
    } catch (err) {
      if (active.current)
        setError(automationError(err, "La modification n’a pas pu être enregistrée."))
    } finally {
      locked.current = false
      if (active.current) setBusy(false)
    }
  }
  async function save(enabled: boolean) {
    if (invalid || dateError || (enabled && !canActivate)) return
    await run(async () => {
      const updated = await saveQuoteAutomation(quote.id, enabled, {
        firstDelayDays: firstDays,
        secondDelayDays: secondDays,
        subject: editor.subject,
        body: editor.body,
        nextSendDate: editor.nextDate,
      })
      if (!active.current) return
      setData((current) => (current ? { ...current, automation: updated } : current))
      setEditor(editorFrom(updated))
      setShowEditor(false)
      setNotice(
        enabled
          ? updated.enabled
            ? config?.enabled
              ? "Les réglages des relances ont été enregistrés."
              : "Les relances automatiques sont activées pour ce devis."
            : updated.stop_reason === "completed"
              ? "Deux relances ont déjà été envoyées pour ce devis. Aucun nouvel envoi n’est programmé."
              : "Aucun nouvel envoi automatique n’a été activé pour ce devis."
          : "Le message et les délais ont été enregistrés. Aucun envoi automatique n’est activé.",
      )
      await loadJobs()
      await onChanged()
    })
  }
  async function togglePause() {
    await run(async () => {
      const updated = await pauseQuoteAutomation(quote.id, !config?.paused)
      if (!active.current) return
      setData((current) => (current ? { ...current, automation: updated } : current))
      setNotice(
        updated.paused
          ? "Les relances de ce devis sont mises en pause."
          : "Les relances de ce devis ont repris.",
      )
      await loadJobs()
      await onChanged()
    })
  }
  async function stop() {
    await run(async () => {
      const updated = await saveQuoteAutomation(quote.id, false)
      if (!active.current) return
      setData((current) => (current ? { ...current, automation: updated } : current))
      setNotice("Les prochaines relances automatiques sont arrêtées.")
      await loadJobs()
      await onChanged()
    })
  }
  async function respond(content: string) {
    await run(async () => {
      await recordQuoteResponse(quote.id, content)
      if (!active.current) return
      setResponseOpen(false)
      setNotice("La réponse a été enregistrée. Les relances suivantes sont arrêtées.")
      await load()
      await loadJobs()
      await onChanged()
    })
  }
  async function openCompanyPage(path: string) {
    await run(async () => {
      if (isAdmin) await selectCompany(quote.company_id)
      if (active.current) navigate(path)
    })
  }
  const values = {
    client_name: data?.client.name ?? "",
    quote_reference: quote.reference,
    company_name: data?.company.name ?? "",
    amount_formatted: formatCents(quote.amount_cents),
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Mail size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-ink">Relances automatiques</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Deux emails maximum pour ce devis, uniquement après votre activation.
            </p>
          </div>
        </div>
        {data && (
          <span
            className={cx(
              "rounded-md border px-2.5 py-1 text-xs font-medium",
              statusLabel === "Actives"
                ? "border-primary/20 bg-primary-soft text-primary"
                : "border-line bg-background text-muted",
            )}
          >
            {statusLabel}
          </span>
        )}
      </div>
      {loading ? (
        <Spinner />
      ) : loadError ? (
        <div className="mt-5">
          <p role="alert" className="text-sm text-danger">
            {loadError}
          </p>
          <Button variant="secondary" className="mt-3" onClick={load}>
            <RefreshCw size={16} aria-hidden="true" /> Réessayer
          </Button>
        </div>
      ) : data ? (
        <>
          {!data.service.ready && (
            <p className="mt-5 rounded-lg border border-warning/20 bg-warning-soft p-3 text-sm leading-6 text-warning">
              Le service email n’est pas encore configuré. Vous pouvez préparer le
              message, mais les envois automatiques restent désactivés.
            </p>
          )}
          {!data.settings?.reply_to && (
            <div className="mt-4 rounded-lg border border-warning/20 bg-warning-soft p-3 text-sm leading-6 text-warning">
              <p>
                Enregistrez une adresse de réponse pour votre entreprise avant d’activer
                les relances.
              </p>
              <Button
                variant="ghost"
                className="mt-1 text-primary"
                onClick={() => void openCompanyPage("/app/settings")}
                disabled={busy}
              >
                Configurer les emails de l’entreprise
              </Button>
            </div>
          )}
          {!clientEmailValid && (
            <div className="mt-4 rounded-lg border border-warning/20 bg-warning-soft p-3 text-sm leading-6 text-warning">
              <p>
                {data.client.email
                  ? "L’adresse email du client doit être corrigée."
                  : "Le client n’a pas d’adresse email."}
              </p>
              <Button
                variant="ghost"
                className="mt-1 text-primary"
                onClick={() =>
                  void openCompanyPage(`/app/clients/${quote.client_id}/edit`)
                }
                disabled={busy}
              >
                Modifier la fiche client
              </Button>
            </div>
          )}
          {!eligible && (
            <p className="mt-4 text-sm leading-6 text-muted">
              L’activation est réservée aux devis envoyés et encore valides.
            </p>
          )}
          {config?.stop_reason && stopLabels[config.stop_reason] && (
            <p className="mt-4 text-sm leading-6 text-muted">
              {stopLabels[config.stop_reason]}
            </p>
          )}
          {data.settings?.automation_paused && (
            <p className="mt-4 text-sm text-warning">
              Les envois automatiques de cette entreprise sont en pause.
            </p>
          )}
          <div className="mt-5 rounded-lg border border-line bg-background p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <CalendarClock size={14} aria-hidden="true" /> Prochaine relance
              automatique
            </p>
            <p className="mt-1 text-sm font-medium text-ink">
              {config?.next_send_at && config.enabled
                ? dateLabel(config.next_send_at)
                : "Aucune date programmée"}
            </p>
            {config?.enabled && (config.paused || data.settings?.automation_paused) && (
              <p className="mt-1 text-xs leading-5 text-muted">
                La date est conservée pendant la pause. Aucun email ne part tant que la
                pause reste active.
              </p>
            )}
            <details
              open={!compact || undefined}
              className="mt-3 border-t border-line pt-3"
            >
              <summary className="min-h-11 cursor-pointer text-xs font-medium text-muted focus-visible:outline-2 focus-visible:outline-primary">
                Vérifier les adresses utilisées
              </summary>
              <dl className="mt-2 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">Destinataire</dt>
                  <dd className="mt-1 break-all text-sm font-medium text-ink">
                    {data.client.email ?? "Adresse manquante"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Adresse de réponse</dt>
                  <dd className="mt-1 break-all text-sm font-medium text-ink">
                    {data.settings?.reply_to ?? "À configurer"}
                  </dd>
                </div>
              </dl>
            </details>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowEditor((value) => !value)}
              aria-expanded={showEditor}
              aria-controls={showEditor ? "automation-editor" : undefined}
              disabled={busy || (uncertain && !showEditor)}
            >
              <Settings2 size={16} aria-hidden="true" />{" "}
              {showEditor ? "Masquer les réglages" : "Modifier les réglages"}
            </Button>
            {!config?.enabled && !showEditor && (
              <Button
                onClick={() => void save(true)}
                loading={busy}
                disabled={invalid || !canActivate}
              >
                <Play size={16} aria-hidden="true" /> Activer les relances automatiques
              </Button>
            )}
            {config?.enabled && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => void togglePause()}
                  loading={busy}
                  disabled={Boolean(data.settings?.automation_paused)}
                >
                  {config.paused ? (
                    <Play size={16} aria-hidden="true" />
                  ) : (
                    <Pause size={16} aria-hidden="true" />
                  )}
                  {config.paused ? "Reprendre les relances" : "Mettre en pause"}
                </Button>
                <Button variant="secondary" onClick={() => void stop()} disabled={busy}>
                  <Square size={15} aria-hidden="true" /> Arrêter les relances
                </Button>
              </>
            )}
            {showResponseAction && (
              <Button
                variant="secondary"
                onClick={() => {
                  setError("")
                  setResponseOpen(true)
                }}
                disabled={busy}
              >
                <MessageSquare size={16} aria-hidden="true" /> Marquer une réponse reçue
              </Button>
            )}
          </div>
          {uncertain && (
            <p className="mt-4 rounded-lg bg-warning-soft p-3 text-sm leading-6 text-warning">
              Un envoi est en cours ou son résultat reste à vérifier. Le message ne peut
              pas être modifié pour le moment.
            </p>
          )}
          {showEditor && (
            <form
              id="automation-editor"
              className="mt-6 space-y-5 border-t border-line pt-6"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault()
                void save(Boolean(config?.enabled))
              }}
            >
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  Délais depuis l’envoi du devis
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Par défaut : une relance à J+5, puis une à J+12. Si ces dates sont
                  dépassées, le premier envoi est reporté à demain, avec le même
                  intervalle.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  htmlFor="automation-first-delay"
                  label="Première relance après"
                  error={firstError}
                  hint="En jours depuis la date d’envoi."
                >
                  <Input
                    id="automation-first-delay"
                    type="number"
                    min={1}
                    max={90}
                    step={1}
                    value={editor.firstDays}
                    onChange={(event) =>
                      setEditor((current) => ({
                        ...current,
                        firstDays: event.target.value,
                      }))
                    }
                    disabled={busy || uncertain}
                    required
                  />
                </Field>
                <Field
                  htmlFor="automation-second-delay"
                  label="Deuxième relance après"
                  error={secondError}
                  hint="En jours depuis la date d’envoi."
                >
                  <Input
                    id="automation-second-delay"
                    type="number"
                    min={2}
                    max={90}
                    step={1}
                    value={editor.secondDays}
                    onChange={(event) =>
                      setEditor((current) => ({
                        ...current,
                        secondDays: event.target.value,
                      }))
                    }
                    disabled={busy || uncertain}
                    required
                  />
                </Field>
              </div>
              {config?.enabled && (
                <Field
                  htmlFor="automation-next-date"
                  label="Reporter la prochaine relance automatique"
                  hint="Facultatif. À partir de demain, à 9 h, heure de Paris."
                  error={dateError || undefined}
                >
                  <Input
                    id="automation-next-date"
                    type="date"
                    min={tomorrowISO}
                    value={editor.nextDate}
                    onChange={(event) =>
                      setEditor((current) => ({
                        ...current,
                        nextDate: event.target.value,
                      }))
                    }
                    disabled={busy || uncertain}
                  />
                </Field>
              )}
              <CompanyMessageControl
                companyId={quote.company_id}
                kind="automatic_followup"
                mode="template"
                values={values}
                current={{ subject: editor.subject, body: editor.body }}
                disabled={busy || uncertain}
                onApply={(draft) =>
                  setEditor((current) => ({
                    ...current,
                    subject: draft.subject,
                    body: draft.body,
                  }))
                }
              />
              <Field
                htmlFor="automation-subject"
                label="Objet de la relance"
                error={subjectError}
                hint="160 caractères maximum."
              >
                <Input
                  id="automation-subject"
                  maxLength={160}
                  value={editor.subject}
                  onChange={(event) =>
                    setEditor((current) => ({
                      ...current,
                      subject: event.target.value,
                    }))
                  }
                  disabled={busy || uncertain}
                  required
                />
              </Field>
              <Field
                htmlFor="automation-body"
                label="Message de relance automatique"
                error={bodyError}
                hint="Le même message est utilisé pour les deux relances. 4 000 caractères maximum."
              >
                <Textarea
                  id="automation-body"
                  rows={7}
                  maxLength={4000}
                  value={editor.body}
                  onChange={(event) =>
                    setEditor((current) => ({ ...current, body: event.target.value }))
                  }
                  disabled={busy || uncertain}
                  required
                />
              </Field>
              <div className="text-xs leading-6 text-muted">
                <p>Ces variables sont remplacées par les informations du dossier :</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {AUTOMATION_VARIABLES.map((variable) => (
                    <li
                      key={variable}
                      className="rounded-md border border-line bg-background px-2 py-1 font-mono text-[11px]"
                    >{`{{${variable}}}`}</li>
                  ))}
                </ul>
              </div>
              <p className="text-xs leading-5 text-muted">
                Les réponses arrivent dans votre messagerie. Enregistrez une réponse
                reçue dans Cadova pour arrêter les relances suivantes.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  disabled={invalid}
                >
                  <Eye size={16} aria-hidden="true" /> Voir l’aperçu
                </Button>
                <Button
                  variant="secondary"
                  type="submit"
                  loading={busy}
                  disabled={
                    invalid ||
                    Boolean(dateError) ||
                    uncertain ||
                    Boolean(config?.enabled && !canActivate)
                  }
                >
                  <Check size={16} aria-hidden="true" /> Enregistrer les réglages
                </Button>
                {!config?.enabled && (
                  <Button
                    type="button"
                    onClick={() => void save(true)}
                    loading={busy}
                    disabled={invalid || !canActivate}
                  >
                    <Play size={16} aria-hidden="true" /> Activer les relances
                    automatiques
                  </Button>
                )}
              </div>
            </form>
          )}
          {error && !responseOpen && (
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
          {showHistory && (
            <details className="mt-6 border-t border-line pt-5">
              <summary className="cursor-pointer text-sm font-semibold text-ink focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                Historique des envois automatiques
              </summary>
              <div className="mt-4 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink">Envois enregistrés</h3>
                <Button
                  variant="ghost"
                  aria-label="Actualiser les envois automatiques"
                  onClick={() => {
                    void load()
                    void loadJobs()
                  }}
                  disabled={busy || jobsLoading}
                >
                  <RefreshCw size={16} aria-hidden="true" />
                </Button>
              </div>
              {jobsError ? (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {jobsError}
                </p>
              ) : jobsLoading ? (
                <Spinner label="Chargement des envois…" />
              ) : jobs.length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  Aucun envoi automatique enregistré.
                </p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {jobs.map((job) => (
                    <li key={job.id} className="rounded-lg border border-line p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink">
                          Relance {job.step}
                        </p>
                        <span
                          className={cx(
                            "rounded-md px-2 py-0.5 text-xs font-medium",
                            job.status === "sent"
                              ? "bg-success-soft text-success"
                              : ["failed", "delivery_unknown"].includes(job.status)
                                ? "bg-warning-soft text-warning"
                                : "bg-background text-muted",
                          )}
                        >
                          {jobLabels[job.status]}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted">
                        {job.status === "sent"
                          ? job.sent_at
                            ? `Acceptée par le service d’envoi le ${dateLabel(job.sent_at)}.`
                            : "Acceptée par le service d’envoi."
                          : `Date prévue : ${dateLabel(job.scheduled_at)}.`}
                      </p>
                      {job.status === "queued" && job.attempts > 0 && (
                        <p className="mt-1 text-xs leading-5 text-muted">
                          {job.next_attempt_at
                            ? `Nouvel essai automatique prévu le ${dateLabel(job.next_attempt_at)}.`
                            : "Aucune nouvelle tentative planifiée."}
                        </p>
                      )}
                      {job.status === "delivery_unknown" && (
                        <p className="mt-2 text-xs leading-5 text-warning">
                          Le service n’a pas confirmé le résultat. Aucun nouvel essai
                          automatique n’est effectué pour éviter un doublon.
                        </p>
                      )}
                      {job.status === "failed" && (
                        <p className="mt-2 text-xs leading-5 text-warning">
                          L’envoi a échoué. Vérifiez les coordonnées du client ou
                          contactez Cadova.
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {(jobPage > 0 || jobsMore) && (
                <nav
                  aria-label="Pagination des envois automatiques"
                  className="mt-4 flex flex-wrap items-center justify-between gap-2"
                >
                  <Button
                    variant="secondary"
                    aria-label="Envois plus récents"
                    disabled={jobPage === 0 || jobsLoading}
                    onClick={() => {
                      setJobs([])
                      setJobPage((page) => page - 1)
                    }}
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                  </Button>
                  <p className="text-xs text-muted">Page {jobPage + 1}</p>
                  <Button
                    variant="secondary"
                    aria-label="Envois précédents"
                    disabled={!jobsMore || jobsLoading}
                    onClick={() => {
                      setJobs([])
                      setJobPage((page) => page + 1)
                    }}
                  >
                    <ChevronRight size={16} aria-hidden="true" />
                  </Button>
                </nav>
              )}
            </details>
          )}
        </>
      ) : null}
      {previewOpen && data && (
        <Dialog
          titleId="automation-preview-title"
          onClose={() => setPreviewOpen(false)}
        >
          <h2 id="automation-preview-title" className="text-xl font-semibold text-ink">
            Aperçu de la relance automatique
          </h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Destinataire</dt>
              <dd className="mt-1 break-all text-ink">
                {data.client.email ?? "Adresse manquante"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Nom affiché</dt>
              <dd className="mt-1 break-words text-ink">{data.company.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Adresse de réponse</dt>
              <dd className="mt-1 break-all text-ink">
                {data.settings?.reply_to ?? "À configurer"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Objet</dt>
              <dd className="mt-1 break-words font-medium text-ink">
                {renderAutomationMessage(editor.subject, values)}
              </dd>
            </div>
          </dl>
          <p className="mt-5 whitespace-pre-wrap break-words rounded-lg border border-line bg-background p-4 text-sm leading-7 text-ink-soft">
            {renderAutomationMessage(editor.body, values)}
          </p>
          <Button
            variant="secondary"
            className="mt-6"
            onClick={() => setPreviewOpen(false)}
          >
            Fermer l’aperçu
          </Button>
        </Dialog>
      )}
      {responseOpen && (
        <ResponseDialog
          onClose={() => setResponseOpen(false)}
          onSubmit={(content) => void respond(content)}
          busy={busy}
          error={error}
        />
      )}
    </Card>
  )
}

export function AutomationPanel(props: {
  quote: QuoteWithClient
  onChanged: () => Promise<void>
  showHistory?: boolean
  showResponseAction?: boolean
  compact?: boolean
  revision?: number
}) {
  const { user } = useAuth()
  return (
    <AutomationContent
      key={`${user?.id}:${props.quote.id}:${props.quote.company_id}`}
      {...props}
    />
  )
}
