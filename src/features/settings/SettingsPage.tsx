import { useEffect, useState } from "react"
import { Mail, Bell, Save, Building2 } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button, Card, Field, Input, Spinner } from "@/components/ui"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import {
  getEmailPreference,
  setEmailPreference,
  getReminderPrefs,
  setReminderPrefs,
  type ReminderPrefs,
} from "@/features/notifications/api"
import { humanizeError } from "@/lib/errors"
import { isNotificationsMigrationMissing } from "@/lib/setup"
import { supabase } from "@/lib/supabase"

const DELAY_OPTIONS = [
  { value: 1, label: "1 jour" },
  { value: 2, label: "2 jours" },
  { value: 3, label: "3 jours" },
  { value: 5, label: "5 jours" },
  { value: 7, label: "7 jours" },
  { value: 14, label: "14 jours" },
  { value: 30, label: "30 jours" },
]

const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => {
  const h = i + 6
  return { value: h, label: `${h.toString().padStart(2, "0")}h00` }
})

export function SettingsPage() {
  const { user } = useAuth()
  const { company, role, refresh: refreshCompany } = useCompany()

  /* ── email toggle ── */
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [emailLoading, setEmailLoading] = useState(true)
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailError, setEmailError] = useState("")
  const [migrationMissing, setMigrationMissing] = useState(false)

  /* ── company rename ── */
  const [companyName, setCompanyName] = useState("")
  const [companyNameSaving, setCompanyNameSaving] = useState(false)
  const [companyNameError, setCompanyNameError] = useState("")
  const [companyNameSaved, setCompanyNameSaved] = useState(false)

  /* ── reminder prefs ── */
  const [prefs, setPrefs] = useState<ReminderPrefs>({
    followupDelayDays: 3,
    reminderHour: 8,
  })
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsError, setPrefsError] = useState("")
  const [prefsSaved, setPrefsSaved] = useState(false)
  const [prefsMigrationMissing, setPrefsMigrationMissing] = useState(false)

  useEffect(() => {
    if (company) setCompanyName(company.name)
  }, [company?.id])

  useEffect(() => {
    if (!user || !company) return

    getEmailPreference(user.id, company.id)
      .then(setEmailEnabled)
      .catch((err) => {
        if (isNotificationsMigrationMissing(err)) setMigrationMissing(true)
      })
      .finally(() => setEmailLoading(false))

    getReminderPrefs(user.id, company.id)
      .then(setPrefs)
      .catch((err) => {
        if (isNotificationsMigrationMissing(err)) setPrefsMigrationMissing(true)
      })
      .finally(() => setPrefsLoading(false))
  }, [user, company])

  async function toggleEmail() {
    if (!user || !company || emailSaving) return
    const next = !emailEnabled
    setEmailSaving(true)
    setEmailError("")
    try {
      await setEmailPreference(user.id, company.id, next)
      setEmailEnabled(next)
    } catch (err) {
      setEmailError(
        isNotificationsMigrationMissing(err)
          ? "La migration des notifications doit être appliquée avant de modifier cette préférence."
          : humanizeError(err, "Impossible de modifier la préférence."),
      )
    } finally {
      setEmailSaving(false)
    }
  }

  async function savePrefs() {
    if (!user || !company || prefsSaving) return
    setPrefsSaving(true)
    setPrefsError("")
    setPrefsSaved(false)
    try {
      await setReminderPrefs(user.id, company.id, prefs)
      setPrefsSaved(true)
      setTimeout(() => setPrefsSaved(false), 3000)
    } catch (err) {
      setPrefsError(
        isNotificationsMigrationMissing(err)
          ? "Exécutez la migration 0004_reminder_prefs.sql puis rechargez."
          : humanizeError(err, "Impossible d'enregistrer les préférences."),
      )
    } finally {
      setPrefsSaving(false)
    }
  }

  async function saveCompanyName() {
    if (!company || companyNameSaving) return
    const trimmed = companyName.trim()
    if (!trimmed || trimmed === company.name) return
    setCompanyNameSaving(true)
    setCompanyNameError("")
    setCompanyNameSaved(false)
    try {
      const { error } = await supabase
        .from("companies")
        .update({ name: trimmed })
        .eq("id", company.id)
      if (error) throw error
      await refreshCompany()
      setCompanyNameSaved(true)
      setTimeout(() => setCompanyNameSaved(false), 3000)
    } catch (err) {
      setCompanyNameError(
        humanizeError(err, "Impossible de renommer l'entreprise."),
      )
    } finally {
      setCompanyNameSaving(false)
    }
  }

  const loading = emailLoading || prefsLoading

  return (
    <>
      <PageHeader
        title="Paramètres"
        subtitle="Préférences de votre compte Cadova."
      />

      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          {/* ── Migration banner ── */}
          {(migrationMissing || prefsMigrationMissing) && (
            <p
              role="alert"
              className="rounded-[10px] bg-warning-soft px-3 py-2 text-sm text-warning"
            >
              Les notifications ne sont pas encore configurées. Exécutez les
              migrations <code>0002_notifications.sql</code>
              {prefsMigrationMissing && " et "}
              {prefsMigrationMissing && <code>0004_reminder_prefs.sql</code>}{" "}
              dans le SQL Editor Supabase, puis rechargez cette page.
            </p>
          )}

          {/* ── Email toggle ── */}
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    Résumé quotidien par email
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    Recevez chaque matin un email listant vos devis à relancer.
                    Aucun email n'est envoyé si vous n'avez rien à relancer ce
                    jour-là.
                  </p>
                  {emailError && (
                    <p className="mt-1 text-xs text-danger">{emailError}</p>
                  )}
                </div>
              </div>

              <button
                role="switch"
                aria-checked={emailEnabled}
                aria-label="Activer les rappels par email"
                onClick={toggleEmail}
                disabled={emailSaving || migrationMissing}
                className={[
                  "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none disabled:opacity-50",
                  emailEnabled ? "bg-primary" : "bg-line-strong",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                    emailEnabled ? "translate-x-[22px]" : "translate-x-[2px]",
                  ].join(" ")}
                />
              </button>
            </div>
          </Card>

          {/* ── Reminder prefs ── */}
          <Card className="p-5">
            <div className="flex items-start gap-3 mb-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                <Bell size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">
                  Préférences de relance
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  Contrôlez quand un devis devient « À relancer » et à quelle
                  heure l'email part.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Délai */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-soft">
                  Délai avant relance
                </label>
                <select
                  value={prefs.followupDelayDays}
                  onChange={(e) =>
                    setPrefs((p) => ({
                      ...p,
                      followupDelayDays: Number(e.target.value),
                    }))
                  }
                  disabled={prefsSaving || prefsMigrationMissing}
                  className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none disabled:opacity-50"
                >
                  {DELAY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted">
                  Un devis envoyé il y a au moins{" "}
                  <strong>{prefs.followupDelayDays} j</strong> apparaît dans « À
                  relancer ».
                </p>
              </div>

              {/* Heure d'envoi */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-ink-soft">
                  Heure d'envoi de l'email{" "}
                  <span className="font-normal text-muted">
                    (heure de Paris)
                  </span>
                </label>
                <select
                  value={prefs.reminderHour}
                  onChange={(e) =>
                    setPrefs((p) => ({
                      ...p,
                      reminderHour: Number(e.target.value),
                    }))
                  }
                  disabled={prefsSaving || prefsMigrationMissing}
                  className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none disabled:opacity-50"
                >
                  {HOUR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted">
                  Le résumé quotidien sera envoyé à{" "}
                  <strong>
                    {prefs.reminderHour.toString().padStart(2, "0")}h00
                  </strong>{" "}
                  heure de Paris.
                </p>
              </div>
            </div>

            {prefsError && (
              <p className="mt-3 text-xs text-danger">{prefsError}</p>
            )}

            <div className="mt-4 flex items-center gap-3">
              <Button
                onClick={savePrefs}
                loading={prefsSaving}
                disabled={prefsMigrationMissing}
                className="gap-1.5"
              >
                <Save size={15} />
                Enregistrer
              </Button>
              {prefsSaved && (
                <span className="text-xs font-medium text-success">
                  Préférences enregistrées ✓
                </span>
              )}
            </div>
          </Card>

          {/* ── Entreprise ── */}
          {role === "owner" && (
            <Card className="p-5">
              <div className="flex items-start gap-3 mb-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                  <Building2 size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    Nom de l'entreprise
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">
                    Modifiez le nom affiché dans Cadova FollowUp.
                  </p>
                </div>
              </div>

              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Field label="Nom de l'entreprise" htmlFor="company-name">
                    <Input
                      id="company-name"
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveCompanyName()
                      }}
                      disabled={companyNameSaving}
                    />
                  </Field>
                </div>
                <Button
                  onClick={saveCompanyName}
                  loading={companyNameSaving}
                  disabled={
                    !companyName.trim() || companyName.trim() === company?.name
                  }
                  className="shrink-0 gap-1.5"
                >
                  <Save size={15} />
                  Renommer
                </Button>
              </div>

              {companyNameError && (
                <p className="mt-2 text-xs text-danger">{companyNameError}</p>
              )}
              {companyNameSaved && (
                <p className="mt-2 text-xs font-medium text-success">
                  Nom mis à jour ✓
                </p>
              )}
            </Card>
          )}

          {/* ── Compte ── */}
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Compte
            </p>
            <div className="mt-3 space-y-1 text-sm text-ink-soft">
              <p>
                <span className="font-medium text-ink">Email :</span>{" "}
                {user?.email}
              </p>
              <p>
                <span className="font-medium text-ink">Entreprise :</span>{" "}
                {company?.name}
              </p>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
