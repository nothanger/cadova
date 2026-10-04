export const AUTOMATION_VARIABLES = [
  "client_name",
  "quote_reference",
  "company_name",
  "amount_formatted",
] as const

export type AutomationVariable = (typeof AUTOMATION_VARIABLES)[number]

export const DEFAULT_AUTOMATION_MESSAGES = {
  firstSubject: "Votre devis {{quote_reference}}",
  firstBody:
    "Bonjour {{client_name}},\n\nAvez-vous pu consulter notre devis {{quote_reference}} ? Si vous avez une question ou souhaitez le modifier, vous pouvez répondre à cet email.\n\n{{company_name}}",
}

export function renderAutomationMessage(
  template: string,
  values: Record<AutomationVariable, string>,
) {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) =>
    AUTOMATION_VARIABLES.includes(key as AutomationVariable)
      ? values[key as AutomationVariable]
      : match,
  )
}

export function automationTemplateError(template: string) {
  if (!template.trim()) return "Ce message ne peut pas être vide."
  const variables = [...template.matchAll(/\{\{\s*([^{}]+)\s*\}\}/g)]
  const unknown = variables.find(
    (match) => !AUTOMATION_VARIABLES.includes(match[1].trim() as AutomationVariable),
  )
  if (unknown) return `La variable « ${unknown[1].trim()} » n’est pas disponible.`
  const remaining = template.replace(/\{\{\s*([^{}]+)\s*\}\}/g, "")
  if (/[{}]/.test(remaining))
    return "Utilisez des variables entre deux accolades, par exemple {{client_name}}."
  return ""
}
