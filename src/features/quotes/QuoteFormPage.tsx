import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Check, UserPlus } from "lucide-react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  Select,
  Spinner,
  Textarea,
  statusLabel,
} from "@/components/ui"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import { listClients } from "@/features/clients/api"
import { getQuote, listQuotes, updateQuote, type QuoteInput } from "./api"
import { documentError, saveImportedQuote } from "./documentApi"
import { QuoteImportPanel, type PreparedQuoteDocument } from "./QuoteImportPanel"
import { humanizeError } from "@/lib/errors"
import { centsToInput, parseAmountToCents } from "@/lib/money"
import { todayISO } from "@/lib/dates"
import type { Client, QuoteStatus, QuoteWithClient } from "@/types"

interface FormState {
  client_id: string
  reference: string
  amount: string
  status: QuoteStatus
  sent_at: string
  expires_at: string
  notes: string
}
interface NewClient {
  name: string
  email: string
  phone: string
}

const statuses: QuoteStatus[] = ["draft", "sent", "accepted", "refused"]
const normalizedEmail = (value: string) => value.trim().toLowerCase()
const normalizedPhone = (value: string) =>
  value.replace(/[\s().-]/g, "").replace(/^00/, "+")

function matchingClients(clients: Client[], email: string, phone: string): Client[] {
  const emailKey = normalizedEmail(email)
  const phoneKey = normalizedPhone(phone)
  return clients.filter(
    (client) =>
      (emailKey && client.email && normalizedEmail(client.email) === emailKey) ||
      (phoneKey.length >= 8 &&
        client.phone &&
        normalizedPhone(client.phone) === phoneKey),
  )
}

// A scope change unmounts the reader and discards unsaved fields immediately.
export function QuoteFormPage({ mode }: { mode: "new" | "edit" }) {
  const { quoteId } = useParams()
  const [params] = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { company, loading: companyLoading } = useCompany()
  if (authLoading || companyLoading) return <Spinner />
  if (!company || !user)
    return (
      <ErrorState message="Sélectionnez une entreprise pour ouvrir ce formulaire." />
    )
  return (
    <ScopedQuoteForm
      key={`${user.id}:${company.id}:${mode}:${quoteId ?? "new"}`}
      mode={mode}
      companyId={company.id}
      quoteId={quoteId}
      initialClientId={params.get("client") ?? ""}
    />
  )
}

