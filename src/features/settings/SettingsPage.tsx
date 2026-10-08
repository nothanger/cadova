import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import {
  Bell,
  Save,
  Building2,
  MessageSquare,
  UserRound,
  ChevronDown,
} from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button, Card, Field, Input, Select, Spinner, cx } from "@/components/ui"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import { useAdmin } from "@/features/admin/AdminContext"
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
import { CompanyEmailSettings } from "./CompanyEmailSettings"
import { CompanyMessageSettings } from "@/features/message-templates/CompanyMessageSettings"

const DELAY_OPTIONS = [1, 2, 3, 5, 7, 14, 30]
const HOUR_OPTIONS = Array.from({ length: 13 }, (_, index) => index + 6)
const sections = [
  { id: "entreprise", label: "Entreprise", icon: Building2 },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "mon-suivi", label: "Mon suivi", icon: Bell },
  { id: "compte", label: "Compte", icon: UserRound },
] as const

function settingsSection(hash: string) {
  const id = hash.slice(1)
  if (id === "company-email" || id === "company-name-settings") return "entreprise"
  return sections.find((section) => section.id === id)?.id ?? "entreprise"
}

export function SettingsPage() {
  const { user } = useAuth()
  const { isAdmin } = useAdmin()
  const { company, role, refresh: refreshCompany } = useCompany()
  const location = useLocation()
  const selectedSection = settingsSection(location.hash)
  const preferenceRequest = useRef(0)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [emailKnown, setEmailKnown] = useState(false)
  const [emailLoading, setEmailLoading] = useState(true)
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailError, setEmailError] = useState("")
  const [emailLoadError, setEmailLoadError] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [companyNameSaving, setCompanyNameSaving] = useState(false)
  const [companyNameError, setCompanyNameError] = useState("")
  const [companyNameSaved, setCompanyNameSaved] = useState(false)
  const [prefs, setPrefs] = useState<ReminderPrefs>({
    followupDelayDays: 3,
    reminderHour: 8,
  })
  const [prefsKnown, setPrefsKnown] = useState(false)
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsError, setPrefsError] = useState("")
  const [prefsLoadError, setPrefsLoadError] = useState("")
  const [prefsSaved, setPrefsSaved] = useState(false)
  const [prefsSavedFor, setPrefsSavedFor] = useState<"followup" | "hour">("followup")

  useEffect(() => {
    setCompanyName(company?.name ?? "")
    setCompanyNameError("")
    setCompanyNameSaved(false)
  }, [company?.id, company?.name])

  useEffect(() => {
    if (!["#company-email", "#company-name-settings"].includes(location.hash)) return
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(location.hash.slice(1))
        ?.scrollIntoView({ block: "start" })
    })
    return () => cancelAnimationFrame(frame)
  }, [location.hash])

  const loadPreferences = useCallback(async () => {
    const request = ++preferenceRequest.current
    setEmailKnown(false)
    setPrefsKnown(false)
    setEmailLoadError("")
    setPrefsLoadError("")
    setEmailError("")
    setPrefsError("")
    if (!user || !company || isAdmin) {
      setEmailLoading(false)
      setPrefsLoading(false)
      return
    }
    setEmailLoading(true)
    setPrefsLoading(true)
    const [email, reminder] = await Promise.allSettled([
      getEmailPreference(user.id, company.id),
      getReminderPrefs(user.id, company.id),
    ])
    if (request !== preferenceRequest.current) return
    if (email.status === "fulfilled") {
      setEmailEnabled(email.value)
      setEmailKnown(true)
    } else {
      setEmailLoadError(
        isNotificationsMigrationMissing(email.reason)
          ? "Cette préférence n’est pas encore disponible. Contactez Cadova."
          : "Impossible de lire votre préférence de résumé quotidien. Réessayez.",
      )
    }
    if (reminder.status === "fulfilled") {
      setPrefs(reminder.value)
      setPrefsKnown(true)
    } else {
      setPrefsLoadError(
        isNotificationsMigrationMissing(reminder.reason)
          ? "Vos préférences de suivi ne sont pas encore disponibles. Contactez Cadova."
          : "Impossible de charger vos préférences de suivi. Aucune valeur n’a été modifiée.",
      )
    }
    setEmailLoading(false)
    setPrefsLoading(false)
  }, [user, company?.id, isAdmin])

  useEffect(() => {
    void loadPreferences()
    return () => {
      preferenceRequest.current++
    }
  }, [loadPreferences])

  async function toggleEmail() {
    if (!user || !company || emailSaving || emailLoading || !emailKnown) return
    const next = !emailEnabled
    setEmailSaving(true)
    setEmailError("")
    try {
      await setEmailPreference(user.id, company.id, next)
      setEmailEnabled(next)
    } catch (err) {
      setEmailError(humanizeError(err, "Impossible de modifier cette préférence."))
    } finally {
      setEmailSaving(false)
    }
  }

  async function savePrefs(source: "followup" | "hour") {
    if (!user || !company || prefsSaving || prefsLoading || !prefsKnown) return
    setPrefsSaving(true)
    setPrefsError("")
    setPrefsSaved(false)
    try {
      await setReminderPrefs(user.id, company.id, prefs)
      setPrefsSavedFor(source)
      setPrefsSaved(true)
    } catch (err) {
      setPrefsError(humanizeError(err, "Impossible d’enregistrer vos préférences."))
    } finally {
      setPrefsSaving(false)
    }
  }

  async function saveCompanyName() {
    if (!company || role !== "owner" || companyNameSaving) return
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
    } catch (err) {
      setCompanyNameError(humanizeError(err, "Impossible de renommer l’entreprise."))
    } finally {
      setCompanyNameSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Paramètres"
        subtitle="Votre entreprise, vos messages et vos préférences personnelles."
      />
      <nav
        aria-label="Sections des paramètres"
        className="mb-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
      >
        {sections
          .filter((section) => !isAdmin || section.id !== "mon-suivi")
          .map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              to={{ pathname: location.pathname, hash: `#${id}` }}
              aria-current={selectedSection === id ? "page" : undefined}
              className={cx(
                "flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                selectedSection === id
                  ? "border-primary/20 bg-primary-soft text-primary"
                  : "border-line bg-surface text-ink-soft hover:bg-background",
              )}
            >
              <Icon size={17} aria-hidden="true" /> {label}
            </Link>
          ))}
      </nav>
      <div className="max-w-3xl">
        <section
          hidden={selectedSection !== "entreprise"}
          aria-label="Paramètres de l’entreprise"
          className="space-y-6"
        >
          <CompanyEmailSettings />
          {role === "owner" && (
            <Card id="company-name-settings" className="scroll-mt-24 p-5 sm:p-7">
              <h2 className="text-base font-semibold text-ink">Nom de l’entreprise</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Ce nom apparaît dans votre espace et dans les emails aux clients.
              </p>
              <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Field label="Nom de l’entreprise" htmlFor="company-name">
                    <Input
                      id="company-name"
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void saveCompanyName()
                      }}
                      disabled={companyNameSaving}
                    />
                  </Field>
                </div>
                <Button
                  onClick={saveCompanyName}
                  loading={companyNameSaving}
                  disabled={!companyName.trim() || companyName.trim() === company?.name}
                  className="shrink-0"
                >
                  <Save size={15} aria-hidden="true" /> Renommer
                </Button>
              </div>
              {companyNameError && (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {companyNameError}
                </p>
              )}
              {companyNameSaved && (
                <p role="status" className="mt-3 text-sm text-success">
                  Nom mis à jour
                </p>
              )}
            </Card>
          )}
        </section>
        <section
          hidden={selectedSection !== "messages"}
          aria-label="Messages de l’entreprise"
        >
          <CompanyMessageSettings />
        </section>
        <section
          hidden={selectedSection !== "mon-suivi"}
          aria-label="Mon suivi"
          className="space-y-6"
        >
          {isAdmin ? (
            <Card className="p-5 sm:p-7">
              <p className="text-sm leading-6 text-muted">
                Les préférences de suivi sont propres aux utilisateurs de l’entreprise.
              </p>
            </Card>
          ) : (
            <>
              <Card className="p-5 sm:p-7">
                <h2 className="text-base font-semibold text-ink">
                  Quand attirer votre attention
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Choisissez après combien de jours un devis sans réponse apparaît à
                  relancer dans votre page Aujourd’hui. Ce réglage n’envoie aucun email.
                </p>
                {prefsLoading ? (
                  <Spinner />
                ) : prefsLoadError ? (
                  <div className="mt-4">
                    <p role="alert" className="text-sm leading-6 text-danger">
                      {prefsLoadError}
                    </p>
                    <Button
                      variant="secondary"
                      className="mt-3"
                      onClick={loadPreferences}
                    >
                      Réessayer
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="mt-5 max-w-sm">
                      <Field htmlFor="followup-delay" label="Délai avant relance">
                        <Select
                          id="followup-delay"
                          value={prefs.followupDelayDays}
                          disabled={prefsSaving || !prefsKnown}
                          onChange={(event) => {
                            setPrefs((current) => ({
                              ...current,
                              followupDelayDays: Number(event.target.value),
                            }))
                            setPrefsSaved(false)
                          }}
                        >
                          {DELAY_OPTIONS.map((days) => (
                            <option key={days} value={days}>
                              {days} {days === 1 ? "jour" : "jours"}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      Les relances automatiques gardent le calendrier choisi dans chaque
                      devis.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <Button
                        onClick={() => savePrefs("followup")}
                        loading={prefsSaving}
                        disabled={!prefsKnown}
                      >
                        <Save size={15} aria-hidden="true" /> Enregistrer
                      </Button>
                      {prefsSaved && prefsSavedFor === "followup" && (
                        <span role="status" className="text-sm text-success">
                          Préférences enregistrées
                        </span>
                      )}
                    </div>
                  </>
                )}
                {prefsError && (
                  <p role="alert" className="mt-3 text-sm text-danger">
                    {prefsError}
                  </p>
                )}
              </Card>
              <Card className="p-5 sm:p-7">
                <details className="group/daily">
                  <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-ink">
                    Résumé quotidien : préférences avancées
                    <ChevronDown
                      size={17}
                      aria-hidden="true"
                      className="shrink-0 text-muted transition-transform group-open/daily:rotate-180"
                    />
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    Le résumé quotidien par email n’est pas actif actuellement. Ces
                    préférences sont conservées pour son activation. Elles ne
                    programment aucun envoi et ne modifient pas les relances aux
                    clients.
                  </p>
                  {emailLoading ? (
                    <Spinner />
                  ) : emailLoadError ? (
                    <div className="mt-4">
                      <p role="alert" className="text-sm text-danger">
                        {emailLoadError}
                      </p>
                      <Button
                        variant="secondary"
                        className="mt-3"
                        onClick={loadPreferences}
                      >
                        Réessayer
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-5 flex items-center justify-between gap-4">
                      <p className="text-sm text-ink-soft">
                        Souhaiter recevoir le résumé lors de son activation
                      </p>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={emailKnown && emailEnabled}
                        aria-label="Recevoir le résumé quotidien après activation"
                        onClick={toggleEmail}
                        disabled={emailSaving || !emailKnown}
                        className={cx(
                          "relative h-8 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
                          emailEnabled ? "bg-primary" : "bg-line-strong",
                        )}
                      >
                        <span
                          className={cx(
                            "absolute left-0 top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform",
                            emailEnabled ? "translate-x-[20px]" : "translate-x-[4px]",
                          )}
                        />
                      </button>
                    </div>
                  )}
                  {prefsKnown && (
                    <div className="mt-5 max-w-sm">
                      <Field
                        htmlFor="reminder-hour"
                        label="Heure souhaitée du résumé"
                        hint="Heure de Paris. Cette préférence attend l’activation du service."
                      >
                        <Select
                          id="reminder-hour"
                          value={prefs.reminderHour}
                          disabled={prefsSaving || !prefsKnown}
                          onChange={(event) => {
                            setPrefs((current) => ({
                              ...current,
                              reminderHour: Number(event.target.value),
                            }))
                            setPrefsSaved(false)
                          }}
                        >
                          {HOUR_OPTIONS.map((hour) => (
                            <option key={hour} value={hour}>
                              {hour.toString().padStart(2, "0")}h00
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Button
                        className="mt-4"
                        variant="secondary"
                        onClick={() => savePrefs("hour")}
                        loading={prefsSaving}
                      >
                        Enregistrer l’heure souhaitée
                      </Button>
                    </div>
                  )}
                  {emailError && (
                    <p role="alert" className="mt-3 text-sm text-danger">
                      {emailError}
                    </p>
                  )}
                  {prefsSaved && prefsSavedFor === "hour" && (
                    <p role="status" className="mt-3 text-sm text-success">
                      Préférences enregistrées
                    </p>
                  )}
                </details>
              </Card>
            </>
          )}
        </section>
        <section hidden={selectedSection !== "compte"} aria-label="Votre compte">
          <Card className="p-5 sm:p-7">
            <h2 className="text-base font-semibold text-ink">Votre compte</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-muted">Adresse de connexion</dt>
                <dd className="mt-1 break-all font-medium">{user?.email}</dd>
              </div>
              <div>
                <dt className="text-muted">Entreprise</dt>
                <dd className="mt-1 break-words font-medium">{company?.name}</dd>
              </div>
              <div>
                <dt className="text-muted">Accès</dt>
                <dd className="mt-1 font-medium">
                  {isAdmin
                    ? "Administrateur Cadova"
                    : role === "owner"
                      ? "Propriétaire de l’entreprise"
                      : "Membre de l’entreprise"}
                </dd>
              </div>
            </dl>
            <Link
              to="/notifications?view=messages"
              className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4"
            >
              Une question sur votre compte ? Contacter Cadova
            </Link>
          </Card>
        </section>
      </div>
    </>
  )
}
