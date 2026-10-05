import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import {
  Check,
  Copy,
  Link2,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldOff,
  X,
} from "lucide-react"
import { Button, Card, Field, Input, Spinner, Textarea } from "@/components/ui"
import { Dialog } from "@/components/ui/Dialog"
import type { QuoteWithClient } from "@/types"
import {
  createPortal,
  inspectPortal,
  portalError,
  portalShareUrl,
  replyToPortal,
  revokePortal,
  type PortalInspection,
} from "@/features/quote-portal/api"
import { PortalConversation } from "@/features/quote-portal/PortalConversation"

const expiryDate = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
})

/** The parent keys this panel by account and quote, including after navigation. */
export function QuoteClientPortalPanel({
  quote,
  onChanged,
}: {
  quote: QuoteWithClient
  onChanged: () => Promise<void>
}) {
  const [data, setData] = useState<PortalInspection | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<"create" | "revoke" | "reply" | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [shareUrl, setShareUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const [reply, setReply] = useState("")
  const [confirm, setConfirm] = useState<"create" | "revoke" | null>(null)
  const active = useRef(true)
  const locked = useRef(false)
  const requests = useRef(0)
  const controllers = useRef(new Set<AbortController>())
  const pendingReply = useRef<{ message: string; nonce: string } | null>(null)
  const load = useCallback(async () => {
    if (quote.status === "draft") {
      setLoading(false)
      return
    }
    const ticket = ++requests.current
    const abort = new AbortController()
    controllers.current.add(abort)
    setLoading(true)
    setError("")
    try {
      const result = await inspectPortal(quote.id, abort.signal)
      if (active.current && ticket === requests.current) setData(result)
    } catch (e) {
      if (active.current && ticket === requests.current && !abort.signal.aborted)
        setError(portalError(e))
    } finally {
      controllers.current.delete(abort)
      if (active.current && ticket === requests.current) setLoading(false)
    }
  }, [quote.id, quote.status])
  useEffect(() => {
    active.current = true
    void load()
    const pending = controllers.current
    return () => {
      active.current = false
      requests.current++
      pending.forEach((entry) => entry.abort())
      pending.clear()
    }
  }, [load])
  const available = quote.status !== "draft"
  const linkActive = Boolean(
    data?.link &&
    !data.link.revoked_at &&
    Date.parse(data.link.expires_at) > Date.now(),
  )

  async function perform(kind: NonNullable<typeof busy>) {
    if (locked.current || loading) return
    locked.current = true
    const abort = new AbortController()
    controllers.current.add(abort)
    setBusy(kind)
    setError("")
    setNotice("")
    try {
      if (kind === "create") {
        const result = await createPortal(quote.id, abort.signal)
        if (!active.current) return
        setData((value) => ({ link: result.link, messages: value?.messages ?? [] }))
        setShareUrl(portalShareUrl(result.token))
        setCopied(false)
        setNotice("Le lien est prêt. Copiez-le avant de quitter cette page.")
      } else if (kind === "revoke") {
        await revokePortal(quote.id, abort.signal)
        if (!active.current) return
        setShareUrl("")
        setData((value) =>
          value
            ? {
                ...value,
                link: value.link
                  ? { ...value.link, revoked_at: new Date().toISOString() }
                  : null,
              }
            : value,
        )
        setNotice("Tous les liens de suivi de ce devis sont désactivés.")
      } else {
        const message = reply.trim()
        if (!message) return
        if (pendingReply.current?.message !== message)
          pendingReply.current = { message, nonce: crypto.randomUUID() }
        const result = await replyToPortal(
          quote.id,
          message,
          pendingReply.current.nonce,
          abort.signal,
        )
        if (!active.current) return
        setData(result)
        setReply("")
        pendingReply.current = null
        setNotice(
          "Votre réponse est enregistrée dans les échanges du suivi client. Aucun email supplémentaire n’a été envoyé.",
        )
        await onChanged()
      }
      if (active.current) setConfirm(null)
    } catch (e) {
      if (active.current && !abort.signal.aborted) setError(portalError(e))
    } finally {
      controllers.current.delete(abort)
      locked.current = false
      if (active.current) setBusy(null)
    }
  }
  async function copy() {
    setError("")
    try {
      await navigator.clipboard.writeText(shareUrl)
      if (active.current) setCopied(true)
    } catch {
      if (active.current)
        setError(
          "La copie n’est pas disponible. Sélectionnez le lien ci-dessous pour le copier.",
        )
    }
  }
  function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (reply.trim()) void perform("reply")
  }
  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Link2 size={19} aria-hidden="true" /> Suivi client
        </h2>
        <Button
          variant="ghost"
          loading={loading}
          disabled={Boolean(busy) || loading}
          onClick={() => {
            void load()
            void onChanged()
          }}
        >
          <RefreshCw size={16} /> Actualiser
        </Button>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">
        Le client peut consulter son devis, poser une question et transmettre sa
        décision depuis un lien privé, sans créer de compte.
      </p>
      {!available ? (
        <p className="mt-4 rounded-lg bg-background p-3 text-sm leading-6 text-muted">
          Envoyez le devis ou indiquez qu’il a déjà été envoyé pour ouvrir le suivi
          client.
        </p>
      ) : (
        <>
          {loading && !data ? (
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
              {data && (
                <div className="mt-4 rounded-lg border border-line p-4">
                  <p className="text-sm font-medium">
                    {linkActive
                      ? "Lien de suivi actif"
                      : data.link
                        ? "Lien de suivi inactif"
                        : "Aucun lien de suivi"}
                  </p>
                  {linkActive && data.link && (
                    <p className="mt-1 text-xs leading-5 text-muted">
                      Accès jusqu’au {expiryDate.format(new Date(data.link.expires_at))}
                      . Le lien envoyé par email est inclus automatiquement lors d’un
                      nouvel envoi depuis Cadova.
                    </p>
                  )}
                  {!shareUrl && linkActive && (
                    <p className="mt-2 text-xs leading-5 text-muted">
                      Les liens existants ne sont pas affichés après leur création.
                      Créez un nouveau lien pour le partager manuellement.
                    </p>
                  )}
                  {shareUrl && (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Input
                        aria-label="Lien privé du suivi client"
                        readOnly
                        value={shareUrl}
                        onFocus={(event) => event.target.select()}
                        className="min-w-0 text-sm"
                      />
                      <Button variant="secondary" onClick={copy}>
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? "Copié" : "Copier le lien"}
                      </Button>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      disabled={Boolean(busy) || !data}
                      loading={busy === "create"}
                      onClick={() =>
                        linkActive ? setConfirm("create") : void perform("create")
                      }
                    >
                      <Link2 size={16} />
                      {linkActive ? "Créer un nouveau lien" : "Créer un lien"}
                    </Button>
                    {linkActive && (
                      <Button
                        variant="ghost"
                        disabled={Boolean(busy) || loading}
                        onClick={() => setConfirm("revoke")}
                      >
                        <ShieldOff size={16} /> Désactiver les liens
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {!data && (
                <Button className="mt-4" variant="secondary" onClick={load}>
                  Réessayer
                </Button>
              )}
            </>
          )}
        </>
      )}
      {data && (
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <MessageSquare size={17} aria-hidden="true" /> Échanges avec le client
          </h3>
          <PortalConversation messages={data.messages} companyName="Votre entreprise" />
          {available && (
            <form className="mt-5 space-y-3" onSubmit={sendReply}>
              <Field
                label="Votre réponse"
                htmlFor="portal-owner-reply"
                hint="La réponse apparaît dans les échanges accessibles par les liens de suivi actifs."
              >
                <Textarea
                  id="portal-owner-reply"
                  rows={3}
                  maxLength={2000}
                  required
                  value={reply}
                  disabled={Boolean(busy) || loading}
                  onChange={(event) => setReply(event.target.value)}
                />
              </Field>
              <Button
                type="submit"
                loading={busy === "reply"}
                disabled={Boolean(busy) || loading || !reply.trim()}
              >
                <Send size={16} /> Publier la réponse
              </Button>
            </form>
          )}
        </div>
      )}
      {confirm && (
        <Dialog
          titleId="portal-link-confirm-title"
          onClose={() => {
            if (!busy) setConfirm(null)
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="portal-link-confirm-title" className="text-lg font-semibold">
              {confirm === "create"
                ? "Créer un nouveau lien de partage ?"
                : "Désactiver tous les liens ?"}
            </h2>
            <Button
              variant="ghost"
              disabled={Boolean(busy) || loading}
              aria-label="Fermer la confirmation du lien"
              onClick={() => setConfirm(null)}
            >
              <X size={18} />
            </Button>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted">
            {confirm === "create"
              ? "Le précédent lien créé manuellement sera désactivé. Les liens déjà envoyés par email resteront actifs. Le nouveau lien sera valable 30 jours."
              : "Le client ne pourra plus ouvrir ce suivi avec les liens existants, y compris ceux reçus par email. Les échanges enregistrés seront conservés."}
          </p>
          {error && (
            <p role="alert" className="mt-4 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              disabled={Boolean(busy) || loading}
              onClick={() => setConfirm(null)}
            >
              Annuler
            </Button>
            <Button
              variant={confirm === "revoke" ? "danger" : "primary"}
              loading={Boolean(busy)}
              onClick={() => perform(confirm)}
            >
              {confirm === "create" ? "Créer le nouveau lien" : "Désactiver les liens"}
            </Button>
          </div>
        </Dialog>
      )}
    </Card>
  )
}
