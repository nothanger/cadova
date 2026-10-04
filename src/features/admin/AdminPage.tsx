import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  ArrowRight,
  ArrowRightLeft,
  Building2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react"
import { CadovaLogo } from "@/components/CadovaLogo"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Spinner,
  TableScroll,
  cx,
} from "@/components/ui"
import { Dialog } from "@/components/ui/Dialog"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import { formatDate } from "@/lib/dates"
import { useAdmin } from "./AdminContext"
import {
  adminErrorMessage,
  deleteAdminUser,
  listAdminCompanies,
  listAdminUsers,
  setAdminUserSuspended,
  transferCompanyOwner,
} from "./api"
import type { AdminCompany, AdminUser } from "./types"

type AccountAction = {
  kind: "delete" | "suspend" | "resume"
  user: AdminUser
}

function isSuspended(user: AdminUser) {
  return Boolean(user.banned_until && Date.parse(user.banned_until) > Date.now())
}

function displayDate(value: string | null) {
  return value && !Number.isNaN(Date.parse(value))
    ? formatDate(value.slice(0, 10))
    : "—"
}

function usePagedList<T extends { page: number; hasMore: boolean }>(
  loader: (page: number) => Promise<T>,
  enabled: boolean,
) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const request = useRef(0)
  const load = useCallback(async () => {
    if (!enabled) return
    const current = ++request.current
    setLoading(true)
    setError("")
    try {
      const result = await loader(page)
      if (request.current === current) setData(result)
    } catch (err) {
      if (request.current === current) {
        setError(adminErrorMessage(err, "Impossible de charger cette liste."))
      }
    } finally {
      if (request.current === current) setLoading(false)
    }
  }, [enabled, loader, page])

  useEffect(() => {
    void load()
    return () => {
      request.current += 1
    }
  }, [load])

  return { page, setPage, data, loading, error, refresh: load }
}

