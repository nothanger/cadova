import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import { BellPlus, ChevronLeft, ChevronRight } from "lucide-react"
import { Button, Field, Input, Select, Textarea } from "@/components/ui"
import { Dialog } from "@/components/ui/Dialog"
import { supabase } from "@/lib/supabase"
import { humanizeError } from "@/lib/errors"
import { useAdmin } from "./AdminContext"
import { adminErrorMessage, listAdminUsers } from "./api"
import type { AdminUser, AdminUsersPage } from "./types"

type Recipient = Pick<AdminUser, "id" | "email" | "banned_until">
type ComposerProps = {
  onSent?: () => void
  recipient?: Recipient
}

function isSuspended(user: Recipient) {
  return Boolean(user.banned_until && Date.parse(user.banned_until) > Date.now())
}

function recipientLabel(user: Recipient) {
  return user.email ?? "Compte sans adresse email"
}

function isAccessError(error: unknown) {
  if (!error || typeof error !== "object") return false
  const value = error as { code?: unknown; status?: unknown; message?: unknown }
  return (
    value.code === "42501" ||
    value.status === 403 ||
    (typeof value.message === "string" &&
      /reserved|réservé|not authorized|permission denied|not allowed/i.test(
        value.message,
      ))
  )
}

/** The server checks the administrator role independently of this UI guard. */
export function AdminNotificationComposer(props: ComposerProps) {
  const { isAdmin, loading } = useAdmin()
  if (!isAdmin || loading) return null
  return <NotificationComposer {...props} />
}

