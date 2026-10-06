import { useEffect, useState } from "react"
import { FileText, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui"
import { Dialog } from "@/components/ui/Dialog"
import { useCompanyMessages } from "./useCompanyMessages"
import {
  buildCompanyMessage,
  type CompanyMessageKind,
  type MessageDraft,
  type MessageValues,
} from "./messages"

/** Applying a saved message is explicit; loading preferences never edits a draft. */
export function CompanyMessageControl({
  companyId,
  kind,
  values,
  current,
  onApply,
  disabled = false,
  mode = "rendered",
}: {
  companyId: string
  kind: CompanyMessageKind
  values: MessageValues
  current: MessageDraft
  onApply: (draft: MessageDraft) => void
  disabled?: boolean
  mode?: "rendered" | "template"
}) {
  const preferences = useCompanyMessages(companyId)
  const [proposal, setProposal] = useState<{
    scope: string
    kind: CompanyMessageKind
    context: string
    before: MessageDraft
    draft: MessageDraft
    preview: MessageDraft
    error: string
  } | null>(null)
  const template = preferences.data?.templates.find((row) => row.kind === kind) ?? null
  const signature = preferences.data?.profile?.email_signature ?? ""
  const resolvedValues = {
    ...values,
    company_name: preferences.data?.companyName ?? values.company_name,
  }
  const contextKey = JSON.stringify(resolvedValues)
  const stale = Boolean(
    proposal &&
    (proposal.scope !== preferences.scope ||
      proposal.kind !== kind ||
      proposal.context !== contextKey ||
      proposal.before.subject !== current.subject ||
      proposal.before.body !== current.body),
  )
  useEffect(() => {
    setProposal(null)
  }, [preferences.scope, kind])
  if (preferences.loading) return null
  if (preferences.error)
    return (
      <div className="space-y-1 text-xs leading-5 text-muted">
        <p role="status">{preferences.error}</p>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={preferences.reload}
        >
          <RefreshCw size={14} aria-hidden="true" /> Réessayer les modèles
        </Button>
      </div>
    )
  if (!template && !signature.trim()) return null
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={() =>
          setProposal({
            scope: preferences.scope,
            kind,
            context: contextKey,
            before: { ...current },
            ...buildCompanyMessage({
              template,
              signature,
              fallback: current,
              values: resolvedValues,
              mode,
            }),
          })
        }
      >
        <FileText size={16} aria-hidden="true" />{" "}
        {template
          ? "Utiliser le modèle de l’entreprise"
          : "Ajouter la signature de l’entreprise"}
      </Button>
      {proposal && (
        <Dialog
          titleId="company-message-preview-title"
          onClose={() => setProposal(null)}
        >
          <h2 id="company-message-preview-title" className="text-lg font-semibold">
            {template ? "Utiliser votre modèle" : "Ajouter votre signature"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            {template
              ? "Ce modèle remplacera l’objet et le message affichés. Vous pourrez les modifier avant l’envoi."
              : "La signature sera ajoutée au message affiché."}
            {mode === "template" &&
              " Les relances ne changent qu’après l’enregistrement de leurs réglages."}
          </p>
          <p className="mt-5 break-words text-sm font-semibold">
            {proposal.preview.subject}
          </p>
          <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-line bg-background p-4 text-sm leading-6">
            {proposal.preview.body}
          </p>
          {(proposal.error || stale) && (
            <p role="alert" className="mt-4 text-sm leading-6 text-danger">
              {stale
                ? "Le message ou l’entreprise a changé. Fermez cet aperçu et ouvrez-le à nouveau."
                : proposal.error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setProposal(null)}>
              Garder mon message
            </Button>
            <Button
              type="button"
              disabled={disabled || stale || Boolean(proposal.error)}
              onClick={() => {
                if (!disabled && !stale && !proposal.error) {
                  onApply(proposal.draft)
                  setProposal(null)
                }
              }}
            >
              {template ? "Appliquer ce modèle" : "Ajouter cette signature"}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