function Pagination({
  page,
  hasMore,
  loading,
  label,
  onChange,
}: {
  page: number
  hasMore: boolean
  loading: boolean
  label: string
  onChange: (page: number) => void
}) {
  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5"
    >
      <p className="text-sm text-muted">Page {page}</p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          aria-label="Page précédente"
          disabled={loading || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Précédente</span>
        </Button>
        <Button
          variant="secondary"
          aria-label="Page suivante"
          disabled={loading || !hasMore}
          onClick={() => onChange(page + 1)}
        >
          <span className="hidden sm:inline">Suivante</span>
          <ChevronRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}

function AccountStatus({ user }: { user: AdminUser }) {
  const suspended = isSuspended(user)
  return (
    <div className="flex flex-wrap gap-1.5">
      <span
        className={cx(
          "inline-flex rounded-md border px-2 py-1 text-xs font-medium",
          suspended
            ? "border-danger/20 bg-danger-soft text-danger"
            : user.email_confirmed_at
              ? "border-success/20 bg-success-soft text-success"
              : "border-warning/20 bg-warning-soft text-warning",
        )}
      >
        {suspended
          ? "Suspendu"
          : user.email_confirmed_at
            ? "Compte validé"
            : "Email à confirmer"}
      </span>
      {user.is_admin && (
        <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary-soft px-2 py-1 text-xs font-medium text-primary">
          <ShieldCheck size={13} aria-hidden="true" /> Admin
        </span>
      )}
    </div>
  )
}

function AccountActionDialog({
  action,
  onClose,
  onDone,
}: {
  action: AccountAction
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [email, setEmail] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const deleting = action.kind === "delete"
  const suspending = action.kind === "suspend"
  const title = deleting
    ? "Supprimer le compte"
    : suspending
      ? "Suspendre le compte"
      : "Réactiver le compte"
  const canSubmit = !deleting || email === action.user.email

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !canSubmit) return
    setSaving(true)
    setError("")
    try {
      if (deleting) {
        await deleteAdminUser(action.user.id, email)
      } else {
        await setAdminUserSuspended(action.user.id, suspending)
      }
      onDone(
        deleting
          ? `Le compte ${action.user.email} a été supprimé.`
          : suspending
            ? `Le compte ${action.user.email} est suspendu.`
            : `Le compte ${action.user.email} est réactivé.`,
      )
    } catch (err) {
      setError(adminErrorMessage(err, "L’action n’a pas pu être effectuée."))
      setSaving(false)
    }
  }

  return (
    <Dialog titleId="account-action-title" onClose={() => !saving && onClose()}>
      <form onSubmit={submit}>
        <h2 id="account-action-title" className="text-xl font-semibold text-ink">
          {title}
        </h2>
        <p className="mt-2 break-all text-sm font-medium text-ink">
          {action.user.email}
        </p>
        <p className="mt-4 text-sm leading-6 text-muted">
          {deleting
            ? "Cette suppression est définitive. Le compte perdra l’accès à Cadova. Les dossiers des entreprises seront conservés. Si ce compte est le dernier propriétaire d’une entreprise, transférez d’abord sa propriété depuis l’onglet Entreprises."
            : suspending
              ? "Ce compte ne pourra plus accéder à Cadova. Ses dossiers seront conservés et vous pourrez réactiver son accès."
              : "Ce compte pourra de nouveau accéder à Cadova avec ses identifiants habituels."}
        </p>
        {deleting && (
          <div className="mt-5">
            <Field
              htmlFor="delete-account-email"
              label="Adresse email du compte"
              hint="Recopiez exactement l’adresse ci-dessus pour confirmer la suppression."
              required
            >
              <Input
                id="delete-account-email"
                type="email"
                autoComplete="off"
                spellCheck={false}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={saving}
                required
              />
            </Field>
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="submit"
            variant={deleting || suspending ? "danger" : "primary"}
            disabled={!canSubmit}
            loading={saving}
          >
            {deleting ? "Supprimer définitivement" : title}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function TransferDialog({
  company,
  onClose,
  onDone,
}: {
  company: AdminCompany
  onClose: () => void
  onDone: (message: string) => void
}) {
  const accounts = usePagedList(listAdminUsers, true)
  const [filter, setFilter] = useState("")
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const candidates = (accounts.data?.users ?? []).filter((account) =>
    (account.email ?? "")
      .toLocaleLowerCase("fr")
      .includes(filter.toLocaleLowerCase("fr")),
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !confirmed || saving) return
    setSaving(true)
    setError("")
    try {
      await transferCompanyOwner(company.id, selected.id)
      onDone(`La propriété de ${company.name} a été transférée à ${selected.email}.`)
    } catch (err) {
      setError(adminErrorMessage(err, "Le transfert n’a pas pu être effectué."))
      setSaving(false)
    }
  }

  return (
    <Dialog titleId="transfer-company-title" onClose={() => !saving && onClose()}>
      <form onSubmit={submit}>
        <h2 id="transfer-company-title" className="text-xl font-semibold text-ink">
          Transférer la propriété
        </h2>
        <p className="mt-2 break-words font-medium text-ink">{company.name}</p>
        <p className="mt-3 text-sm leading-6 text-muted">
          Le nouveau propriétaire pourra gérer cette entreprise. Les propriétaires
          actuels resteront membres de l’entreprise.
        </p>
        <div className="mt-5">
          <Field htmlFor="owner-filter" label="Filtrer les comptes de cette page">
            <Input
              id="owner-filter"
              type="search"
              placeholder="Rechercher une adresse email"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              disabled={saving}
            />
          </Field>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-line">
          {accounts.loading ? (
            <Spinner label="Chargement des comptes…" />
          ) : accounts.error ? (
            <ErrorState message={accounts.error} onRetry={accounts.refresh} />
          ) : (
            <fieldset className="max-h-60 overflow-y-auto p-3">
              <legend className="sr-only">Nouveau propriétaire</legend>
              {candidates.length === 0 ? (
                <p className="p-2 text-sm text-muted">Aucun compte sur cette page.</p>
              ) : (
                candidates.map((account) => {
                  const alreadyOwner = company.owners.some(
                    (owner) => owner.id === account.id,
                  )
                  const otherCompany =
                    !account.is_admin &&
                    account.companies.some((membership) => membership.id !== company.id)
                  const unavailable =
                    alreadyOwner ||
                    otherCompany ||
                    isSuspended(account) ||
                    !account.email
                  return (
                    <label
                      key={account.id}
                      className={cx(
                        "flex items-start gap-3 rounded-md p-3 text-sm",
                        unavailable
                          ? "text-muted"
                          : "cursor-pointer hover:bg-background",
                        selected?.id === account.id && "bg-primary-soft",
                      )}
                    >
                      <input
                        type="radio"
                        name="new-owner"
                        value={account.id}
                        checked={selected?.id === account.id}
                        disabled={saving || unavailable}
                        onChange={() => {
                          setSelected(account)
                          setConfirmed(false)
                        }}
                        className="mt-1 shrink-0 accent-primary"
                      />
                      <span className="min-w-0 break-all">
                        {account.email ?? "Compte sans adresse email"}
                        {alreadyOwner && (
                          <span className="mt-1 block text-xs">Déjà propriétaire</span>
                        )}
                        {!alreadyOwner && isSuspended(account) && (
                          <span className="mt-1 block text-xs">Compte suspendu</span>
                        )}
                        {!alreadyOwner && !isSuspended(account) && otherCompany && (
                          <span className="mt-1 block text-xs">
                            Déjà rattaché à une autre entreprise
                          </span>
                        )}
                      </span>
                    </label>
                  )
                })
              )}
            </fieldset>
          )}
          <Pagination
            page={accounts.page}
            hasMore={accounts.data?.hasMore ?? false}
            loading={accounts.loading || saving}
            label="Choix du propriétaire"
            onChange={(page) => {
              accounts.setPage(page)
              setFilter("")
            }}
          />
        </div>
        {selected && (
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary-soft p-3 text-sm">
            <p className="text-ink">Nouveau propriétaire</p>
            <p className="mt-1 break-all font-medium text-primary">{selected.email}</p>
          </div>
        )}
        <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-ink">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            disabled={!selected || saving}
            className="mt-1.5 shrink-0 accent-primary"
          />
          Je confirme ce transfert de propriété.
        </label>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={!selected || !confirmed} loading={saving}>
            Transférer la propriété
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export function AdminPage() {
  const { user, signOut } = useAuth()
  const {
    isAdmin,
    loading: adminLoading,
    error: adminError,
    refresh: refreshAdmin,
  } = useAdmin()
  const { selectCompany } = useCompany()
  const navigate = useNavigate()
  const accounts = usePagedList(listAdminUsers, isAdmin && !adminLoading)
  const companies = usePagedList(listAdminCompanies, isAdmin && !adminLoading)
  const [tab, setTab] = useState<"accounts" | "companies">("accounts")
  const [accountFilter, setAccountFilter] = useState("")
  const [companyFilter, setCompanyFilter] = useState("")
  const [accountAction, setAccountAction] = useState<AccountAction | null>(null)
  const [transferCompany, setTransferCompany] = useState<AdminCompany | null>(null)
  const [notice, setNotice] = useState("")
  const [actionError, setActionError] = useState("")
  const [opening, setOpening] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const activeList = tab === "accounts" ? accounts : companies
  const filteredUsers = (accounts.data?.users ?? []).filter((account) =>
    (account.email ?? "")
      .toLocaleLowerCase("fr")
      .includes(accountFilter.toLocaleLowerCase("fr")),
  )
  const filteredCompanies = (companies.data?.companies ?? []).filter((company) =>
    company.name
      .toLocaleLowerCase("fr")
      .includes(companyFilter.toLocaleLowerCase("fr")),
  )

  async function logout() {
    setLoggingOut(true)
    setActionError("")
    try {
      await signOut()
      navigate("/login", { replace: true })
    } catch {
      setActionError("Impossible de vous déconnecter. Réessayez.")
      setLoggingOut(false)
    }
  }

  async function openCompany(company: AdminCompany) {
    if (opening) return
    setOpening(company.id)
    setActionError("")
    try {
      await selectCompany(company.id)
      navigate("/app")
    } catch {
      setActionError(
        "Impossible d’ouvrir cette entreprise. Actualisez la liste et réessayez.",
      )
    } finally {
      setOpening(null)
    }
  }

  function mutationDone(message: string) {
    const deletedLastRow =
      accountAction?.kind === "delete" &&
      accounts.data?.users.length === 1 &&
      accounts.page > 1
    setAccountAction(null)
    setTransferCompany(null)
    setActionError("")
    setNotice(message)
    if (deletedLastRow) accounts.setPage(accounts.page - 1)
    else void accounts.refresh()
    void companies.refresh()
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Cadova, accueil" className="shrink-0">
            <CadovaLogo className="h-8 w-auto sm:h-9" />
          </Link>
          <Button variant="secondary" onClick={logout} loading={loggingOut}>
            <LogOut size={16} aria-hidden="true" /> Se déconnecter
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        <PageHeader
          title="Administration"
          subtitle="Gérez les comptes et les entreprises de Cadova."
        />
        {adminLoading ? (
          <Spinner />
        ) : adminError ? (
          <ErrorState message={adminError} onRetry={refreshAdmin} />
        ) : !isAdmin ? (
          <ErrorState message="Cet espace est réservé aux administrateurs de Cadova." />
        ) : (
          <>
            <div
              className="mb-6 flex flex-wrap items-center gap-2 border-b border-line pb-4"
              aria-label="Sections de l’administration"
            >
              <Button
                variant={tab === "accounts" ? "primary" : "secondary"}
                aria-pressed={tab === "accounts"}
                onClick={() => setTab("accounts")}
              >
                <Users size={16} aria-hidden="true" /> Comptes
              </Button>
              <Button
                variant={tab === "companies" ? "primary" : "secondary"}
                aria-pressed={tab === "companies"}
                onClick={() => setTab("companies")}
              >
                <Building2 size={16} aria-hidden="true" /> Entreprises
              </Button>
            </div>
            {notice && (
              <p
                role="status"
                className="mb-5 break-words rounded-lg border border-success/20 bg-success-soft p-3 text-sm text-success"
              >
                {notice}
              </p>
            )}
            {actionError && (
              <p
                role="alert"
                className="mb-5 rounded-lg bg-danger-soft p-3 text-sm text-danger"
              >
                {actionError}
              </p>
            )}
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="w-full sm:max-w-md">
                <Field
                  htmlFor="admin-filter"
                  label={
                    tab === "accounts"
                      ? "Filtrer les comptes de cette page"
                      : "Filtrer les entreprises de cette page"
                  }
                  hint="Pour consulter les autres résultats, passez à la page suivante."
                >
                  <Input
                    id="admin-filter"
                    type="search"
                    placeholder={
                      tab === "accounts"
                        ? "Rechercher une adresse email"
                        : "Rechercher une entreprise"
                    }
                    value={tab === "accounts" ? accountFilter : companyFilter}
                    onChange={(event) =>
                      tab === "accounts"
                        ? setAccountFilter(event.target.value)
                        : setCompanyFilter(event.target.value)
                    }
                  />
                </Field>
              </div>
              <Button
                variant="secondary"
                loading={activeList.loading}
                onClick={() => {
                  setActionError("")
                  void activeList.refresh()
                }}
              >
                <RefreshCw size={16} aria-hidden="true" /> Actualiser
              </Button>
            </div>
            {activeList.loading ? (
              <Spinner />
            ) : activeList.error ? (
              <ErrorState message={activeList.error} onRetry={activeList.refresh} />
            ) : (
              <Card className="overflow-hidden">
                {tab === "accounts" ? (
                  filteredUsers.length === 0 ? (
                    <EmptyState
                      title="Aucun compte sur cette page"
                      description="Modifiez votre recherche ou consultez une autre page."
                    />
                  ) : (
                    <TableScroll>
                      <table className="w-full min-w-[860px] text-left text-sm">
                        <caption className="sr-only">Comptes Cadova</caption>
                        <thead className="border-b border-line bg-background text-xs text-muted">
                          <tr>
                            <th scope="col" className="px-5 py-3 font-medium">
                              Compte
                            </th>
                            <th scope="col" className="px-5 py-3 font-medium">
                              Statut
                            </th>
                            <th scope="col" className="px-5 py-3 font-medium">
                              Entreprises
                            </th>
                            <th scope="col" className="px-5 py-3 font-medium">
                              Dernière connexion
                            </th>
                            <th scope="col" className="px-5 py-3 font-medium">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUsers.map((account) => {
                            const protectedAccount =
                              account.is_admin || account.id === user?.id
                            const suspended = isSuspended(account)
                            return (
                              <tr
                                key={account.id}
                                className="border-b border-line last:border-0"
                              >
                                <th
                                  scope="row"
                                  className="min-w-64 max-w-80 px-5 py-4 font-normal"
                                >
                                  <p className="break-all font-medium text-ink">
                                    {account.email ?? "Compte sans adresse email"}
                                  </p>
                                  <p className="mt-1 whitespace-nowrap text-xs text-muted">
                                    Créé le {displayDate(account.created_at)}
                                  </p>
                                </th>
                                <td className="px-5 py-4">
                                  <AccountStatus user={account} />
                                </td>
                                <td className="max-w-56 px-5 py-4 text-ink-soft">
                                  {account.companies.length === 0 ? (
                                    "Aucune entreprise"
                                  ) : (
                                    <ul className="space-y-1">
                                      {account.companies.map((company) => (
                                        <li key={company.id} className="break-words">
                                          {company.name}
                                          <span className="ml-1 text-xs text-muted">
                                            (
                                            {company.role === "owner"
                                              ? "Propriétaire"
                                              : "Membre"}
                                            )
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-5 py-4 text-muted">
                                  {account.last_sign_in_at
                                    ? displayDate(account.last_sign_in_at)
                                    : "Jamais"}
                                </td>
                                <td className="px-5 py-4">
                                  {protectedAccount ? (
                                    <p className="flex items-center gap-1.5 text-xs text-muted">
                                      <ShieldCheck size={14} aria-hidden="true" />{" "}
                                      Compte protégé
                                    </p>
                                  ) : (
                                    <div className="flex gap-2">
                                      <Button
                                        variant="secondary"
                                        aria-label={`${suspended ? "Réactiver" : "Suspendre"} ${account.email}`}
                                        onClick={() => {
                                          setNotice("")
                                          setAccountAction({
                                            kind: suspended ? "resume" : "suspend",
                                            user: account,
                                          })
                                        }}
                                      >
                                        {suspended ? (
                                          <Play size={15} aria-hidden="true" />
                                        ) : (
                                          <Pause size={15} aria-hidden="true" />
                                        )}
                                        {suspended ? "Réactiver" : "Suspendre"}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        className="text-danger"
                                        aria-label={`Supprimer ${account.email}`}
                                        disabled={!account.email}
                                        onClick={() => {
                                          setNotice("")
                                          setAccountAction({
                                            kind: "delete",
                                            user: account,
                                          })
                                        }}
                                      >
                                        <Trash2 size={16} aria-hidden="true" />
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </TableScroll>
                  )
                ) : filteredCompanies.length === 0 ? (
                  <EmptyState
                    title="Aucune entreprise sur cette page"
                    description="Modifiez votre recherche ou consultez une autre page."
                  />
                ) : (
                  <TableScroll>
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <caption className="sr-only">Entreprises Cadova</caption>
                      <thead className="border-b border-line bg-background text-xs text-muted">
                        <tr>
                          <th scope="col" className="px-5 py-3 font-medium">
                            Entreprise
                          </th>
                          <th scope="col" className="px-5 py-3 font-medium">
                            Propriétaires
                          </th>
                          <th scope="col" className="px-5 py-3 font-medium">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCompanies.map((company) => (
                          <tr
                            key={company.id}
                            className="border-b border-line last:border-0"
                          >
                            <th scope="row" className="max-w-64 px-5 py-4 font-normal">
                              <p className="break-words font-medium text-ink">
                                {company.name}
                              </p>
                              <p className="mt-1 text-xs text-muted">
                                Créée le {displayDate(company.created_at)}
                              </p>
                            </th>
                            <td className="max-w-72 px-5 py-4 text-ink-soft">
                              {company.owners.length === 0 ? (
                                <span className="text-warning">Aucun propriétaire</span>
                              ) : (
                                <ul className="space-y-1">
                                  {company.owners.map((owner) => (
                                    <li key={owner.id} className="break-all">
                                      {owner.email ?? "Compte sans adresse email"}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="secondary"
                                  aria-label={`Ouvrir l’entreprise ${company.name}`}
                                  loading={opening === company.id}
                                  disabled={opening !== null}
                                  onClick={() => void openCompany(company)}
                                >
                                  <ArrowRight size={16} aria-hidden="true" /> Ouvrir
                                  l’entreprise
                                </Button>
                                <Button
                                  variant="ghost"
                                  aria-label={`Transférer la propriété de ${company.name}`}
                                  onClick={() => {
                                    setNotice("")
                                    setTransferCompany(company)
                                  }}
                                >
                                  <ArrowRightLeft size={16} aria-hidden="true" />{" "}
                                  Transférer la propriété
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableScroll>
                )}
                <Pagination
                  page={activeList.page}
                  hasMore={activeList.data?.hasMore ?? false}
                  loading={activeList.loading}
                  label={
                    tab === "accounts"
                      ? "Pagination des comptes"
                      : "Pagination des entreprises"
                  }
                  onChange={(page) => {
                    activeList.setPage(page)
                    if (tab === "accounts") setAccountFilter("")
                    else setCompanyFilter("")
                  }}
                />
              </Card>
            )}
          </>
        )}
      </main>
      {accountAction && (
        <AccountActionDialog
          action={accountAction}
          onClose={() => setAccountAction(null)}
          onDone={mutationDone}
        />
      )}
      {transferCompany && (
        <TransferDialog
          company={transferCompany}
          onClose={() => setTransferCompany(null)}
          onDone={mutationDone}
        />
      )}
    </div>
  )
}
