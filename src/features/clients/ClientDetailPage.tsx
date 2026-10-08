import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowRight, Mail, Pencil, Phone, Plus } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  Spinner,
  StatusBadge,
} from "@/components/ui"
import { useAdmin } from "@/features/admin/AdminContext"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import { getClient } from "./api"
import { listQuotesForClient } from "@/features/quotes/api"
import { getDashboardData, type DashboardData } from "@/features/dashboard/api"
import { getReminderPrefs } from "@/features/notifications/api"
import { quoteSituationLink, resolveQuoteSituation } from "@/features/quotes/situation"
import { humanizeError } from "@/lib/errors"
import { formatCents } from "@/lib/money"
import type { Client, Quote } from "@/types"

export function ClientDetailPage() {
  const { clientId } = useParams()
  const { user, loading: authLoading } = useAuth()
  const { isAdmin, loading: adminLoading } = useAdmin()
  const { company, loading: companyLoading } = useCompany()
  if (authLoading || adminLoading || companyLoading) return <Spinner />
  if (!user || !company || !clientId)
    return <ErrorState message="Sélectionnez une entreprise pour ouvrir ce client." />
  return (
    <ScopedClientDetail
      key={`${user.id}:${company.id}:${clientId}`}
      userId={user.id}
      isAdmin={isAdmin}
      companyId={company.id}
      clientId={clientId}
    />
  )
}

