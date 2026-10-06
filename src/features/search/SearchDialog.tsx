import { useEffect, useId, useRef, useState } from "react"
import { FileText, Search, UserRound, X } from "lucide-react"
import { Link } from "react-router-dom"
import { Dialog } from "@/components/ui/Dialog"
import { Button, StatusBadge } from "@/components/ui"
import { formatCents } from "@/lib/money"
import { searchCompanyRecords } from "./api"
import {
  isSearchQueryValid,
  normalizeSearchQuery,
  SEARCH_MAX_LENGTH,
  searchRecordPath,
  type SearchResults,
} from "./search"

export function SearchDialog({
  companyId,
  companyName,
  onClose,
}: {
  companyId: string
  companyName: string
  onClose: () => void
}) {
  const titleId = useId()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const requestId = useRef(0)
  const [query, setQuery] = useState("")
  const [retry, setRetry] = useState(0)
  const [response, setResponse] = useState<{
    companyId: string
    query: string
    results?: SearchResults
    error?: boolean
  } | null>(null)
  const normalized = normalizeSearchQuery(query)
  const valid = isSearchQueryValid(normalized)
  const current =
    response?.companyId === companyId && response.query === normalized ? response : null

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const request = ++requestId.current
    if (!valid) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchCompanyRecords(companyId, normalized, controller.signal).then(
        (results) => {
          if (request === requestId.current && !controller.signal.aborted)
            setResponse({ companyId, query: normalized, results })
        },
        () => {
          if (request === requestId.current && !controller.signal.aborted)
            setResponse({ companyId, query: normalized, error: true })
        },
      )
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
      requestId.current++
    }
  }, [companyId, normalized, valid, retry])

  function retrySearch() {
    setResponse(null)
    setRetry((value) => value + 1)
  }

  const status = !valid
    ? "Saisissez au moins 2 caractères pour rechercher."
    : current?.error
      ? "La recherche est momentanément indisponible."
      : !current?.results
        ? "Recherche en cours…"
        : current.results.items.length === 0
          ? "Aucun client ni devis ne correspond à cette recherche."
          : `${current.results.items.length} résultat${current.results.items.length > 1 ? "s" : ""}${current.results.hasMore ? ". D’autres résultats existent : précisez votre recherche." : "."}`

  return (
    <Dialog titleId={titleId} onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-xl font-semibold">
            Rechercher
          </h2>
          <p className="mt-1 break-words text-sm text-muted">
            Clients et devis de {companyName}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la recherche"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-ink-soft hover:bg-background"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <label htmlFor={inputId} className="mt-5 block text-sm font-medium">
        Nom, email, téléphone, référence ou montant
      </label>
      <div className="relative mt-2">
        <Search
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-3.5 text-muted"
        />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => {
            const value = event.target.value
            if (normalizeSearchQuery(value) !== normalized) setResponse(null)
            setQuery(value)
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              event.stopPropagation()
              onClose()
            }
          }}
          maxLength={SEARCH_MAX_LENGTH}
          autoComplete="off"
          spellCheck={false}
          className="ui-input pl-10"
          aria-describedby={`${inputId}-status`}
        />
      </div>
      <p
        id={`${inputId}-status`}
        role="status"
        aria-live="polite"
        className="mt-3 text-sm leading-6 text-muted"
      >
        {status}
      </p>
      {current?.error && (
        <Button variant="secondary" onClick={retrySearch} className="mt-3">
          Réessayer
        </Button>
      )}
      {!!current?.results?.items.length && (
        <ul
          aria-label="Résultats de recherche"
          className="mt-4 max-h-[min(50dvh,28rem)] overflow-y-auto overscroll-contain divide-y divide-line rounded-lg border border-line"
        >
          {current.results.items.map((item) => {
            const Icon = item.kind === "quote" ? FileText : UserRound
            return (
              <li key={`${item.kind}:${item.id}`}>
                <Link
                  to={searchRecordPath(item)}
                  onClick={onClose}
                  className="flex min-h-16 items-start gap-3 px-3 py-3 transition-colors hover:bg-background focus-visible:bg-background"
                >
                  <Icon
                    size={18}
                    aria-hidden="true"
                    className="mt-1 shrink-0 text-muted"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-ink">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {item.kind === "quote" ? "Devis" : "Client"}
                    </p>
                    {(item.kind === "quote" ? item.client_name : item.detail) && (
                      <p className="mt-1 break-all text-sm leading-5 text-ink-soft">
                        {item.kind === "quote" ? item.client_name : item.detail}
                      </p>
                    )}
                    {item.kind === "quote" && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {item.amount_cents !== null && (
                          <span className="text-sm text-ink">
                            {formatCents(item.amount_cents)}
                          </span>
                        )}
                        {item.status && <StatusBadge status={item.status} />}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Dialog>
  )
}
