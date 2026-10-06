import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react"
import { CalendarDays, Check, RefreshCw, Wrench } from "lucide-react"
import { Button, Card, Field, Input, Select, Spinner } from "@/components/ui"
import { Dialog } from "@/components/ui/Dialog"
import type { QuoteWithClient } from "@/types"
import { getQuoteWorkOrder, saveQuoteWorkOrder, workOrderError } from "./api"
import {
  validateWorkOrderInput,
  workOrderConfirmation,
  workOrderLabels,
  workOrderStatuses,
  type QuoteWorkOrder,
  type WorkOrderInput,
  type WorkOrderStatus,
} from "./model"

type Props = {
  quote: QuoteWithClient
  onChanged?: () => Promise<void> | void
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" })

/** Each account/quote owns its state; late requests never follow navigation. */
export function QuoteWorkOrderPanel(props: Props) {
  if (props.quote.status !== "accepted") return null
  return (
    <WorkOrderPanel key={`${props.quote.company_id}:${props.quote.id}`} {...props} />
  )
}

function WorkOrderPanel({ quote, onChanged }: Props) {
  const id = useId()
  const [record, setRecord] = useState<QuoteWorkOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<WorkOrderStatus>("scheduled")
  const [scheduledFor, setScheduledFor] = useState("")
  const [fieldError, setFieldError] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [pending, setPending] = useState<WorkOrderInput | null>(null)
  const active = useRef(true)
  const lock = useRef(false)
  const request = useRef(0)
  const controllers = useRef(new Set<AbortController>())
  const currentStatus = record?.status ?? "to_schedule"

  const load = useCallback(async () => {
    if (lock.current) return
    const ticket = ++request.current
    const abort = new AbortController()
    controllers.current.add(abort)
    setLoading(true)
    setReady(false)
    setError("")
    try {
      const result = await getQuoteWorkOrder(quote.id, quote.company_id, abort.signal)
      if (!active.current || ticket !== request.current) return
      setRecord(result)
      setReady(true)
      setEditing(false)
      setPending(null)
      setFieldError("")
    } catch (failure) {
      if (active.current && ticket === request.current && !abort.signal.aborted)
        setError(workOrderError(failure))
    } finally {
      controllers.current.delete(abort)
      if (active.current && ticket === request.current) setLoading(false)
    }
  }, [quote.id, quote.company_id, quote.updated_at])

  useEffect(() => {
    active.current = true
    void load()
    const pendingRequests = controllers.current
    return () => {
      active.current = false
      request.current++
      pendingRequests.forEach((controller) => controller.abort())
      pendingRequests.clear()
    }
  }, [load])

  function edit(nextStatus = currentStatus) {
    setStatus(nextStatus)
    setScheduledFor(nextStatus === "to_schedule" ? "" : (record?.scheduled_for ?? ""))
    setFieldError("")
    setNotice("")
    setEditing(true)
  }

  async function save(input: WorkOrderInput) {
    if (lock.current || !ready || loading) return
    lock.current = true
    const abort = new AbortController()
    controllers.current.add(abort)
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const result = await saveQuoteWorkOrder(
        quote.id,
        quote.company_id,
        input,
        record?.updated_at ?? null,
        abort.signal,
      )
      if (!active.current) return
      setRecord(result)
      setEditing(false)
      setPending(null)
      setNotice("Le suivi de l’intervention est enregistré.")
      try {
        await onChanged?.()
      } catch {
        if (active.current)
          setNotice(
            "Le suivi est enregistré. Actualisez le dossier pour mettre à jour son journal.",
          )
      }
    } catch (failure) {
      if (!active.current || abort.signal.aborted) return
      setError(workOrderError(failure))
      // A timeout may follow a successful database write. Read before repeating.
      setReady(false)
      setPending(null)
    } finally {
      controllers.current.delete(abort)
      lock.current = false
      if (active.current) setBusy(false)
    }
  }

  function propose(input: WorkOrderInput) {
    if (lock.current || !ready || loading) return
    const invalid = validateWorkOrderInput(input)
    if (invalid) {
      setFieldError(invalid)
      return
    }
    setFieldError("")
    if (workOrderConfirmation(record?.status ?? null, input.status)) setPending(input)
    else void save(input)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    propose({
      status,
      scheduled_for: status === "to_schedule" ? null : scheduledFor || null,
    })
  }

  function primaryAction() {
    if (currentStatus === "to_schedule") edit("scheduled")
    else if (currentStatus === "scheduled")
      propose({ status: "in_progress", scheduled_for: record?.scheduled_for ?? null })
    else if (currentStatus === "in_progress")
      propose({ status: "completed", scheduled_for: record?.scheduled_for ?? null })
    else edit("to_schedule")
  }

  const disabled = loading || busy || !ready
  const confirmation = pending
    ? workOrderConfirmation(record?.status ?? null, pending.status)
    : null

  return (
    <Card className="min-w-0 p-5 sm:p-6" role="region" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-title`} className="flex items-center gap-2 font-semibold">
          <Wrench size={19} aria-hidden="true" /> Intervention
        </h2>
        <Button
          variant="ghost"
          loading={loading}
          disabled={loading || busy}
          onClick={() => void load()}
        >
          <RefreshCw size={16} aria-hidden="true" /> Actualiser
        </Button>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">
        Le devis est accepté. Suivez maintenant la réalisation du travail.
      </p>
      {loading && !ready && !record ? (
        <Spinner />
      ) : (
        <>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-danger-soft p-3 text-sm leading-6 text-danger"
            >
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mt-4 text-sm leading-6 text-primary">
              {notice}
            </p>
          )}
          {(record || ready) && (
            <div className="mt-4 rounded-lg border border-line p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                {currentStatus === "completed" && (
                  <Check size={16} aria-hidden="true" />
                )}
                {workOrderLabels[currentStatus]}
              </p>
              {record?.scheduled_for && (
                <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-ink-soft">
                  <CalendarDays
                    size={16}
                    className="mt-1 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Date prévue :{" "}
                    <time dateTime={record.scheduled_for}>
                      {dateFormatter.format(
                        new Date(`${record.scheduled_for}T12:00:00`),
                      )}
                    </time>
                  </span>
                </p>
              )}
              {!record && (
                <p className="mt-1 text-sm leading-6 text-muted">
                  Aucune date prévue pour le moment.
                </p>
              )}
            </div>
          )}
          {editing ? (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <Field label="État de l’intervention" htmlFor={`${id}-status`}>
                <Select
                  id={`${id}-status`}
                  value={status}
                  disabled={disabled}
                  onChange={(event) => {
                    setStatus(event.target.value as WorkOrderStatus)
                    setFieldError("")
                  }}
                >
                  {workOrderStatuses.map((entry) => (
                    <option key={entry} value={entry}>
                      {workOrderLabels[entry]}
                    </option>
                  ))}
                </Select>
              </Field>
              {status !== "to_schedule" && (
                <Field
                  label="Date prévue"
                  htmlFor={`${id}-date`}
                  required={status === "scheduled"}
                  hint={
                    status === "scheduled"
                      ? "Choisissez la date convenue avec votre client."
                      : "Facultatif. La date déjà prévue peut être conservée."
                  }
                  error={fieldError || undefined}
                >
                  <Input
                    id={`${id}-date`}
                    type="date"
                    value={scheduledFor}
                    required={status === "scheduled"}
                    min="1900-01-01"
                    max="2200-12-31"
                    disabled={disabled}
                    onChange={(event) => {
                      setScheduledFor(event.target.value)
                      setFieldError("")
                    }}
                  />
                </Field>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={disabled} loading={busy}>
                  Enregistrer
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setEditing(false)}
                >
                  Annuler
                </Button>
              </div>
            </form>
          ) : (
            (record || ready) && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  disabled={disabled}
                  loading={busy}
                  onClick={primaryAction}
                  variant={currentStatus === "completed" ? "secondary" : "primary"}
                >
                  {
                    {
                      to_schedule: "Planifier l’intervention",
                      scheduled: "Commencer l’intervention",
                      in_progress: "Marquer comme terminée",
                      completed: "Rouvrir le suivi",
                    }[currentStatus]
                  }
                </Button>
                {currentStatus === "to_schedule" && (
                  <Button
                    variant="secondary"
                    disabled={disabled}
                    onClick={() =>
                      propose({
                        status: "in_progress",
                        scheduled_for: record?.scheduled_for ?? null,
                      })
                    }
                  >
                    Déjà en cours
                  </Button>
                )}
                {record && currentStatus !== "completed" && (
                  <Button variant="ghost" disabled={disabled} onClick={() => edit()}>
                    Modifier
                  </Button>
                )}
              </div>
            )
          )}
          {(record || ready) && (
            <p className="mt-4 text-xs leading-5 text-muted">
              Les changements sont conservés dans le journal du dossier. Le suivi de
              l’intervention ne modifie pas la décision du client.
            </p>
          )}
        </>
      )}
      {pending && (
        <Dialog
          titleId={`${id}-confirm`}
          onClose={() => {
            if (!busy) setPending(null)
          }}
        >
          <h2 id={`${id}-confirm`} className="text-xl font-semibold">
            {confirmation === "complete"
              ? "Terminer l’intervention ?"
              : "Rouvrir le suivi ?"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            {confirmation === "complete"
              ? "Confirmez que le travail prévu pour ce devis est terminé. Vous pourrez rouvrir le suivi si nécessaire."
              : "L’intervention reprendra le suivi choisi. La clôture précédente restera dans le journal du dossier."}
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Annuler
            </Button>
            <Button loading={busy} disabled={busy} onClick={() => void save(pending)}>
              {confirmation === "complete"
                ? "Confirmer la fin"
                : "Confirmer la réouverture"}
            </Button>
          </div>
        </Dialog>
      )}
    </Card>
  )
}