function ScopedQuoteForm({
  mode,
  companyId,
  quoteId,
  initialClientId,
}: {
  mode: "new" | "edit"
  companyId: string
  quoteId?: string
  initialClientId: string
}) {
  const navigate = useNavigate()
  const mounted = useRef(true)
  const submitLocked = useRef(false)
  const submitController = useRef<AbortController | null>(null)
  const touched = useRef(new Set<string>())
  const inferred = useRef<Record<string, string>>({})
  const [clients, setClients] = useState<Client[]>([])
  const [quotes, setQuotes] = useState<QuoteWithClient[]>([])
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing")
  const [newClient, setNewClient] = useState<NewClient>({
    name: "",
    email: "",
    phone: "",
  })
  const [form, setForm] = useState<FormState>({
    client_id: initialClientId,
    reference: "",
    amount: "",
    status: "draft",
    sent_at: "",
    expires_at: "",
    notes: "",
  })
  const [importedDocument, setImportedDocument] = useState<File | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [clientNotice, setClientNotice] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [retry, setRetry] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      submitController.current?.abort()
    }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError("")
    async function init() {
      try {
        const [loadedClients, loadedQuotes, quote] = await Promise.all([
          listClients(companyId),
          listQuotes(companyId),
          mode === "edit" && quoteId ? getQuote(quoteId) : Promise.resolve(null),
        ])
        if (!active) return
        if (quote && quote.company_id !== companyId)
          throw new Error("quote_scope_mismatch")
        setClients(loadedClients)
        setQuotes(loadedQuotes)
        if (quote) {
          setForm({
            client_id: quote.client_id,
            reference: quote.reference,
            amount: centsToInput(quote.amount_cents),
            status: quote.status,
            sent_at: quote.sent_at ?? "",
            expires_at: quote.expires_at ?? "",
            notes: quote.notes ?? "",
          })
        } else {
          const hasInitialClient = loadedClients.some(
            (client) => client.id === initialClientId,
          )
          setForm((current) => ({
            ...current,
            client_id: hasInitialClient ? initialClientId : "",
          }))
          setClientMode(loadedClients.length ? "existing" : "new")
        }
      } catch (err) {
        if (active)
          setLoadError(humanizeError(err, "Le formulaire n’a pas pu être chargé."))
      } finally {
        if (active) setLoading(false)
      }
    }
    void init()
    return () => {
      active = false
    }
  }, [companyId, mode, quoteId, initialClientId, retry])

  const amountCents = useMemo(() => parseAmountToCents(form.amount), [form.amount])
  const dateRequired = form.status !== "draft"
  const alreadySent = mode === "new" && form.status === "sent"
  const duplicate = quotes.find(
    (quote) =>
      quote.id !== quoteId &&
      quote.reference.trim().toLowerCase() === form.reference.trim().toLowerCase(),
  )
  const possibleClients =
    clientMode === "new"
      ? matchingClients(clients, newClient.email, newClient.phone)
      : []
  const selectedClient = clients.find((client) => client.id === form.client_id)
  const backTo = mode === "edit" && quoteId ? `/app/quotes/${quoteId}` : "/app/quotes"

  function change<K extends keyof FormState>(key: K, value: FormState[K]) {
    touched.current.add(key)
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [key]: "" }))
  }

  function changeNewClient(key: keyof NewClient, value: string) {
    touched.current.add(`client_${key}`)
    touched.current.add("client_id")
    setNewClient((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [`client_${key}`]: "" }))
    setClientNotice("")
  }

  function onPrepared(document: PreparedQuoteDocument | null) {
    setImportedDocument(document?.pdf ?? null)
    if (!document) {
      const previous = inferred.current
      inferred.current = {}
      const keep = (key: string, value: string) =>
        touched.current.has(key) || previous[key] !== value ? value : ""
      setForm((current) => ({
        ...current,
        reference: keep("reference", current.reference),
        amount: keep("amount", current.amount),
        expires_at: keep("expires_at", current.expires_at),
        client_id: keep("client_id", current.client_id),
      }))
      setNewClient((current) => ({
        name: keep("client_name", current.name),
        email: keep("client_email", current.email),
        phone: keep("client_phone", current.phone),
      }))
      if (!touched.current.has("client_id")) {
        setClientMode(clients.length ? "existing" : "new")
        setClientNotice("")
      }
      return
    }
    const { fields } = document
    for (const [key, value, current] of [
      ["reference", fields.reference, form.reference],
      ["amount", fields.amount, form.amount],
      ["expires_at", fields.expiresAt, form.expires_at],
    ] as const) {
      if (value && !touched.current.has(key) && !current) inferred.current[key] = value
    }
    setForm((current) => ({
      ...current,
      reference:
        !touched.current.has("reference") && !current.reference
          ? (fields.reference ?? "")
          : current.reference,
      amount:
        !touched.current.has("amount") && !current.amount
          ? (fields.amount ?? "")
          : current.amount,
      expires_at:
        !touched.current.has("expires_at") && !current.expires_at
          ? (fields.expiresAt ?? "")
          : current.expires_at,
    }))
    if (touched.current.has("client_id") || form.client_id) return
    const matches = matchingClients(
      clients,
      fields.clientEmail ?? "",
      fields.clientPhone ?? "",
    )
    if (matches.length === 1) {
      inferred.current.client_id = matches[0].id
      setClientMode("existing")
      setForm((current) => ({ ...current, client_id: matches[0].id }))
      setClientNotice(
        "Client retrouvé par ses coordonnées. Vérifiez qu’il s’agit du bon destinataire.",
      )
    } else if (fields.clientName || fields.clientEmail || fields.clientPhone) {
      for (const [key, value, current] of [
        ["client_name", fields.clientName, newClient.name],
        ["client_email", fields.clientEmail, newClient.email],
        ["client_phone", fields.clientPhone, newClient.phone],
      ] as const) {
        if (value && !touched.current.has(key) && !current)
          inferred.current[key] = value
      }
      setClientMode("new")
      setNewClient((current) => ({
        name:
          !touched.current.has("client_name") && !current.name
            ? (fields.clientName ?? "")
            : current.name,
        email:
          !touched.current.has("client_email") && !current.email
            ? (fields.clientEmail ?? "")
            : current.email,
        phone:
          !touched.current.has("client_phone") && !current.phone
            ? (fields.clientPhone ?? "")
            : current.phone,
      }))
      setClientNotice(
        matches.length > 1
          ? "Ces coordonnées correspondent à plusieurs clients. Choisissez le bon dossier ci-dessous."
          : "Vérifiez les coordonnées du client avant de créer sa fiche.",
      )
    }
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (clientMode === "existing") {
      if (!selectedClient)
        errs.client_id = "Sélectionnez un client de cette entreprise."
    } else {
      if (!newClient.name.trim()) errs.client_name = "Le nom du client est obligatoire."
      if (
        newClient.email.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClient.email.trim())
      )
        errs.client_email = "Vérifiez l’adresse email du client."
      if (possibleClients.length)
        errs.client_email =
          "Ces coordonnées sont déjà utilisées. Sélectionnez un client existant ci-dessus."
    }
    if (!form.reference.trim()) errs.reference = "La référence est obligatoire."
    else if (duplicate)
      errs.reference = "Un devis porte déjà cette référence dans votre entreprise."
    if (amountCents === null || !Number.isSafeInteger(amountCents))
      errs.amount = "Montant invalide (ex. 1250,50)."
    if (dateRequired && !form.sent_at)
      errs.sent_at = "Indiquez la date à laquelle le devis a été envoyé."
    else if (mode === "new" && alreadySent && form.sent_at > todayISO())
      errs.sent_at = "La date d’un envoi déjà effectué ne peut pas être dans le futur."
    if (
      form.expires_at &&
      (mode === "edit" || alreadySent) &&
      form.sent_at &&
      form.expires_at < form.sent_at
    )
      errs.expires_at =
        "La date de validité doit être égale ou postérieure à la date d’envoi."
    setFieldErrors(errs)
    if (Object.keys(errs).length) {
      requestAnimationFrame(() =>
        window.document.getElementById(Object.keys(errs)[0])?.focus(),
      )
      return false
    }
    return true
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitLocked.current || importBusy || !validate()) return
    submitLocked.current = true
    setError("")
    setSubmitting(true)
    const controller = new AbortController()
    submitController.current = controller
    try {
      if (mode === "edit" && quoteId) {
        const payload: QuoteInput = {
          client_id: form.client_id,
          reference: form.reference,
          amount_cents: amountCents ?? 0,
          status: form.status,
          sent_at: form.sent_at || null,
          expires_at: form.expires_at || null,
          notes: form.notes,
        }
        await updateQuote(quoteId, payload)
        if (mounted.current) navigate(`/app/quotes/${quoteId}`, { replace: true })
      } else {
        const created = await saveImportedQuote(
          companyId,
          {
            clientId: clientMode === "existing" ? form.client_id : null,
            newClient:
              clientMode === "new"
                ? {
                    name: newClient.name.trim(),
                    email: newClient.email.trim(),
                    phone: newClient.phone.trim(),
                  }
                : null,
            reference: form.reference.trim(),
            amountCents: amountCents ?? 0,
            notes: form.notes,
            alreadySent,
            sentAt: alreadySent ? form.sent_at : null,
            expiresAt: form.expires_at || null,
            document: importedDocument,
          },
          { signal: controller.signal },
        )
        if (mounted.current) navigate(`/app/quotes/${created.id}`, { replace: true })
      }
    } catch (err) {
      if (mounted.current) {
        setError(
          documentError(
            err,
            "Le devis n’a pas pu être enregistré. Vos informations sont conservées, vous pouvez réessayer.",
          ),
        )
        setSubmitting(false)
        submitLocked.current = false
      }
    } finally {
      if (submitController.current === controller) submitController.current = null
    }
  }

  if (loading) return <Spinner />
  if (loadError)
    return (
      <ErrorState message={loadError} onRetry={() => setRetry((value) => value + 1)} />
    )

  return (
    <>
      <PageHeader
        title={mode === "edit" ? "Modifier le devis" : "Nouveau devis"}
        back={{
          to: backTo,
          label: mode === "edit" ? "Retour au devis" : "Retour aux devis",
        }}
      />
      <div className="flex max-w-3xl flex-col gap-5">
        {mode === "new" && (
          <QuoteImportPanel
            disabled={submitting}
            onPrepared={onPrepared}
            onBusyChange={setImportBusy}
          />
        )}
        <Card className="min-w-0 p-5 sm:p-8">
          <form onSubmit={onSubmit} noValidate>
            <fieldset
              disabled={submitting}
              className="flex min-w-0 flex-col gap-6"
              aria-label="Informations du devis"
            >
              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
                >
                  {error}
                </p>
              )}
              {mode === "new" && (
                <div>
                  <h2 className="text-base font-semibold text-ink">
                    Vérifier les informations
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    Le devis sera enregistré dans votre espace. Vous pourrez ensuite
                    préparer son envoi.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {mode === "new" && (
                  <div
                    className="flex flex-wrap gap-2"
                    role="group"
                    aria-label="Choisir le client"
                  >
                    <Button
                      type="button"
                      variant={clientMode === "existing" ? "secondary" : "ghost"}
                      aria-pressed={clientMode === "existing"}
                      disabled={!clients.length}
                      onClick={() => {
                        touched.current.add("client_id")
                        setClientMode("existing")
                        setClientNotice("")
                      }}
                    >
                      Client existant
                    </Button>
                    <Button
                      type="button"
                      variant={clientMode === "new" ? "secondary" : "ghost"}
                      aria-pressed={clientMode === "new"}
                      onClick={() => {
                        touched.current.add("client_id")
                        setClientMode("new")
                        setClientNotice("")
                      }}
                    >
                      <UserPlus size={16} aria-hidden="true" /> Nouveau client
                    </Button>
                  </div>
                )}
                {clientNotice && (
                  <p
                    role="status"
                    className="rounded-lg bg-primary-soft p-3 text-sm text-primary"
                  >
                    {clientNotice}
                  </p>
                )}
                {clientMode === "existing" ? (
                  <>
                    <Field
                      label="Client"
                      htmlFor="client_id"
                      required
                      error={fieldErrors.client_id}
                    >
                      <Select
                        id="client_id"
                        value={form.client_id}
                        required
                        onChange={(event) => {
                          change("client_id", event.target.value)
                          setClientNotice("")
                        }}
                      >
                        <option value="">Sélectionner un client…</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                            {client.email ? ` · ${client.email}` : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    {selectedClient && (
                      <p className="break-words text-sm text-muted">
                        {selectedClient.email ||
                          "Ce client n’a pas encore d’adresse email. Vous pourrez en ajouter une avant l’envoi."}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-4 rounded-lg border border-line bg-background p-4">
                    {possibleClients.length > 0 && (
                      <div className="space-y-2 rounded-lg bg-warning-soft p-3">
                        <p className="text-sm text-warning">
                          Ces coordonnées existent déjà dans votre entreprise.
                        </p>
                        {possibleClients.map((client) => (
                          <Button
                            key={client.id}
                            type="button"
                            variant="secondary"
                            className="max-w-full break-words text-left"
                            onClick={() => {
                              change("client_id", client.id)
                              setClientMode("existing")
                              setFieldErrors({})
                              setClientNotice("Client existant sélectionné.")
                            }}
                          >
                            Utiliser {client.name}
                          </Button>
                        ))}
                      </div>
                    )}
                    <Field
                      label="Nom / raison sociale"
                      htmlFor="client_name"
                      required
                      error={fieldErrors.client_name}
                    >
                      <Input
                        id="client_name"
                        value={newClient.name}
                        required
                        maxLength={200}
                        autoComplete="off"
                        onChange={(event) =>
                          changeNewClient("name", event.target.value)
                        }
                      />
                    </Field>
                    <Field
                      label="Email du client"
                      htmlFor="client_email"
                      error={fieldErrors.client_email}
                      hint="Vous pourrez compléter cette adresse avant d’envoyer le devis."
                    >
                      <Input
                        id="client_email"
                        type="email"
                        value={newClient.email}
                        maxLength={254}
                        autoComplete="off"
                        onChange={(event) =>
                          changeNewClient("email", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Téléphone du client" htmlFor="client_phone">
                      <Input
                        id="client_phone"
                        type="tel"
                        value={newClient.phone}
                        maxLength={40}
                        autoComplete="off"
                        onChange={(event) =>
                          changeNewClient("phone", event.target.value)
                        }
                      />
                    </Field>
                  </div>
                )}
              </div>

              <Field
                label="Référence"
                htmlFor="reference"
                required
                error={fieldErrors.reference}
              >
                <Input
                  id="reference"
                  placeholder="DEV-001"
                  value={form.reference}
                  required
                  maxLength={120}
                  onChange={(event) => change("reference", event.target.value)}
                />
              </Field>
              {duplicate && (
                <p
                  role="status"
                  className="-mt-3 rounded-lg bg-warning-soft p-3 text-sm text-warning"
                >
                  Cette référence est déjà utilisée.{" "}
                  <Link
                    to={`/app/quotes/${duplicate.id}`}
                    className="font-medium underline underline-offset-2"
                  >
                    Ouvrir le devis existant
                  </Link>
                </p>
              )}

              <div className="grid min-w-0 gap-6 sm:grid-cols-2">
                <Field
                  label="Montant TTC (€)"
                  htmlFor="amount"
                  required
                  error={fieldErrors.amount}
                  hint="En euros, tel qu’il figure sur le devis."
                >
                  <Input
                    id="amount"
                    inputMode="decimal"
                    placeholder="1250,50"
                    value={form.amount}
                    required
                    onChange={(event) => change("amount", event.target.value)}
                  />
                </Field>
                <Field
                  label="Valable jusqu’au"
                  htmlFor="expires_at"
                  error={fieldErrors.expires_at}
                  hint="À compléter si votre devis indique une date limite."
                >
                  <Input
                    id="expires_at"
                    type="date"
                    value={form.expires_at}
                    onChange={(event) => change("expires_at", event.target.value)}
                  />
                </Field>
              </div>

              {mode === "edit" ? (
                <Field label="Statut" htmlFor="status" required>
                  <Select
                    id="status"
                    value={form.status}
                    onChange={(event) => {
                      const status = event.target.value as QuoteStatus
                      change("status", status)
                      if (status !== "draft" && !form.sent_at)
                        change("sent_at", todayISO())
                    }}
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel[status]}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <div className="rounded-lg border border-line p-4">
                  <Button
                    type="button"
                    variant={alreadySent ? "secondary" : "ghost"}
                    aria-pressed={alreadySent}
                    aria-expanded={alreadySent}
                    aria-controls="already-sent-date"
                    onClick={() => change("status", alreadySent ? "draft" : "sent")}
                  >
                    {alreadySent && <Check size={16} aria-hidden="true" />} Déjà envoyé
                  </Button>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {alreadySent
                      ? "Indiquez la date de votre envoi pour organiser le suivi. Aucun email ne sera envoyé à cette étape."
                      : "Vous avez déjà transmis ce devis au client ? Enregistrez son envoi pour commencer le suivi."}
                  </p>
                </div>
              )}

              {(mode === "edit" || alreadySent) && (
                <div id="already-sent-date">
                  <Field
                    label="Date d’envoi"
                    htmlFor="sent_at"
                    required={dateRequired}
                    error={fieldErrors.sent_at}
                    hint={
                      dateRequired
                        ? "La date à laquelle vous avez envoyé le devis."
                        : "Optionnelle pour un brouillon."
                    }
                  >
                    <Input
                      id="sent_at"
                      type="date"
                      required={dateRequired}
                      max={mode === "new" ? todayISO() : undefined}
                      value={form.sent_at}
                      onChange={(event) => change("sent_at", event.target.value)}
                    />
                  </Field>
                </div>
              )}

              <Field
                label="Notes"
                htmlFor="notes"
                hint="Ces notes restent dans votre espace et ne sont pas incluses dans l’email."
              >
                <Textarea
                  id="notes"
                  value={form.notes}
                  maxLength={5000}
                  onChange={(event) => change("notes", event.target.value)}
                />
              </Field>
              <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:flex-wrap">
                <Button type="submit" loading={submitting} disabled={importBusy}>
                  {mode === "edit"
                    ? "Enregistrer"
                    : alreadySent
                      ? "Enregistrer le devis envoyé"
                      : "Enregistrer le brouillon"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate(backTo)}
                >
                  Annuler
                </Button>
              </div>
            </fieldset>
          </form>
        </Card>
      </div>
    </>
  )
}
