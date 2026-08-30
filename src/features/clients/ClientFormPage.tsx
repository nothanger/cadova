import { useEffect, useState, type FormEvent } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button, Card, Field, Input, Spinner, Textarea } from "@/components/ui"
import { useCompany } from "@/features/company/CompanyContext"
import { createClient, getClient, updateClient, type ClientInput } from "./api"
import { humanizeError } from "@/lib/errors"

const emptyForm: ClientInput = { name: "", email: "", phone: "", notes: "" }
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

export function ClientFormPage({ mode }: { mode: "new" | "edit" }) {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { company } = useCompany()

  const [form, setForm] = useState<ClientInput>(emptyForm)
  const [loading, setLoading] = useState(mode === "edit")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string
    email?: string
  }>({})

  useEffect(() => {
    if (mode !== "edit" || !clientId) return
    getClient(clientId)
      .then((c) =>
        setForm({
          name: c.name,
          email: c.email ?? "",
          phone: c.phone ?? "",
          notes: c.notes ?? "",
        }),
      )
      .catch((err) => setError(humanizeError(err, "Client introuvable.")))
      .finally(() => setLoading(false))
  }, [mode, clientId])

  function validate() {
    const errs: typeof fieldErrors = {}
    if (!form.name.trim()) errs.name = "Le nom est obligatoire."
    if (form.email && form.email.trim() && !isEmail(form.email.trim()))
      errs.email = "Adresse email invalide."
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting || !company) return
    if (!validate()) return
    setError("")
    setSubmitting(true)
    try {
      if (mode === "edit" && clientId) {
        await updateClient(clientId, form)
        navigate(`/app/clients/${clientId}`, { replace: true })
      } else {
        const created = await createClient(company.id, form)
        navigate(`/app/clients/${created.id}`, { replace: true })
      }
    } catch (err) {
      setError(humanizeError(err, "Enregistrement impossible."))
      setSubmitting(false)
    }
  }

  if (loading) return <Spinner />

  const backTo =
    mode === "edit" && clientId ? `/app/clients/${clientId}` : "/app/clients"

  return (
    <>
      <PageHeader
        title={mode === "edit" ? "Modifier le client" : "Nouveau client"}
        back={{
          to: backTo,
          label: mode === "edit" ? "Retour à la fiche" : "Retour aux clients",
        }}
      />
      <Card className="p-6 md:p-8">
        <form onSubmit={onSubmit} className="flex max-w-lg flex-col gap-5">
          {error && (
            <p
              role="alert"
              className="rounded-[10px] bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          )}
          <Field
            label="Nom / raison sociale"
            htmlFor="name"
            required
            error={fieldErrors.name}
          >
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Email" htmlFor="email" error={fieldErrors.email}>
            <Input
              id="email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Téléphone" htmlFor="phone">
            <Input
              id="phone"
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <div className="flex gap-3">
            <Button type="submit" loading={submitting}>
              {mode === "edit" ? "Enregistrer" : "Créer le client"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(backTo)}
            >
              Annuler
            </Button>
          </div>
        </form>
      </Card>
    </>
  )
}
