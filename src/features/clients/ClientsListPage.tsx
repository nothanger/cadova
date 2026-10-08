import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, Mail, Phone, Plus, Search } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LinkButton,
  Spinner,
} from "@/components/ui"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import { listClientsWithCounts } from "./api"
import { humanizeError } from "@/lib/errors"
import type { Client } from "@/types"

type ClientWithCount = Client & { quote_count: number }
const searchable = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

export function ClientsListPage() {
  const { user, loading: authLoading } = useAuth()
  const { company, loading: companyLoading } = useCompany()
  if (authLoading || companyLoading) return <Spinner />
  if (!user || !company)
    return (
      <ErrorState message="Sélectionnez une entreprise pour retrouver ses clients." />
    )
  return <ScopedClientsList key={`${user.id}:${company.id}`} companyId={company.id} />
}

function ScopedClientsList({ companyId }: { companyId: string }) {
  const [clients, setClients] = useState<ClientWithCount[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const requestId = useRef(0)
  const load = useCallback(async () => {
    const request = ++requestId.current
    setLoading(true)
    setError("")
    try {
      const rows = await listClientsWithCounts(companyId)
      if (request === requestId.current)
        setClients(rows.filter((row) => row.company_id === companyId))
    } catch (err) {
      if (request === requestId.current)
        setError(humanizeError(err, "Impossible de charger les clients."))
    } finally {
      if (request === requestId.current) setLoading(false)
    }
  }, [companyId])
  useEffect(() => {
    void load()
    return () => {
      requestId.current++
    }
  }, [load])

  const needle = searchable(query)
  const phoneNeedle = query.replace(/\D/g, "")
  const filtered = clients.filter(
    (client) =>
      !needle ||
      searchable(`${client.name} ${client.email ?? ""} ${client.phone ?? ""}`).includes(
        needle,
      ) ||
      (phoneNeedle.length >= 2 &&
        !/[a-zA-Z]/.test(query) &&
        (client.phone ?? "").replace(/\D/g, "").includes(phoneNeedle)),
  )

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Retrouvez un contact et tous ses devis."
        actions={
          <LinkButton to="/app/clients/new">
            <Plus size={16} aria-hidden="true" /> Ajouter un client
          </LinkButton>
        }
      />
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : clients.length === 0 ? (
        <EmptyState
          title="Votre premier client"
          description="Vous pouvez ajouter ses coordonnées ici, ou les retrouver en important son devis."
          action={
            <LinkButton to="/app/quotes/new">
              <Plus size={16} aria-hidden="true" /> Ajouter un devis
            </LinkButton>
          }
        />
      ) : (
        <>
          <div className="mb-5 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-3.5 text-muted"
              />
              <Input
                type="search"
                aria-label="Rechercher un client"
                placeholder="Nom, email ou téléphone"
                className="pl-10"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <p className="text-sm text-muted" role="status">
              {filtered.length} client{filtered.length !== 1 ? "s" : ""}
              {query ? " trouvé" + (filtered.length !== 1 ? "s" : "") : ""}
            </p>
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              title="Aucun client trouvé"
              description="Essayez un autre nom, une adresse email ou un numéro de téléphone."
              action={
                <Button variant="secondary" onClick={() => setQuery("")}>
                  Effacer la recherche
                </Button>
              }
            />
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filtered.map((client) => (
                  <Card key={client.id} className="p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <Link
                        to={`/app/clients/${client.id}`}
                        className="min-h-11 min-w-0 break-words py-2 font-semibold text-ink hover:text-primary"
                      >
                        {client.name}
                      </Link>
                      <span className="shrink-0 rounded-md bg-background px-2.5 py-1.5 text-xs text-ink-soft">
                        {client.quote_count} devis
                      </span>
                    </div>
                    <ClientContacts client={client} />
                    <Link
                      to={`/app/clients/${client.id}`}
                      className="mt-3 flex min-h-11 items-center justify-between border-t border-line pt-2 text-sm font-medium text-primary"
                    >
                      Voir les devis
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </Card>
                ))}
              </div>
              <Card className="hidden overflow-hidden md:block">
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th scope="col" className="w-[31%] px-5 py-3 font-medium">
                        Client
                      </th>
                      <th scope="col" className="w-[37%] px-5 py-3 font-medium">
                        Coordonnées
                      </th>
                      <th scope="col" className="w-[12%] px-5 py-3 font-medium">
                        Devis
                      </th>
                      <th scope="col" className="w-[20%] px-5 py-3 font-medium">
                        <span className="sr-only">Ouvrir le client</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((client) => (
                      <tr
                        key={client.id}
                        className="border-b border-line last:border-0 hover:bg-background"
                      >
                        <td className="px-5 py-3">
                          <Link
                            to={`/app/clients/${client.id}`}
                            className="inline-flex min-h-11 items-center break-words font-medium text-ink hover:text-primary"
                          >
                            {client.name}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <ClientContacts client={client} />
                        </td>
                        <td className="px-5 py-3 tabular-nums text-ink-soft">
                          {client.quote_count}
                        </td>
                        <td className="px-5 py-3">
                          <Link
                            to={`/app/clients/${client.id}`}
                            aria-label={`Voir les devis de ${client.name}`}
                            className="inline-flex min-h-11 items-center gap-2 font-medium text-primary"
                          >
                            Voir les devis
                            <ArrowRight size={15} aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </>
      )}
    </>
  )
}

function ClientContacts({ client }: { client: Client }) {
  return (
    <div className="min-w-0 text-sm text-ink-soft">
      {client.email && (
        <a
          href={`mailto:${client.email}`}
          className="flex min-h-11 items-center gap-2 hover:text-primary"
        >
          <Mail size={15} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0 break-all">{client.email}</span>
        </a>
      )}
      {client.phone && (
        <a
          href={`tel:${client.phone.replace(/[^\d+]/g, "")}`}
          className="flex min-h-11 items-center gap-2 hover:text-primary"
        >
          <Phone size={15} aria-hidden="true" className="shrink-0" />
          <span className="break-words">{client.phone}</span>
        </a>
      )}
      {!client.email && !client.phone && (
        <p className="text-muted">Coordonnées à compléter</p>
      )}
    </div>
  )
}
