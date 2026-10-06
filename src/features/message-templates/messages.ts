import {
  automationTemplateError,
  renderAutomationMessage,
  type AutomationVariable,
} from "../quotes/automationMessages"

export const COMPANY_MESSAGE_KINDS = [
  "quote_send",
  "first_followup",
  "second_followup",
  "expiry_followup",
  "automatic_followup",
] as const
export type CompanyMessageKind = (typeof COMPANY_MESSAGE_KINDS)[number]
export type MessageValues = Record<AutomationVariable, string>
export interface MessageDraft {
  subject: string
  body: string
}
export interface CompanyMessageTemplate {
  company_id: string
  kind: CompanyMessageKind
  subject_template: string
  body_template: string
  created_at: string
  updated_at: string
}
export interface CompanyMessageProfile {
  company_id: string
  email_signature: string
  created_at: string
  updated_at: string
}
export interface CompanyMessages {
  companyName: string
  templates: CompanyMessageTemplate[]
  profile: CompanyMessageProfile | null
}

export const MESSAGE_KIND_LABELS: Record<CompanyMessageKind, string> = {
  quote_send: "Envoi du devis",
  first_followup: "Première relance manuelle",
  second_followup: "Deuxième relance manuelle",
  expiry_followup: "Relance avant expiration",
  automatic_followup: "Relances automatiques",
}

export function messageTemplateErrors(draft: MessageDraft) {
  return {
    subject: /[\r\n]/.test(draft.subject)
      ? "L’objet doit tenir sur une seule ligne."
      : draft.subject.length > 160
        ? "L’objet est limité à 160 caractères."
        : automationTemplateError(draft.subject),
    body:
      draft.body.length > 4000
        ? "Le message est limité à 4 000 caractères."
        : automationTemplateError(draft.body),
  }
}

export function signatureError(signature: string) {
  if (signature.length > 800) return "La signature est limitée à 800 caractères."
  if (/[{}]/.test(signature))
    return "La signature utilise du texte simple, sans variables ni accolades."
  return ""
}

/** Plain text throughout: React and the email worker escape their own HTML. */
export function appendCompanySignature(body: string, signature: string) {
  const clean = signature.trim()
  if (!clean) return body
  const existing = body.trimEnd()
  // Applying a template twice must not double the signature.
  if (existing === clean || existing.endsWith(`\n\n${clean}`)) return body
  return `${existing}\n\n${clean}`
}

export function buildCompanyMessage({
  template,
  signature,
  fallback,
  values,
  mode = "rendered",
}: {
  template: CompanyMessageTemplate | null
  signature: string
  fallback: MessageDraft
  values: MessageValues
  mode?: "rendered" | "template"
}): { draft: MessageDraft; preview: MessageDraft; error: string } {
  const source = template
    ? { subject: template.subject_template, body: template.body_template }
    : fallback
  const draft = {
    subject:
      mode === "template" || !template
        ? source.subject
        : renderAutomationMessage(source.subject, values),
    body: appendCompanySignature(
      mode === "template" || !template
        ? source.body
        : renderAutomationMessage(source.body, values),
      signature,
    ),
  }
  const preview = {
    subject:
      mode === "template"
        ? renderAutomationMessage(draft.subject, values)
        : draft.subject,
    body:
      mode === "template" ? renderAutomationMessage(draft.body, values) : draft.body,
  }
  const sourceErrors = template ? messageTemplateErrors(source) : null
  const error =
    signatureError(signature) ||
    sourceErrors?.subject ||
    sourceErrors?.body ||
    (draft.subject.length > 160 || preview.subject.length > 160
      ? "L’objet dépasse 160 caractères avec les informations de ce devis."
      : /[\r\n]/.test(preview.subject)
        ? "L’objet doit tenir sur une seule ligne."
        : draft.body.length > 4000 || preview.body.length > 4000
          ? "Le message et la signature dépassent 4 000 caractères. Raccourcissez le modèle ou la signature."
          : "")
  return { draft, preview, error }
}
