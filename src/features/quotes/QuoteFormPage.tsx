import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button, Card, Field, Input, Select, Spinner, Textarea } from "@/components/ui"
import { useCompany } from "@/features/company/CompanyContext"
import { listClients } from "@/features/clients/api"
import { createQuote, getQuote, updateQuote, type QuoteInput } from "./api"
import { statusLabel } from "@/components/ui"
import { humanizeError } from "@/lib/errors"
import { centsToInput, parseAmountToCents } from "@/lib/money"
import { todayISO } from "@/lib/dates"
import type { Client, QuoteStatus } from "@/types"

interface FormState {
  client_id: string
  reference: string
  amount: string
  status: QuoteStatus
  sent_at: string
  notes: string
}

const statuses: QuoteStatus[] = ["draft", "sent", "accepted", "refused"]

export function QuoteFormPage({ mode }: { mode: "new" | "edit" }) {
  const { quoteId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { company } = useCompany()

  const [clients, setClients] = useState<Client[]>([])
  const [form, setForm] = useState<FormState>({
    client_id: params.get("client") ?? "",
    reference: "",
    amount: "",
    status: "draft",
    sent_at: "",
    notes: "",
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!company) return
    async function init() {
      try {
        const cs = await listClients(company!.id)
        setClients(cs)
        if (mode === "edit" && quoteId) {
          const q = await getQuote(quoteId)
          setForm({
            client_id: q.client_id,
            reference: q.reference,
            amount: centsToInput(q.amount_cents),
            status: q.status,
            sent_at: q.sent_at ?? "",
            notes: q.notes ?? "",
          })
        }
      } catch (err) {
        setError(humanizeError(err, "Chargement impossible."))
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [company?.id, mode, quoteId])

  const amountCents = useMemo(() => parseAmountToCents(form.amount), [form.amount])
  const dateRequired = form.status !== "draft"

  function validate() {
    const errs: Record<string, string> = {}
    if (!form.client_id) errs.client_id = "Sélectionnez un client."
    if (!form.reference.trim()) errs.reference = "La référence est obligatoire."
    if (amountCents === null) errs.amount = "Montant invalide (ex. 1250,50)."
    if (dateRequired && !form.sent_at)
      errs.sent_at = "Une date d’envoi est requise pour ce statut."
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting || !company) return
    if (!validate()) return
    setError("")
    setSubmitting(true)
    const payload: QuoteInput = {
      client_id: form.client_id,
      reference: form.reference,
      amount_cents: amountCents ?? 0,
      status: form.status,
      // A draft with no date stays null; other statuses always carry a date.
      sent_at: form.status === "draft" ? form.sent_at || null : form.sent_at,
      notes: form.notes,
    }
    try {
      if (mode === "edit" && quoteId) {
        await updateQuote(quoteId, payload)
        navigate(`/app/quotes/${quoteId}`, { replace: true })
      } else {
        const created = await createQuote(company.id, payload)
        navigate(`/app/quotes/${created.id}`, { replace: true })
      }
    } catch (err) {
      setError(humanizeError(err, "Enregistrement impossible."))
      setSubmitting(false)
    }
  }

  if (loading) return <Spinner />

  const backTo = mode === "edit" && quoteId ? `/app/quotes/${quoteId}` : "/app/quotes"

  if (mode === "new" && clients.length === 0) {
    return (
      <>
        <PageHeader
          title="Nouveau devis"
          back={{ to: "/app/quotes", label: "Retour aux devis" }}
        />
        <Card className="p-8 text-center">
          <p className="text-sm text-muted">
            Vous devez d’abord créer un client avant de pouvoir établir un devis.
          </p>
          <div className="mt-4">
            <Button onClick={() => navigate("/app/clients/new")}>
              Créer un client
            </Button>
          </div>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={mode === "edit" ? "Modifier le devis" : "Nouveau devis"}
        back={{
          to: backTo,
          label: mode === "edit" ? "Retour au devis" : "Retour aux devis",
        }}
      />
      <Card className="max-w-3xl p-5 sm:p-8">
        <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-6">
          {error && (
            <p
              role="alert"
              className="rounded-[10px] bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <Field
            label="Client"
            htmlFor="client_id"
            required
            error={fieldErrors.client_id}
          >
            <Select
              id="client_id"
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            >
              <option value="">Sélectionner un client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

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
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
            />
          </Field>

          <Field
            label="Montant (€)"
            htmlFor="amount"
            required
            error={fieldErrors.amount}
            hint="TTC, en euros. Ex. 1250,50"
          >
            <Input
              id="amount"
              inputMode="decimal"
              placeholder="1250,50"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>

          <Field label="Statut" htmlFor="status" required>
            <Select
              id="status"
              value={form.status}
              onChange={(e) => {
                const status = e.target.value as QuoteStatus
                setForm((f) => ({
                  ...f,
                  status,
                  // Helpful default: prefill today's date when leaving draft.
                  sent_at: status !== "draft" && !f.sent_at ? todayISO() : f.sent_at,
                }))
              }}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabel[s]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Date d’envoi"
            htmlFor="sent_at"
            required={dateRequired}
            error={fieldErrors.sent_at}
            hint={dateRequired ? undefined : "Optionnelle pour un brouillon."}
          >
            <Input
              id="sent_at"
              type="date"
              value={form.sent_at}
              onChange={(e) => setForm({ ...form, sent_at: e.target.value })}
            />
          </Field>

          <Field label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          <div className="flex flex-wrap gap-3 border-t border-line pt-5">
            <Button type="submit" loading={submitting}>
              {mode === "edit" ? "Enregistrer" : "Créer le devis"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(backTo)}>
              Annuler
            </Button>
          </div>
        </form>
      </Card>
    </>
  )
}
