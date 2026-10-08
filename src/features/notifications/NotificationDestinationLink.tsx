import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/features/auth/AuthContext"
import { useAdmin } from "@/features/admin/AdminContext"
import { useCompany } from "@/features/company/CompanyContext"
import { notificationAPIError } from "./api"
import type { Notification } from "./types"

function destination(item: Notification) {
  if (item.support_thread_id)
    return `/notifications?view=messages&thread=${encodeURIComponent(item.support_thread_id)}`
  if (item.related_quote_id)
    return `/app/quotes/${encodeURIComponent(item.related_quote_id)}`
  return `/notifications?notification=${encodeURIComponent(item.id)}`
}

/** Select the administrator's company before opening a company's quote. */
export function NotificationDestinationLink({
  item,
  children,
  className,
  onOpened,
}: {
  item: Notification
  children: ReactNode
  className?: string
  onOpened?: () => void
}) {
  const { user, loading: authLoading } = useAuth()
  const { isAdmin, loading: adminLoading } = useAdmin()
  const { company, loading: companyLoading, selectCompany } = useCompany()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const errorId = useId()
  const active = useRef(true)
  const locked = useRef(false)
  const operation = useRef(0)
  const identity = `${user?.id ?? "anonymous"}:${isAdmin}`
  const currentIdentity = useRef(identity)
  currentIdentity.current = identity
  const currentCompany = useRef(company?.id)
  currentCompany.current = company?.id

  useEffect(() => {
    active.current = true
    locked.current = false
    operation.current++
    setBusy(false)
    setError("")
    return () => {
      active.current = false
      operation.current++
    }
  }, [identity, item.id])

  async function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented) return
    if (locked.current || authLoading || adminLoading || companyLoading) {
      event.preventDefault()
      return
    }
    const businessQuote = item.related_quote_id && !item.support_thread_id
    if (!isAdmin || !businessQuote || item.company_id === company?.id) {
      if (
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey
      )
        onOpened?.()
      return
    }

    event.preventDefault()
    if (!item.company_id) {
      setError(
        "L’entreprise de ce devis n’a pas pu être identifiée. Actualisez les notifications avant de réessayer.",
      )
      return
    }
    locked.current = true
    const ticket = ++operation.current
    const actor = identity
    const previousCompany = company?.id
    setBusy(true)
    setError("")
    try {
      await selectCompany(item.company_id, () => {
        if (
          !active.current ||
          ticket !== operation.current ||
          actor !== currentIdentity.current ||
          (currentCompany.current !== previousCompany &&
            currentCompany.current !== item.company_id)
        )
          return
        onOpened?.()
        navigate(destination(item))
      })
    } catch (err) {
      if (
        active.current &&
        ticket === operation.current &&
        actor === currentIdentity.current
      )
        setError(
          notificationAPIError(
            err,
            "Impossible d’ouvrir l’entreprise de ce devis. Réessayez en ouvrant le devis.",
          ),
        )
    } finally {
      if (
        active.current &&
        ticket === operation.current &&
        actor === currentIdentity.current
      ) {
        locked.current = false
        setBusy(false)
      }
    }
  }

  return (
    <>
      <Link
        to={destination(item)}
        className={className}
        onClick={(event) => void open(event)}
        aria-disabled={busy || undefined}
        aria-describedby={error ? errorId : undefined}
      >
        {busy ? "Ouverture du devis…" : children}
      </Link>
      {error && (
        <span
          id={errorId}
          role="alert"
          className="block w-full text-sm leading-6 text-danger"
        >
          {error}
        </span>
      )}
    </>
  )
}