function ScopedClientDetail({
  userId,
  isAdmin,
  companyId,
  clientId,
}: {
  userId: string
  isAdmin: boolean
  companyId: string
  clientId: string
}) {
  const [client, setClient] = useState<Client | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [workspace, setWorkspace] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [contextError, setContextError] = useState("")
  const requestId = useRef(0)
  const load = useCallback(async () => {
    const request = ++requestId.current
    setLoading(true)
    setError("")
    setContextError("")
    const workspaceRead = async () => {
      // An unavailable preference must not silently become an assumed J+3 rule.
      const prefs = isAdmin
        ? { followupDelayDays: 3 }
        : await getReminderPrefs(userId, companyId).catch(() => null)
      return getDashboardData(companyId, prefs?.followupDelayDays ?? 3, prefs === null)
    }
    try {
      const [loadedClient, loadedQuotes, dashboard] = await Promise.all([
        getClient(clientId, companyId),
        listQuotesForClient(clientId, companyId),
        workspaceRead()
          .then((data) => ({ data, error: "" }))
          .catch(() => ({
            data: null,
            error:
              "Le suivi des relances n’a pas pu être vérifié. Ouvrez un devis pour consulter son état.",
          })),
      ])
      if (request !== requestId.current) return
      if (loadedClient.company_id !== companyId)
        throw new Error("client_scope_mismatch")
      setClient(loadedClient)
      setQuotes(
        loadedQuotes.filter(
          (quote) => quote.company_id === companyId && quote.client_id === clientId,
        ),
      )
      setWorkspace(dashboard.data)
      setContextError(
        dashboard.error ||
          (dashboard.data?.context.preferencesUnavailable
            ? "Votre délai de rappel n’a pas pu être chargé. Les relances à préparer restent à vérifier."
            : ""),
      )
    } catch (err) {
      if (request === requestId.current)
        setError(humanizeError(err, "Fiche client introuvable."))
    } finally {
      if (request === requestId.current) setLoading(false)
    }
  }, [userId, isAdmin, companyId, clientId])
  useEffect(() => {
    void load()
    return () => {
      requestId.current++
    }
  }, [load])
  if (loading) return <Spinner />
  if (error || !client)
    return <ErrorState message={error || "Client introuvable."} onRetry={load} />

  const situations = new Map(
    quotes.map((quote) => [
      quote.id,
      workspace
        ? resolveQuoteSituation(
            {
              ...quote,
              client: { id: client.id, name: client.name },
            },
            workspace.context,
            workspace.followupDelayDays,
          )
        : null,
    ]),
  )
  const orderedQuotes = [...quotes].sort((a, b) => {
    const attention = (quote: Quote) => {
      const situation = situations.get(quote.id)
      return situation?.attention
        ? 0
        : quote.status === "accepted" || quote.status === "refused"
          ? 2
          : 1
    }
    return attention(a) - attention(b) || b.created_at.localeCompare(a.created_at)
  })

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle="Coordonnées, devis et prochaines actions au même endroit."
        back={{ to: "/app/clients", label: "Retour aux clients" }}
        actions={
          <LinkButton to={`/app/quotes/new?client=${client.id}`}>
            <Plus size={16} aria-hidden="true" /> Ajouter un devis
          </LinkButton>
        }
      />
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="min-w-0" aria-labelledby="client-quotes-title">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="client-quotes-title" className="text-base font-semibold text-ink">
              Devis de ce client
            </h2>
            <span className="text-sm text-muted">{quotes.length} devis</span>
          </div>
          {contextError && (
            <Card className="mb-3 border-warning/25 bg-warning-soft p-4">
              <p role="alert" className="text-sm leading-6 text-warning">
                {contextError}
              </p>
              <Button variant="ghost" onClick={load} className="mt-2">
                Réessayer le suivi
              </Button>
            </Card>
          )}
          {quotes.length === 0 ? (
            <EmptyState
              title="Ajoutez son premier devis"
              description="Importez un PDF ou une photo. Les coordonnées de ce client sont déjà sélectionnées."
              action={
                <LinkButton to={`/app/quotes/new?client=${client.id}`}>
                  <Plus size={16} aria-hidden="true" /> Ajouter un devis
                </LinkButton>
              }
            />
          ) : (
            <div className="space-y-3">
              {orderedQuotes.map((quote) => {
                const situation = situations.get(quote.id)
                const tone =
                  situation?.tone === "danger"
                    ? "text-danger"
                    : situation?.tone === "warning"
                      ? "text-warning"
                      : "text-ink-soft"
                return (
                  <Card key={quote.id} className="p-4 sm:p-5">
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to={`/app/quotes/${quote.id}`}
                          className="inline-flex min-h-11 items-center break-words font-semibold text-ink hover:text-primary"
                        >
                          {quote.reference}
                        </Link>
                        <p className="text-sm font-semibold tabular-nums text-ink">
                          {formatCents(quote.amount_cents)}
                        </p>
                      </div>
                      <StatusBadge status={quote.status} />
                    </div>
                    {situation ? (
                      <div className="mt-3 border-t border-line pt-3">
                        <p className={`text-sm font-medium ${tone}`}>
                          {situation.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted">
                          {situation.detail}
                        </p>
                        <Link
                          to={quoteSituationLink(quote.id, situation)}
                          className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary"
                        >
                          {situation.label}
                          <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                      </div>
                    ) : (
                      <Link
                        to={`/app/quotes/${quote.id}`}
                        className="mt-3 flex min-h-11 items-center justify-between border-t border-line pt-2 text-sm font-medium text-primary"
                      >
                        Voir le dossier
                        <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </section>
        <Card className="min-w-0 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">Coordonnées</h2>
            <Link
              to={`/app/clients/${client.id}/edit`}
              aria-label="Modifier les coordonnées du client"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary"
            >
              <Pencil size={15} aria-hidden="true" /> Modifier
            </Link>
          </div>
          {client.email ? (
            <a
              href={`mailto:${client.email}`}
              className="flex min-h-11 items-center gap-2 py-2 text-sm text-ink hover:text-primary"
            >
              <Mail size={16} aria-hidden="true" className="shrink-0" />
              <span className="break-all">{client.email}</span>
            </a>
          ) : (
            <p className="py-2 text-sm text-muted">Adresse email à compléter</p>
          )}
          {client.phone && (
            <a
              href={`tel:${client.phone.replace(/[^\d+]/g, "")}`}
              className="flex min-h-11 items-center gap-2 py-2 text-sm text-ink hover:text-primary"
            >
              <Phone size={16} aria-hidden="true" className="shrink-0" />
              <span className="break-words">{client.phone}</span>
            </a>
          )}
          {client.notes && (
            <details className="mt-3 border-t border-line pt-2">
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-ink">
                Notes internes
              </summary>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">
                {client.notes}
              </p>
            </details>
          )}
        </Card>
      </div>
    </>
  )
}
