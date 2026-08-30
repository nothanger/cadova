import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { CadovaLogo } from "@/components/CadovaLogo"
import { Button, Field, Input } from "@/components/ui"
import { createCompanyWithOwner } from "./api"
import { useCompany } from "./CompanyContext"
import { humanizeError } from "@/lib/errors"

export function OnboardingPage() {
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
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <CadovaLogo variant="full" className="h-8" />
        </div>
        <div className="rounded-[var(--radius-cadova)] border border-line bg-surface p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Bienvenue sur Cadova
          </h1>
          <p className="mt-2 text-sm text-muted">
            Créez l’espace de votre entreprise pour commencer à suivre vos
            devis.
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
                autoFocus
                placeholder="Ex. Dupont Électricité"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Button type="submit" loading={submitting} className="mt-2 w-full">
              Créer mon espace
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
