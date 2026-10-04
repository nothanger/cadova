import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { CadovaLogo } from "@/components/CadovaLogo"
import { Button, Field, Input } from "@/components/ui"
import { usePageTitle } from "@/lib/usePageTitle"
import { createCompanyWithOwner } from "./api"
import { useCompany } from "./CompanyContext"
import { humanizeError } from "@/lib/errors"
import { NotificationBell } from "@/features/notifications/NotificationBell"

export function OnboardingPage() {
  usePageTitle("Votre espace entreprise")
  const navigate = useNavigate()
  const { refresh } = useCompany()
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Le nom de votre entreprise est requis.")
      return
    }
    setError("")
    setSubmitting(true)
    try {
      await createCompanyWithOwner(trimmed)
      await refresh() // re-read membership so the guard lets us into /app
      navigate("/app", { replace: true })
    } catch (err) {
      setError(humanizeError(err, "Création de l’espace impossible."))
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between gap-4">
          <CadovaLogo variant="full" className="h-8" />
          <NotificationBell />
        </div>
        <div className="rounded-[var(--radius-cadova)] border border-line bg-surface p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Votre espace entreprise
          </h1>
          <p className="mt-2 text-sm text-muted">
            Créez l’espace de votre entreprise pour commencer à suivre vos devis.
          </p>
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            {error && (
              <p
                role="alert"
                className="rounded-[10px] bg-danger-soft px-3 py-2 text-sm text-danger"
              >
                {error}
              </p>
            )}
            <Field label="Nom de votre entreprise" htmlFor="company" required>
              <Input
                id="company"
                required
                placeholder="Ex. Dupont Électricité"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Button type="submit" loading={submitting} className="mt-2 w-full">
              Créer mon espace
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted">
            Une question ?{" "}
            <Link
              to="/notifications?view=messages"
              className="font-medium text-primary underline underline-offset-2"
            >
              Écrire à l’admin
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
