import { useEffect, useRef, useState, type FormEvent } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  Spinner,
  Textarea,
} from "@/components/ui"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import { createClient, getClient, updateClient, type ClientInput } from "./api"
import { humanizeError } from "@/lib/errors"

const emptyForm: ClientInput = { name: "", email: "", phone: "", notes: "" }
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export function ClientFormPage({ mode }: { mode: "new" | "edit" }) {
  const { clientId } = useParams()
  const { user, loading: authLoading } = useAuth()
  const { company, loading: companyLoading } = useCompany()
  if (authLoading || companyLoading) return <Spinner />
  if (!user || !company)
    return <ErrorState message="Sélectionnez une entreprise pour ajouter un client." />
  return (
    <ScopedClientForm
      key={`${user.id}:${company.id}:${mode}:${clientId ?? "new"}`}
      mode={mode}
      clientId={clientId}
      companyId={company.id}
    />
  )
}

function ScopedClientForm({
  mode,
  clientId,
  companyId,
}: {
  mode: "new" | "edit"
  clientId?: string
  companyId: string
}) {
  const navigate = useNavigate()
  const mounted = useRef(true)
  const locked = useRef(false)
  const [form, setForm] = useState<ClientInput>(emptyForm)
  const [loading, setLoading] = useState(mode === "edit")
  const [loadError, setLoadError] = useState("")
  const [retry, setRetry] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({})

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    if (mode !== "edit") return
    let active = true
    setLoading(true)
    setLoadError("")
    if (!clientId) {
      setLoadError("Client introuvable.")
      setLoading(false)
      return
    }
    void getClient(clientId, companyId)
      .then((client) => {
        if (!active) return
        if (client.company_id !== companyId) throw new Error("client_scope_mismatch")
        setForm({
          name: client.name,
          email: client.email ?? "",
          phone: client.phone ?? "",
          notes: client.notes ?? "",
        })
      })
      .catch((err) => {
        if (active) setLoadError(humanizeError(err, "Client introuvable."))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [mode, clientId, companyId, retry])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (locked.current) return
    const errors: typeof fieldErrors = {}
    if (!form.name.trim())
      errors.name = "Indiquez le nom du client ou de son entreprise."
    if (form.email?.trim() && !isEmail(form.email.trim()))
      errors.email = "Vérifiez l’adresse email."
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      document.getElementById(Object.keys(errors)[0])?.focus()
      return
    }
    locked.current = true
    setError("")
    setSubmitting(true)
    try {
      if (mode === "edit" && clientId) {
        await updateClient(clientId, form, companyId)
        if (mounted.current) navigate(`/app/clients/${clientId}`, { replace: true })
      } else {
        const created = await createClient(companyId, form)
        if (mounted.current) navigate(`/app/clients/${created.id}`, { replace: true })
      }
    } catch (err) {
      if (mounted.current) {
        setError(
          humanizeError(
            err,
            "Enregistrement impossible. Vos informations sont conservées.",
          ),
        )
        setSubmitting(false)
        locked.current = false
      }
    }
  }
  if (loading) return <Spinner />
  if (loadError)
    return (
      <ErrorState message={loadError} onRetry={() => setRetry((value) => value + 1)} />
    )
  const backTo =
    mode === "edit" && clientId ? `/app/clients/${clientId}` : "/app/clients"
  return (
    <>
      <PageHeader
        title={mode === "edit" ? "Modifier le client" : "Ajouter un client"}
        subtitle="Ses coordonnées serviront à l’envoi et au suivi de ses devis."
        back={{
          to: backTo,
          label: mode === "edit" ? "Retour au client" : "Retour aux clients",
        }}
      />
      <Card className="max-w-2xl p-5 sm:p-8">
        <form onSubmit={onSubmit} noValidate>
          <fieldset
            disabled={submitting}
            className="flex min-w-0 flex-col gap-5"
            aria-label="Coordonnées du client"
          >
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
              >
                {error}
              </p>
            )}
            <Field
              label="Nom du client ou de l’entreprise"
              htmlFor="name"
              required
              error={fieldErrors.name}
            >
              <Input
                id="name"
                autoComplete="organization"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field
              label="Adresse email"
              htmlFor="email"
              error={fieldErrors.email}
              hint="Pour lui envoyer ses devis et les relances. Vous pourrez la compléter plus tard."
            >
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email ?? ""}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </Field>
            <Field label="Téléphone" htmlFor="phone" hint="Facultatif.">
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={form.phone ?? ""}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </Field>
            <details className="rounded-lg border border-line">
              <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium text-ink">
                Notes internes{form.notes?.trim() ? " · renseignées" : " · facultatif"}
              </summary>
              <div className="border-t border-line p-4">
                <Field
                  label="Notes"
                  htmlFor="notes"
                  hint="Ces notes restent dans votre entreprise."
                >
                  <Textarea
                    id="notes"
                    value={form.notes ?? ""}
                    onChange={(event) =>
                      setForm({ ...form, notes: event.target.value })
                    }
                  />
                </Field>
              </div>
            </details>
            <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row">
              <Button type="submit" loading={submitting}>
                {mode === "edit" ? "Enregistrer les coordonnées" : "Ajouter le client"}
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
    </>
  )
}