function NotificationComposer({ onSent, recipient }: ComposerProps) {
  const { refresh: refreshAdmin } = useAdmin()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [stage, setStage] = useState<"compose" | "confirm">("compose")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [audience, setAudience] = useState<"everyone" | "one">(
    recipient ? "one" : "everyone",
  )
  const [selected, setSelected] = useState<Recipient | null>(recipient ?? null)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState("")
  const [users, setUsers] = useState<AdminUsersPage | null>(null)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [usersError, setUsersError] = useState("")
  const [reload, setReload] = useState(0)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const request = useRef(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const sendingRef = useRef(false)
  // Keep the same key after an ambiguous network failure, so a retry cannot
  // create a second broadcast. Editing the payload explicitly starts a new one.
  const submission = useRef<{ payload: string; id: string } | null>(null)

  useEffect(() => {
    if (open && stage === "confirm") heading.current?.focus()
  }, [open, stage])

  useEffect(() => {
    if (!open || audience !== "one") return
    const current = ++request.current
    setLoadingUsers(true)
    setUsers(null)
    setUsersError("")
    void listAdminUsers(page, 25)
      .then((result) => {
        if (request.current !== current) return
        setUsers(result)
        setSelected((previous) => {
          if (!previous) return null
          const updated = result.users.find((user) => user.id === previous.id)
          return updated && isSuspended(updated) ? null : (updated ?? previous)
        })
      })
      .catch((err: unknown) => {
        if (request.current !== current) return
        setUsersError(adminErrorMessage(err, "Impossible de charger les comptes."))
        if (isAccessError(err)) void refreshAdmin()
      })
      .finally(() => {
        if (request.current === current) setLoadingUsers(false)
      })
    return () => {
      request.current += 1
    }
  }, [open, audience, page, reload, refreshAdmin])

  const visibleUsers = (users?.users ?? []).filter((user) =>
    recipientLabel(user)
      .toLocaleLowerCase("fr")
      .includes(filter.toLocaleLowerCase("fr")),
  )
  const valid =
    title.trim().length > 0 &&
    title.length <= 120 &&
    body.trim().length > 0 &&
    body.length <= 4000 &&
    (audience === "everyone" || Boolean(selected && !isSuspended(selected)))

  function edited() {
    submission.current = null
    setError("")
    setNotice("")
    setStage("compose")
  }

  function close() {
    if (!sendingRef.current) setOpen(false)
  }

  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (valid && !sendingRef.current) {
      setError("")
      setStage("confirm")
    }
  }

  async function send() {
    if (stage !== "confirm" || !valid || sendingRef.current) return
    const recipientId = audience === "everyone" ? null : selected?.id
    if (recipientId === undefined) return
    const payload = JSON.stringify([title.trim(), body.trim(), recipientId])
    if (!submission.current || submission.current.payload !== payload) {
      submission.current = { payload, id: window.crypto.randomUUID() }
    }
    sendingRef.current = true
    setSending(true)
    setError("")
    try {
      const { data, error: rpcError } = await supabase.rpc("send_admin_notification", {
        p_title: title.trim(),
        p_body: body.trim(),
        p_recipient_id: recipientId,
        p_request_id: submission.current.id,
      })
      if (rpcError) throw rpcError
      const count = (data as { recipient_count?: unknown } | null)?.recipient_count
      if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
        throw new Error("Invalid notification result")
      }
      setNotice(
        count === 0
          ? "Aucun compte actif n’a reçu cette notification."
          : `Notification envoyée à ${count} ${count === 1 ? "compte" : "comptes"}.`,
      )
      setOpen(false)
      setTitle("")
      setBody("")
      setStage("compose")
      submission.current = null
      // Refreshing another view must not turn a successful send into an error.
      void Promise.resolve()
        .then(() => onSent?.())
        .catch(() => undefined)
    } catch (err) {
      if (isAccessError(err)) {
        setError(
          "Votre accès administrateur n’est plus disponible. Actualisez la page ou reconnectez-vous.",
        )
        void refreshAdmin()
      } else {
        const code = err && typeof err === "object" && "code" in err ? err.code : null
        setError(
          code === "P0002"
            ? "Ce compte est supprimé ou suspendu. Choisissez un autre destinataire."
            : ["28000", "PGRST301", "PGRST302"].includes(String(code))
              ? "Votre session a expiré. Reconnectez-vous pour continuer."
              : humanizeError(
                  err,
                  "Impossible d’envoyer la notification. Vous pouvez réessayer sans créer de doublon.",
                ),
        )
      }
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        disabled={Boolean(recipient && isSuspended(recipient))}
        aria-label={
          recipient
            ? `Envoyer une notification à ${recipientLabel(recipient)}`
            : undefined
        }
        onClick={() => {
          setNotice("")
          setOpen(true)
        }}
      >
        <BellPlus size={16} aria-hidden="true" /> Envoyer une notification
      </Button>
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-success/20 bg-success-soft p-3 text-sm text-success"
        >
          {notice}
        </p>
      )}
      {open && (
        <Dialog titleId={`${id}-title`} onClose={close}>
          <h2
            ref={heading}
            tabIndex={-1}
            id={`${id}-title`}
            className="text-xl font-semibold text-ink"
          >
            {stage === "confirm"
              ? "Vérifier la notification"
              : "Envoyer une notification"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            La notification sera affichée dans Cadova.
          </p>
          {stage === "compose" ? (
            <form onSubmit={preview} className="mt-5 space-y-4">
              <Field
                htmlFor={`${id}-notification-title`}
                label="Titre"
                required
                hint="120 caractères maximum."
              >
                <Input
                  id={`${id}-notification-title`}
                  value={title}
                  maxLength={120}
                  required
                  disabled={sending}
                  onChange={(event) => {
                    edited()
                    setTitle(event.target.value)
                  }}
                />
              </Field>
              <Field
                htmlFor={`${id}-notification-body`}
                label="Message"
                required
                hint="4 000 caractères maximum."
              >
                <Textarea
                  id={`${id}-notification-body`}
                  rows={5}
                  value={body}
                  maxLength={4000}
                  required
                  disabled={sending}
                  onChange={(event) => {
                    edited()
                    setBody(event.target.value)
                  }}
                />
              </Field>
              <Field htmlFor={`${id}-audience`} label="Destinataires">
                <Select
                  id={`${id}-audience`}
                  value={audience}
                  disabled={sending}
                  onChange={(event) => {
                    edited()
                    setAudience(event.target.value as "everyone" | "one")
                  }}
                >
                  <option value="everyone">Tous les comptes actifs</option>
                  <option value="one">Un compte</option>
                </Select>
              </Field>
              {audience === "one" && (
                <div className="space-y-3 rounded-lg border border-line p-3 sm:p-4">
                  {selected && (
                    <p className="break-all text-sm text-ink">
                      Destinataire choisi :{" "}
                      <span className="font-medium">{recipientLabel(selected)}</span>
                    </p>
                  )}
                  <Field
                    htmlFor={`${id}-recipient-filter`}
                    label="Rechercher un compte sur cette page"
                    hint="25 comptes par page. Pour chercher ailleurs, changez de page."
                  >
                    <Input
                      id={`${id}-recipient-filter`}
                      type="search"
                      value={filter}
                      disabled={sending}
                      onChange={(event) => setFilter(event.target.value)}
                    />
                  </Field>
                  {loadingUsers ? (
                    <p role="status" className="py-4 text-sm text-muted">
                      Chargement des comptes…
                    </p>
                  ) : usersError ? (
                    <div className="space-y-2">
                      <p role="alert" className="text-sm text-danger">
                        {usersError}
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setReload((value) => value + 1)}
                      >
                        Réessayer
                      </Button>
                    </div>
                  ) : (
                    <fieldset className="max-h-56 overflow-y-auto rounded-lg border border-line">
                      <legend className="sr-only">Choisir le destinataire</legend>
                      {visibleUsers.length === 0 ? (
                        <p className="p-3 text-sm text-muted">
                          Aucun compte sur cette page. Modifiez la recherche ou changez
                          de page.
                        </p>
                      ) : (
                        visibleUsers.map((user) => {
                          const suspended = isSuspended(user)
                          return (
                            <label
                              key={user.id}
                              htmlFor={`${id}-recipient-${user.id}`}
                              aria-label={recipientLabel(user)}
                              className="flex items-start gap-3 border-b border-line p-3 text-sm last:border-0"
                            >
                              <input
                                id={`${id}-recipient-${user.id}`}
                                type="radio"
                                name={`${id}-recipient`}
                                value={user.id}
                                checked={selected?.id === user.id}
                                disabled={sending || suspended}
                                onChange={() => {
                                  edited()
                                  setSelected(user)
                                }}
                                className="mt-1 shrink-0 accent-primary"
                              />
                              <span className="min-w-0">
                                <span className="block break-all text-ink">
                                  {recipientLabel(user)}
                                </span>
                                <span
                                  className={suspended ? "text-danger" : "text-muted"}
                                >
                                  {suspended ? "Suspendu" : "Compte actif"}
                                </span>
                              </span>
                            </label>
                          )
                        })
                      )}
                    </fieldset>
                  )}
                  <nav
                    aria-label="Pagination des destinataires"
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <p className="text-xs text-muted">Page {page}</p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        aria-label="Destinataires précédents"
                        disabled={sending || loadingUsers || page <= 1}
                        onClick={() => {
                          setPage((value) => value - 1)
                          setFilter("")
                        }}
                      >
                        <ChevronLeft size={16} aria-hidden="true" /> Précédents
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        aria-label="Destinataires suivants"
                        disabled={sending || loadingUsers || !users?.hasMore}
                        onClick={() => {
                          setPage((value) => value + 1)
                          setFilter("")
                        }}
                      >
                        Suivants <ChevronRight size={16} aria-hidden="true" />
                      </Button>
                    </div>
                  </nav>
                </div>
              )}
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={close}
                  disabled={sending}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={!valid || sending}>
                  Vérifier l’envoi
                </Button>
              </div>
            </form>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-line bg-background p-4">
                <p className="text-sm font-medium text-ink">
                  {audience === "everyone"
                    ? "Tous les comptes actifs, y compris le vôtre"
                    : selected
                      ? `Pour ${recipientLabel(selected)}`
                      : "Aucun destinataire actif sélectionné"}
                </p>
                <h3 className="mt-4 break-words font-semibold text-ink">
                  {title.trim()}
                </h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">
                  {body.trim()}
                </p>
              </div>
              {audience === "everyone" && (
                <p className="text-sm leading-6 text-muted">
                  En confirmant, vous envoyez cette notification à tous les comptes
                  actifs de Cadova.
                </p>
              )}
              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-danger-soft p-3 text-sm text-danger"
                >
                  {error}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={sending}
                  onClick={() => {
                    setError("")
                    setStage("compose")
                  }}
                >
                  Modifier
                </Button>
                <Button
                  type="button"
                  disabled={sending || !valid}
                  loading={sending}
                  onClick={() => void send()}
                >
                  Confirmer l’envoi
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      )}
    </>
  )
}
