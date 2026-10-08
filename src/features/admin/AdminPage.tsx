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
  Plus,
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
  LinkButton,
} from "@/components/ui"
import { Dialog } from "@/components/ui/Dialog"
import { useAuth } from "@/features/auth/AuthContext"
import { useCompany } from "@/features/company/CompanyContext"
import { NotificationBell } from "@/features/notifications/NotificationBell"
import { formatDate } from "@/lib/dates"
import { useAdmin } from "./AdminContext"
import { AdminNotificationComposer } from "./AdminNotificationComposer"
import {
  adminErrorMessage,
  createAdminCompany,
  deleteAdminCompany,
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

type CompanyAction = { kind: "create" } | { kind: "delete"; company: AdminCompany }

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

function CreateCompanyDialog({
  onClose,
  onDone,
}: {
  onClose: () => void
  onDone: (message: string, companyId: string) => void
}) {
  const { user } = useAuth()
  const accounts = usePagedList(listAdminUsers, true)
  const [name, setName] = useState("")
  const [filter, setFilter] = useState("")
  const [selected, setSelected] = useState<{ id: string; email: string | null } | null>(
    user ? { id: user.id, email: user.email ?? null } : null,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const sending = useRef(false)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const candidates = (accounts.data?.users ?? []).filter((account) =>
    (account.email ?? "")
      .toLocaleLowerCase("fr")
      .includes(filter.trim().toLocaleLowerCase("fr")),
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending.current || !name.trim() || !selected) return
    sending.current = true
    setSaving(true)
    setError("")
    try {
      const id = await createAdminCompany(name, selected.id)
      if (active.current) onDone(`L’entreprise ${name.trim()} a été créée.`, id)
    } catch (err) {
      if (active.current)
        setError(adminErrorMessage(err, "Impossible de créer cette entreprise."))
    } finally {
      sending.current = false
      if (active.current) setSaving(false)
    }
  }

  return (
    <Dialog
      titleId="create-company-title"
      onClose={() => !sending.current && onClose()}
    >
      <form onSubmit={submit}>
        <h2 id="create-company-title" className="text-xl font-semibold text-ink">
          Créer une entreprise
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Le propriétaire choisi pourra gérer les clients et les devis de cette
          entreprise.
        </p>
        <div className="mt-5">
          <Field
            htmlFor="new-company-name"
            label="Nom de l’entreprise"
            required
            hint="120 caractères maximum."
          >
            <Input
              id="new-company-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              required
              disabled={saving}
            />
          </Field>
        </div>
        <div className="mt-5">
          <Field
            htmlFor="new-company-owner-filter"
            label="Filtrer les comptes de cette page"
          >
            <Input
              id="new-company-owner-filter"
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Rechercher une adresse email"
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
              <legend className="sr-only">Propriétaire de l’entreprise</legend>
              {candidates.length === 0 ? (
                <p className="p-2 text-sm text-muted">Aucun compte sur cette page.</p>
              ) : (
                candidates.map((account) => {
                  const memberElsewhere =
                    !account.is_admin && account.companies.length > 0
                  const suspended = isSuspended(account)
                  const unavailable = suspended || memberElsewhere || !account.email
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
                        name="company-owner"
                        value={account.id}
                        checked={selected?.id === account.id}
                        disabled={saving || unavailable}
                        onChange={() =>
                          setSelected({ id: account.id, email: account.email })
                        }
                        className="mt-1 shrink-0 accent-primary"
                      />
                      <span className="min-w-0 break-all">
                        {account.email ?? "Compte sans adresse email"}
                        {suspended ? (
                          <span className="mt-1 block text-xs">Compte suspendu</span>
                        ) : memberElsewhere ? (
                          <span className="mt-1 block text-xs">
                            Déjà rattaché à une autre entreprise
                          </span>
                        ) : account.is_admin ? (
                          <span className="mt-1 block text-xs">Administrateur</span>
                        ) : null}
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
            <p className="text-ink">Propriétaire sélectionné</p>
            <p className="mt-1 break-all font-medium text-primary">
              {selected.email ?? "Votre compte administrateur"}
            </p>
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
            disabled={
              !name.trim() || !selected || accounts.loading || Boolean(accounts.error)
            }
            loading={saving}
          >
            <Plus size={16} aria-hidden="true" /> Créer l’entreprise
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function DeleteCompanyDialog({
  company,
  onClose,
  onDone,
}: {
  company: AdminCompany
  onClose: () => void
  onDone: (message: string, companyId: string) => void
}) {
  const [confirmation, setConfirmation] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const sending = useRef(false)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending.current || confirmation.trim() !== company.name) return
    sending.current = true
    setSaving(true)
    setError("")
    try {
      const id = await deleteAdminCompany(company.id, confirmation)
      if (active.current) onDone(`L’entreprise ${company.name} a été supprimée.`, id)
    } catch (err) {
      if (active.current)
        setError(adminErrorMessage(err, "Impossible de supprimer cette entreprise."))
    } finally {
      sending.current = false
      if (active.current) setSaving(false)
    }
  }
  return (
    <Dialog
      titleId="delete-company-title"
      onClose={() => !sending.current && onClose()}
    >
      <form onSubmit={submit}>
        <h2 id="delete-company-title" className="text-xl font-semibold text-ink">
          Supprimer l’entreprise
        </h2>
        <p className="mt-2 break-words text-sm font-medium text-ink">{company.name}</p>
        <p className="mt-4 text-sm leading-6 text-muted">
          Cette suppression est définitive. Les clients, les devis et leur historique
          seront supprimés. Les membres perdront l’accès à cette entreprise. Les comptes
          utilisateurs sont conservés.
        </p>
        <div className="mt-5">
          <Field
            htmlFor="delete-company-name"
            label="Nom de l’entreprise à supprimer"
            required
            hint="Recopiez exactement le nom ci-dessus, en respectant les majuscules et les accents."
          >
            <Input
              id="delete-company-name"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={saving}
              required
            />
          </Field>
        </div>
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
            variant="danger"
            disabled={confirmation.trim() !== company.name}
            loading={saving}
          >
            <Trash2 size={16} aria-hidden="true" /> Supprimer définitivement
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
  const {
    company: selectedCompany,
    selectCompany,
    clearSelectedCompany,
    refresh: refreshCompany,
  } = useCompany()
  const navigate = useNavigate()
  const accounts = usePagedList(listAdminUsers, isAdmin && !adminLoading)
  const companies = usePagedList(listAdminCompanies, isAdmin && !adminLoading)
  const [tab, setTab] = useState<"accounts" | "companies">("accounts")
  const [accountFilter, setAccountFilter] = useState("")
  const [companyFilter, setCompanyFilter] = useState("")
  const [accountAction, setAccountAction] = useState<AccountAction | null>(null)
  const [transferCompany, setTransferCompany] = useState<AdminCompany | null>(null)
  const [companyAction, setCompanyAction] = useState<CompanyAction | null>(null)
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

  function companyMutationDone(message: string, companyId: string) {
    const deleting = companyAction?.kind === "delete"
    setCompanyAction(null)
    setActionError("")
    setNotice(message)
    if (companies.page > 1) companies.setPage(1)
    else void companies.refresh()
    void accounts.refresh()
    if (deleting && selectedCompany?.id === companyId) clearSelectedCompany()
    else
      void refreshCompany().catch(() =>
        setActionError(
          "Impossible d’actualiser l’entreprise sélectionnée. Rechargez la page.",
        ),
      )
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/admin" aria-label="Cadova, administration" className="shrink-0">
            <CadovaLogo className="h-8 w-auto sm:h-9" />
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <NotificationBell />
            {selectedCompany && (
              <LinkButton to="/app" variant="secondary">
                Revenir aux devis
              </LinkButton>
            )}
            <LinkButton to="/notifications?view=messages" variant="secondary">
              Messages des utilisateurs
            </LinkButton>
            <Button variant="secondary" onClick={logout} loading={loggingOut}>
              <LogOut size={16} aria-hidden="true" /> Se déconnecter
            </Button>
          </div>
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
              <AdminNotificationComposer />
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
              <div className="flex flex-wrap gap-2">
                {tab === "companies" && (
                  <Button
                    onClick={() => {
                      setNotice("")
                      setCompanyAction({ kind: "create" })
                    }}
                  >
                    <Plus size={16} aria-hidden="true" /> Créer une entreprise
                  </Button>
                )}
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
                      <table className="block w-full text-left text-sm md:table md:min-w-[860px]">
                        <caption className="sr-only">Comptes Cadova</caption>
                        <thead className="hidden border-b border-line bg-background text-xs text-muted md:table-header-group">
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
                        <tbody className="block md:table-row-group">
                          {filteredUsers.map((account) => {
                            const protectedAccount =
                              account.is_admin || account.id === user?.id
                            const suspended = isSuspended(account)
                            return (
                              <tr
                                key={account.id}
                                className="grid min-w-0 grid-cols-2 gap-x-3 border-b border-line p-4 last:border-0 md:table-row md:p-0"
                              >
                                <th
                                  scope="row"
                                  className="col-span-2 min-w-0 py-1 font-normal md:min-w-64 md:max-w-80 md:px-5 md:py-4"
                                >
                                  <p className="break-all font-medium text-ink">
                                    {account.email ?? "Compte sans adresse email"}
                                  </p>
                                  <p className="mt-1 whitespace-nowrap text-xs text-muted">
                                    Créé le {displayDate(account.created_at)}
                                  </p>
                                </th>
                                <td className="col-span-2 py-2 md:px-5 md:py-4">
                                  <AccountStatus user={account} />
                                </td>
                                <td className="col-span-2 min-w-0 py-2 text-ink-soft md:max-w-56 md:px-5 md:py-4">
                                  <p className="mb-1 text-xs font-medium text-muted md:hidden">
                                    Entreprises
                                  </p>
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
                                <td className="col-span-2 py-2 text-muted md:whitespace-nowrap md:px-5 md:py-4">
                                  <span className="mr-2 text-xs font-medium md:hidden">
                                    Dernière connexion
                                  </span>
                                  {account.last_sign_in_at
                                    ? displayDate(account.last_sign_in_at)
                                    : "Jamais"}
                                </td>
                                <td className="col-span-2 mt-2 border-t border-line pt-3 md:mt-0 md:border-0 md:px-5 md:py-4">
                                  <div className="mb-2">
                                    <AdminNotificationComposer recipient={account} />
                                  </div>
                                  {protectedAccount ? (
                                    <p className="flex items-center gap-1.5 text-xs text-muted">
                                      <ShieldCheck size={14} aria-hidden="true" />{" "}
                                      Compte protégé
                                    </p>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
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
                    <table className="block w-full text-left text-sm md:table md:min-w-[720px]">
                      <caption className="sr-only">Entreprises Cadova</caption>
                      <thead className="hidden border-b border-line bg-background text-xs text-muted md:table-header-group">
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
                      <tbody className="block md:table-row-group">
                        {filteredCompanies.map((company) => (
                          <tr
                            key={company.id}
                            className="grid min-w-0 grid-cols-2 gap-x-3 border-b border-line p-4 last:border-0 md:table-row md:p-0"
                          >
                            <th
                              scope="row"
                              className="col-span-2 min-w-0 py-1 font-normal md:max-w-64 md:px-5 md:py-4"
                            >
                              <p className="break-words font-medium text-ink">
                                {company.name}
                              </p>
                              <p className="mt-1 text-xs text-muted">
                                Créée le {displayDate(company.created_at)}
                              </p>
                            </th>
                            <td className="col-span-2 min-w-0 py-2 text-ink-soft md:max-w-72 md:px-5 md:py-4">
                              <p className="mb-1 text-xs font-medium text-muted md:hidden">
                                Propriétaires
                              </p>
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
                            <td className="col-span-2 mt-2 border-t border-line pt-3 md:mt-0 md:border-0 md:px-5 md:py-4">
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
                                <Button
                                  variant="ghost"
                                  className="text-danger"
                                  aria-label={`Supprimer l’entreprise ${company.name}`}
                                  onClick={() => {
                                    setNotice("")
                                    setCompanyAction({ kind: "delete", company })
                                  }}
                                >
                                  <Trash2 size={16} aria-hidden="true" /> Supprimer
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
      {companyAction?.kind === "create" && (
        <CreateCompanyDialog
          onClose={() => setCompanyAction(null)}
          onDone={companyMutationDone}
        />
      )}
      {companyAction?.kind === "delete" && (
        <DeleteCompanyDialog
          company={companyAction.company}
          onClose={() => setCompanyAction(null)}
          onDone={companyMutationDone}
        />
      )}
    </div>
  )
}
