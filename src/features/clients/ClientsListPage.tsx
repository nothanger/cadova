import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Plus } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  Spinner,
  TableScroll,
} from "@/components/ui"
import { useCompany } from "@/features/company/CompanyContext"
import { listClientsWithCounts } from "./api"
import { humanizeError } from "@/lib/errors"
import { formatDate } from "@/lib/dates"
import type { Client } from "@/types"

export function ClientsListPage() {
  const { company } = useCompany()
  const [clients, setClients] = useState<(Client & { quote_count: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function load() {
    if (!company) return
    setLoading(true)
    setError("")
    try {
      setClients(await listClientsWithCounts(company.id))
    } catch (err) {
      setError(humanizeError(err, "Impossible de charger les clients."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [company?.id])

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Vos clients et prospects."
        actions={
          <LinkButton to="/app/clients/new">
            <Plus size={16} /> Nouveau client
          </LinkButton>
        }
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : clients.length === 0 ? (
        <EmptyState
          title="Aucun client pour le moment"
          description="Créez votre premier client pour pouvoir lui associer des devis."
          action={
            <LinkButton to="/app/clients/new">
              <Plus size={16} /> Créer mon premier client
            </LinkButton>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <TableScroll>
            <table className="min-w-[580px] w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th scope="col" className="px-5 py-3 font-medium">
                    Nom
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Email
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Téléphone
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Devis
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Créé le
                  </th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-line last:border-0 hover:bg-background"
                  >
                    <td className="px-5 py-3">
                      <Link
                        to={`/app/clients/${c.id}`}
                        className="font-medium text-ink hover:text-primary"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{c.email ?? "—"}</td>
                    <td className="px-5 py-3 text-ink-soft">{c.phone ?? "—"}</td>
                    <td className="px-5 py-3 text-ink-soft">{c.quote_count}</td>
                    <td className="px-5 py-3 text-muted">
                      {formatDate(c.created_at.slice(0, 10))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Card>
      )}
    </>
  )
}
