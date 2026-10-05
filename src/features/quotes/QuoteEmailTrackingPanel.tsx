import { useCallback, useEffect, useRef, useState } from "react"
import { MailCheck, RefreshCw } from "lucide-react"
import { Button, Card, Spinner } from "@/components/ui"
import type { QuoteWithClient } from "@/types"
import {
  deliveryStatusDetail,
  deliveryStatusLabel,
  getQuoteEmailTracking,
} from "./emailTrackingApi"

type Tracking = Awaited<ReturnType<typeof getQuoteEmailTracking>>
const date = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function QuoteEmailTrackingPanel({ quote }: { quote: QuoteWithClient }) {
  const [data, setData] = useState<Tracking | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const active = useRef(true)
  const request = useRef(0)
  const load = useCallback(async () => {
    const ticket = ++request.current
    setLoading(true)
    setError("")
    try {
      const value = await getQuoteEmailTracking(quote.id)
      if (active.current && ticket === request.current) setData(value)
    } catch {
      if (active.current && ticket === request.current)
        setError(
          "Le suivi des emails est momentanément indisponible. Actualisez pour réessayer.",
        )
    } finally {
      if (active.current && ticket === request.current) setLoading(false)
    }
  }, [quote.id, quote.updated_at])
  useEffect(() => {
    active.current = true
    void load()
    return () => {
      active.current = false
      request.current++
    }
  }, [load])
  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <MailCheck size={19} aria-hidden="true" /> Suivi des emails
        </h2>
        <Button variant="ghost" loading={loading} onClick={load}>
          <RefreshCw size={16} /> Actualiser
        </Button>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">
        L’état de livraison de vos devis et de vos relances, confirmé par le service
        email.
      </p>
      {loading && !data ? (
        <Spinner />
      ) : (
        <>
          {error && (
            <p role="status" className="mt-4 text-sm leading-6 text-muted">
              {error}
            </p>
          )}
          {data && (
            <>
              {!data.service.deliveryReady && (
                <p className="mt-4 rounded-lg bg-warning-soft p-3 text-sm leading-6 text-warning">
                  La confirmation automatique des livraisons n’est pas encore
                  configurée. Un envoi accepté ne confirme pas sa livraison.
                </p>
              )}
              {data.deliveries.length ? (
                <ol
                  aria-label="Livraison des emails du devis"
                  className="mt-4 space-y-3"
                >
                  {data.deliveries.map((delivery) => (
                    <li key={delivery.id} className="rounded-lg border border-line p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {deliveryStatusLabel(delivery.status)}
                        </p>
                        <time
                          dateTime={delivery.last_event_at}
                          className="text-xs text-muted"
                        >
                          {date.format(new Date(delivery.last_event_at))}
                        </time>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {delivery.initial_send_job_id
                          ? "Envoi du devis"
                          : "Relance automatique"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-ink-soft">
                        {deliveryStatusDetail(delivery.status)}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-sm leading-6 text-muted">
                  Aucun email suivi pour ce devis. Un devis marqué comme déjà envoyé
                  n’ajoute pas de preuve de livraison.
                </p>
              )}
              <p className="mt-5 border-t border-line pt-4 text-xs leading-5 text-muted">
                {data.service.receivingReady
                  ? "Une réponse reçue par email est ajoutée au dossier et suspend les relances automatiques. Elle ne vaut pas acceptation du devis."
                  : "La réception automatique des réponses par email n’est pas encore configurée. Les réponses arrivent à votre adresse d’entreprise : enregistrez-les dans le dossier pour arrêter les relances. Les questions déposées sur le suivi client suspendent les relances automatiquement."}
              </p>
            </>
          )}
        </>
      )}
    </Card>
  )
}
