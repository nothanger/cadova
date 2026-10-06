import { useEffect, useRef, useState, type FormEvent } from "react"
import { FileText, RefreshCw, Save, Trash2 } from "lucide-react"
import { Button, Card, Field, Input, Select, Spinner, Textarea } from "@/components/ui"
import { Dialog } from "@/components/ui/Dialog"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import { supabase } from "@/lib/supabase"
import { formatCents } from "@/lib/money"
import type { Company, QuoteWithClient } from "@/types"
import { AUTOMATION_VARIABLES } from "../quotes/automationMessages"
import {
  companyMessageError,
  deleteCompanyMessageTemplate,
  saveCompanyMessageProfile,
  saveCompanyMessageTemplate,
} from "./api"
import {
  buildCompanyMessage,
  COMPANY_MESSAGE_KINDS,
  MESSAGE_KIND_LABELS,
  messageTemplateErrors,
  signatureError,
  type CompanyMessageKind,
  type CompanyMessageTemplate,
  type MessageDraft,
} from "./messages"
import { useCompanyMessages } from "./useCompanyMessages"

const emptyDraft = (): MessageDraft => ({ subject: "", body: "" })

function CompanyMessageEditor({
  company,
  canEdit,
}: {
  company: Company
  canEdit: boolean
}) {
  const preferences = useCompanyMessages(company.id)
  const [templates, setTemplates] = useState<CompanyMessageTemplate[]>([])
  const [drafts, setDrafts] = useState<
    Partial<Record<CompanyMessageKind, MessageDraft>>
  >({})
  const [kind, setKind] = useState<CompanyMessageKind>("quote_send")
  const [signature, setSignature] = useState("")
  const [savedSignature, setSavedSignature] = useState("")
  const [quotes, setQuotes] = useState<QuoteWithClient[]>([])
  const [previewId, setPreviewId] = useState("")
  const [previewError, setPreviewError] = useState("")
  const [previewLoading, setPreviewLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [deleting, setDeleting] = useState<CompanyMessageKind | null>(null)
  const initialized = useRef(false)
  const active = useRef(true)
  const locked = useRef(false)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  useEffect(() => {
    if (!preferences.data || initialized.current) return
    const data = preferences.data
    initialized.current = true
    setTemplates(data.templates)
    setDrafts(
      Object.fromEntries(
        data.templates.map((row) => [
          row.kind,
          { subject: row.subject_template, body: row.body_template },
        ]),
      ),
    )
    setSignature(data.profile?.email_signature ?? "")
    setSavedSignature(data.profile?.email_signature ?? "")
  }, [preferences.data])
  useEffect(() => {
    let current = true
    void (async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("quotes")
          .select("*, client:clients (id, name)")
          .eq("company_id", company.id)
          .order("created_at", { ascending: false })
          .limit(25)
        if (queryError) throw queryError
        if (!current) return
        const rows = (data ?? []) as unknown as QuoteWithClient[]
        if (rows.some((row) => row.company_id !== company.id)) throw new Error("scope")
        setQuotes(rows)
        setPreviewId(rows[0]?.id ?? "")
      } catch {
        if (current)
          setPreviewError(
            "Impossible de charger un devis pour l’aperçu. Les modèles restent modifiables.",
          )
      } finally {
        if (current) setPreviewLoading(false)
      }
    })()
    return () => {
      current = false
    }
  }, [company.id])
  const draft = drafts[kind] ?? emptyDraft()
  const errors = messageTemplateErrors(draft)
  const profileError = signatureError(signature)
  const saved = templates.find((row) => row.kind === kind)
  const quote = quotes.find((row) => row.id === previewId)
  const preview = quote
    ? buildCompanyMessage({
        template: {
          company_id: company.id,
          kind,
          subject_template: draft.subject,
          body_template: draft.body,
          created_at: "",
          updated_at: "",
        },
        signature,
        fallback: draft,
        values: {
          client_name: quote.client?.name ?? "",
          quote_reference: quote.reference,
          company_name: company.name,
          amount_formatted: formatCents(quote.amount_cents),
        },
      })
    : null
  const modified =
    draft.subject !== (saved?.subject_template ?? "") ||
    draft.body !== (saved?.body_template ?? "")
  function updateDraft(field: keyof MessageDraft, value: string) {
    setDrafts((current) => ({ ...current, [kind]: { ...draft, [field]: value } }))
    setNotice("")
  }
  async function run(action: () => Promise<void>) {
    if (!canEdit || locked.current) return
    locked.current = true
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await action()
    } catch (error) {
      if (active.current)
        setError(
          companyMessageError(
            error,
            "La modification n’a pas pu être enregistrée. Réessayez.",
          ),
        )
    } finally {
      locked.current = false
      if (active.current) setBusy(false)
    }
  }
  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (errors.subject || errors.body) return
    await run(async () => {
      const row = await saveCompanyMessageTemplate(company.id, kind, draft)
      if (!active.current) return
      setTemplates((current) => [
        ...current.filter((item) => item.kind !== row.kind),
        row,
      ])
      setDrafts((current) => ({
        ...current,
        [row.kind]: { subject: row.subject_template, body: row.body_template },
      }))
      setNotice(
        "Modèle enregistré. Les messages et les relances déjà préparés restent inchangés.",
      )
    })
  }
  async function saveSignature(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (profileError) return
    await run(async () => {
      const row = await saveCompanyMessageProfile(company.id, signature)
      if (!active.current) return
      setSignature(row.email_signature)
      setSavedSignature(row.email_signature)
      setNotice(
        row.email_signature
          ? "Signature enregistrée. Elle sera proposée lors de la préparation des messages."
          : "Signature retirée des prochains messages.",
      )
    })
  }
  async function removeTemplate() {
    if (!deleting) return
    const removed = deleting
    await run(async () => {
      await deleteCompanyMessageTemplate(company.id, removed)
      if (!active.current) return
      setTemplates((current) => current.filter((item) => item.kind !== removed))
      setDrafts((current) => ({ ...current, [removed]: emptyDraft() }))
      setDeleting(null)
      setNotice("Modèle supprimé. Les messages déjà préparés restent inchangés.")
    })
  }
  return (
    <Card className="min-w-0 p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <FileText size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-ink">Messages de l’entreprise</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Gardez vos formulations et votre signature. Vous choisirez d’utiliser chaque
            modèle avant un envoi.
          </p>
        </div>
      </div>
      {preferences.loading ? (
        <Spinner />
      ) : preferences.error ? (
        <div className="mt-5">
          <p role="alert" className="text-sm text-danger">
            {preferences.error}
          </p>
          <Button variant="secondary" className="mt-3" onClick={preferences.reload}>
            <RefreshCw size={16} aria-hidden="true" /> Réessayer
          </Button>
        </div>
      ) : (
        <>
          {!canEdit && (
            <p className="mt-5 text-sm leading-6 text-muted">
              Le propriétaire de l’entreprise peut modifier ces modèles. Vous pouvez les
              consulter et les utiliser dans vos devis.
            </p>
          )}
          <form className="mt-5 space-y-4" onSubmit={saveTemplate}>
            <Field htmlFor="company-message-kind" label="Message à préparer">
              <Select
                id="company-message-kind"
                value={kind}
                disabled={busy}
                onChange={(event) => {
                  setKind(event.target.value as CompanyMessageKind)
                  setError("")
                  setNotice("")
                }}
              >
                {COMPANY_MESSAGE_KINDS.map((value) => (
                  <option key={value} value={value}>
                    {MESSAGE_KIND_LABELS[value]}
                    {templates.some((row) => row.kind === value) ? " · enregistré" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            {!saved && (
              <p className="text-xs leading-5 text-muted">
                Aucun modèle enregistré pour ce message. Cadova conserve ses messages
                habituels jusqu’à votre choix.
              </p>
            )}
            <Field
              htmlFor="company-message-subject"
              label="Objet du modèle"
              required
              error={draft.subject ? errors.subject : undefined}
              hint="160 caractères maximum, sur une seule ligne."
            >
              <Input
                id="company-message-subject"
                required
                maxLength={160}
                value={draft.subject}
                disabled={busy || !canEdit}
                onChange={(event) => updateDraft("subject", event.target.value)}
              />
            </Field>
            <Field
              htmlFor="company-message-body"
              label="Texte du modèle"
              required
              error={draft.body ? errors.body : undefined}
              hint="4 000 caractères maximum, signature comprise lors de l’envoi."
            >
              <Textarea
                id="company-message-body"
                required
                rows={7}
                maxLength={4000}
                value={draft.body}
                disabled={busy || !canEdit}
                onChange={(event) => updateDraft("body", event.target.value)}
              />
            </Field>
            <div className="text-xs leading-5 text-muted">
              <p>Informations remplacées automatiquement dans le message :</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {AUTOMATION_VARIABLES.map((variable) => (
                  <li
                    key={variable}
                    className="break-all rounded-md border border-line bg-background px-2 py-1 font-mono text-[11px]"
                  >{`{{${variable}}}`}</li>
                ))}
              </ul>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  loading={busy}
                  disabled={!modified || Boolean(errors.subject || errors.body)}
                >
                  <Save size={15} aria-hidden="true" /> Enregistrer le modèle
                </Button>
                {saved && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setDeleting(kind)}
                  >
                    <Trash2 size={15} aria-hidden="true" /> Supprimer le modèle
                  </Button>
                )}
              </div>
            )}
          </form>
          <form
            className="mt-6 space-y-4 border-t border-line pt-6"
            onSubmit={saveSignature}
          >
            <Field
              htmlFor="company-message-signature"
              label="Signature de l’entreprise"
              error={profileError}
              hint="Texte simple, sans variables. 800 caractères maximum."
            >
              <Textarea
                id="company-message-signature"
                rows={4}
                maxLength={800}
                value={signature}
                disabled={busy || !canEdit}
                onChange={(event) => {
                  setSignature(event.target.value)
                  setNotice("")
                }}
              />
            </Field>
            {canEdit && (
              <Button
                type="submit"
                variant="secondary"
                loading={busy}
                disabled={signature === savedSignature || Boolean(profileError)}
              >
                <Save size={15} aria-hidden="true" /> Enregistrer la signature
              </Button>
            )}
          </form>
          <div className="mt-6 border-t border-line pt-6">
            <h3 className="text-sm font-semibold">Aperçu sur un devis</h3>
            {previewLoading ? (
              <Spinner />
            ) : previewError ? (
              <p className="mt-3 text-sm text-muted">{previewError}</p>
            ) : quotes.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-muted">
                L’aperçu sera disponible après la création de votre premier devis.
              </p>
            ) : (
              <>
                <div className="mt-3">
                  <Field
                    htmlFor="company-message-preview-quote"
                    label="Devis utilisé pour l’aperçu"
                  >
                    <Select
                      id="company-message-preview-quote"
                      value={previewId}
                      onChange={(event) => setPreviewId(event.target.value)}
                    >
                      {quotes.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.reference} · {row.client?.name ?? "Client"}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {draft.subject.trim() && draft.body.trim() && preview ? (
                  <>
                    <p className="mt-4 break-words text-sm font-semibold">
                      {preview.preview.subject}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-line bg-background p-4 text-sm leading-6">
                      {preview.preview.body}
                    </p>
                    {preview.error && (
                      <p role="status" className="mt-3 text-sm text-danger">
                        {preview.error}
                      </p>
                    )}
                    <p className="mt-3 text-xs leading-5 text-muted">
                      Cet aperçu utilise le devis sélectionné. Aucun email n’est envoyé.
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-muted">
                    Renseignez l’objet et le texte pour voir le résultat.
                  </p>
                )}
              </>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-4 text-sm leading-6 text-danger">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mt-4 text-sm leading-6 text-success">
              {notice}
            </p>
          )}
        </>
      )}
      {deleting && (
        <Dialog
          titleId="delete-company-template-title"
          onClose={() => !busy && setDeleting(null)}
        >
          <h2 id="delete-company-template-title" className="text-lg font-semibold">
            Supprimer ce modèle ?
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Le modèle « {MESSAGE_KIND_LABELS[deleting]} » ne sera plus proposé. Les
            messages et relances déjà préparés resteront inchangés.
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Garder le modèle
            </Button>
            <Button loading={busy} onClick={removeTemplate}>
              Supprimer ce modèle
            </Button>
          </div>
        </Dialog>
      )}
    </Card>
  )
}

export function CompanyMessageSettings() {
  const { company, role } = useCompany()
  const { user } = useAuth()
  return company ? (
    <CompanyMessageEditor
      key={`${user?.id}:${company.id}`}
      company={company}
      canEdit={role === "owner"}
    />
  ) : null
}
