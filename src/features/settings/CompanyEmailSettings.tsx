import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { Mail, RefreshCw, Save } from "lucide-react"
import { Button, Card, Field, Input, Spinner } from "@/components/ui"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import {
  contactError,
  getCompanyEmailSettings,
  getFollowupServiceStatus,
  setCompanyEmailSettings,
  type CompanyEmailSettings as EmailSettings,
  type FollowupServiceStatus,
} from "@/features/company/contactApi"
import type { Company } from "@/types"

function CompanyEmailForm({
  company,
  canEdit,
}: {
  company: Company
  canEdit: boolean
}) {
  const { user } = useAuth()
  const { refresh: refreshCompany } = useCompany()
  const [settings, setSettings] = useState<EmailSettings | null>(null)
  const [service, setService] = useState<FollowupServiceStatus | null>(null)
  const [replyTo, setReplyTo] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const request = useRef(0)
  const active = useRef(true)
  const locked = useRef(false)
  const load = useCallback(async () => {
    const ticket = ++request.current
    setLoading(true)
    setError("")
    try {
      const [profile, readiness] = await Promise.all([
        getCompanyEmailSettings(company.id),
        getFollowupServiceStatus(),
      ])
      if (ticket !== request.current || !active.current) return
      setSettings(profile)
      setService(readiness)
      setReplyTo(profile?.reply_to ?? (canEdit ? (user?.email ?? "") : ""))
    } catch (err) {
      if (ticket === request.current && active.current)
        setError(
          contactError(
            err,
            "Impossible de charger les coordonnées email de l’entreprise.",
          ),
        )
    } finally {
      if (ticket === request.current && active.current) setLoading(false)
    }
  }, [company.id, canEdit, user?.email])
  useEffect(() => {
    active.current = true
    void load()
    return () => {
      active.current = false
      request.current++
    }
  }, [load])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canEdit || locked.current || !replyTo.trim()) return
    locked.current = true
    setSaving(true)
    setError("")
    setNotice("")
    try {
      const updated = await setCompanyEmailSettings(company.id, replyTo)
      if (!active.current) return
      setSettings(updated)
      setReplyTo(updated.reply_to ?? "")
      setNotice("L’adresse de réponse a été enregistrée.")
      await refreshCompany()
    } catch (err) {
      if (active.current)
        setError(contactError(err, "Impossible d’enregistrer l’adresse de réponse."))
    } finally {
      locked.current = false
      if (active.current) setSaving(false)
    }
  }

  return (
    <Card id="company-email" className="scroll-mt-24 p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
          <Mail size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-ink">Emails aux clients</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Cadova utilise le nom de votre entreprise pour envoyer vos devis et vos
            relances. Cette adresse permet aux clients de vous répondre.
          </p>
        </div>
      </div>
      {loading ? (
        <Spinner />
      ) : service ? (
        <>
          {!service.ready && (
            <p className="mt-5 rounded-lg border border-warning/20 bg-warning-soft p-3 text-sm leading-6 text-warning">
              Le service email n’est pas encore configuré. Vous pouvez enregistrer votre
              adresse, mais les relances automatiques ne seront pas envoyées pour le
              moment.
            </p>
          )}
          {settings?.automation_paused && (
            <p className="mt-4 text-sm text-warning">
              Les relances automatiques de cette entreprise sont actuellement mises en
              pause.
            </p>
          )}
          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field
              htmlFor="client-email-sender-name"
              label="Nom affiché dans les emails"
              hint="Ce nom correspond à celui de votre entreprise."
            >
              <Input id="client-email-sender-name" value={company.name} readOnly />
            </Field>
            {canEdit && (
              <a
                href="#company-name-settings"
                className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
              >
                Modifier le nom de l’entreprise
              </a>
            )}
            <Field
              htmlFor="company-reply-to"
              label="Adresse de réponse"
              required={canEdit}
              hint={
                canEdit
                  ? "Enregistrez une adresse que vous consultez. Aucun devis ni aucune relance n’est envoyé par ce réglage."
                  : "Seul le propriétaire de l’entreprise peut modifier cette adresse."
              }
            >
              <Input
                id="company-reply-to"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={replyTo}
                onChange={(event) => {
                  setReplyTo(event.target.value)
                  setNotice("")
                }}
                readOnly={!canEdit}
                disabled={saving}
                required={canEdit}
                placeholder={
                  canEdit ? "Votre adresse professionnelle" : "Non renseignée"
                }
              />
            </Field>
            {settings?.reply_to && (
              <p className="break-all text-xs leading-5 text-muted">
                Adresse enregistrée : {settings.reply_to}
              </p>
            )}
            {canEdit && (
              <Button
                type="submit"
                loading={saving}
                disabled={!replyTo.trim() || replyTo.trim() === settings?.reply_to}
              >
                <Save size={16} aria-hidden="true" /> Enregistrer les coordonnées email
              </Button>
            )}
          </form>
        </>
      ) : (
        <div className="mt-5">
          <Button variant="secondary" onClick={load}>
            <RefreshCw size={16} aria-hidden="true" /> Réessayer
          </Button>
        </div>
      )}
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
    </Card>
  )
}

export function CompanyEmailSettings() {
  const { company, role } = useCompany()
  const { user } = useAuth()
  if (!company || !user) return null
  return (
    <CompanyEmailForm
      key={`${user.id}:${company.id}`}
      company={company}
      canEdit={role === "owner"}
    />
  )
}
