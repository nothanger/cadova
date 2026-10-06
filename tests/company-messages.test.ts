import assert from "node:assert/strict"
import test from "node:test"
import {
  appendCompanySignature,
  buildCompanyMessage,
  messageTemplateErrors,
  signatureError,
  type CompanyMessageTemplate,
  type MessageValues,
} from "../src/features/message-templates/messages.ts"

const values: MessageValues = {
  client_name: "Élodie <Martin>",
  quote_reference: "D-2026-17",
  company_name: "Noto & fils",
  amount_formatted: "1 250,50 €",
}
const fallback = { subject: "Mon objet", body: "Mon message rédigé" }
const template: CompanyMessageTemplate = {
  company_id: "company-one",
  kind: "quote_send",
  subject_template: "Devis {{ quote_reference }}",
  body_template:
    "Bonjour {{client_name}},\n\nDevis de {{amount_formatted}} chez {{company_name}}.",
  created_at: "",
  updated_at: "",
}

test("a saved model renders actual values once and keeps plain text", () => {
  const result = buildCompanyMessage({
    template,
    signature: "Ethan\n06 12 34 56 78",
    fallback,
    values,
  })
  assert.equal(result.error, "")
  assert.equal(result.draft.subject, "Devis D-2026-17")
  assert.equal(
    result.draft.body,
    "Bonjour Élodie <Martin>,\n\nDevis de 1 250,50 € chez Noto & fils.\n\nEthan\n06 12 34 56 78",
  )
  assert.deepEqual(result.preview, result.draft)
  assert.deepEqual(fallback, { subject: "Mon objet", body: "Mon message rédigé" })
})
test("placeholder-like client input is never recursively interpreted", () => {
  const result = buildCompanyMessage({
    template,
    signature: "",
    fallback,
    values: { ...values, client_name: "{{company_name}}" },
  })
  assert.ok(result.preview.body.startsWith("Bonjour {{company_name}},"))
})
test("signature-only use preserves user text and literal placeholders", () => {
  const source = { subject: "Mon {{objet}}", body: "Je garde {{mon_texte}}" }
  const result = buildCompanyMessage({
    template: null,
    signature: "Ethan",
    fallback: source,
    values,
  })
  assert.deepEqual(result.draft, {
    subject: source.subject,
    body: `${source.body}\n\nEthan`,
  })
  assert.equal(result.error, "")
})
test("signature whitespace and repeated application avoid duplicate signatures", () => {
  assert.equal(appendCompanySignature("Bonjour\n ", "\n Ethan \n"), "Bonjour\n\nEthan")
  assert.equal(appendCompanySignature("Bonjour\n\nEthan", "Ethan"), "Bonjour\n\nEthan")
  assert.equal(appendCompanySignature("Ethan", "Ethan"), "Ethan")
  assert.equal(appendCompanySignature("Mon message\n ", "  "), "Mon message\n ")
})
test("automatic templates keep variables and append a literal signature", () => {
  const result = buildCompanyMessage({
    template,
    signature: "Ethan\nNoto",
    fallback,
    values,
    mode: "template",
  })
  assert.equal(result.draft.subject, template.subject_template)
  assert.ok(result.draft.body.includes("{{client_name}}"))
  assert.ok(result.draft.body.endsWith("\n\nEthan\nNoto"))
  assert.ok(result.preview.body.includes("Élodie <Martin>"))
})
test("unsupported and malformed variables are rejected before using a template", () => {
  assert.match(
    messageTemplateErrors({ subject: "Bonjour {{secret}}", body: "OK" }).subject,
    /pas disponible/,
  )
  assert.match(
    messageTemplateErrors({ subject: "Bonjour", body: "{{client_name}" }).body,
    /accolades/,
  )
  assert.equal(
    messageTemplateErrors({
      subject: " {{ client_name }} ",
      body: "{{amount_formatted}}",
    }).body,
    "",
  )
  assert.match(
    buildCompanyMessage({
      template: { ...template, body_template: "{{secret}}" },
      signature: "",
      fallback,
      values,
    }).error,
    /pas disponible/,
  )
})
test("email subject newlines and blank model content are rejected", () => {
  assert.match(
    messageTemplateErrors({ subject: "A\r\nB", body: "Message" }).subject,
    /une seule ligne/,
  )
  assert.ok(messageTemplateErrors({ subject: " ", body: "\n" }).subject)
  assert.ok(messageTemplateErrors({ subject: "Sujet", body: " " }).body)
})
test("signature variables are forbidden and empty signature can be saved", () => {
  assert.equal(signatureError(""), "")
  assert.match(signatureError("{{company_name}}"), /sans variables/)
  assert.match(signatureError("x".repeat(801)), /800/)
  assert.equal(signatureError("x".repeat(800)), "")
})
test("body and signature overflow gives an error instead of truncating", () => {
  const long = { ...template, body_template: "x".repeat(3998) }
  const result = buildCompanyMessage({
    template: long,
    signature: "Ethan",
    fallback,
    values,
  })
  assert.match(result.error, /4 000/)
  assert.equal(result.draft.body.length, 4005)
  assert.ok(result.draft.body.endsWith("Ethan"))
  assert.equal(
    buildCompanyMessage({
      template: { ...template, body_template: "x".repeat(3993) },
      signature: "Ethan",
      fallback,
      values,
    }).error,
    "",
  )
})
test("rendered values can overflow a valid automatic template", () => {
  const result = buildCompanyMessage({
    template: { ...template, body_template: "{{client_name}}" },
    signature: "",
    fallback,
    values: { ...values, client_name: "x".repeat(4001) },
    mode: "template",
  })
  assert.match(result.error, /4 000/)
  assert.equal(result.draft.body, "{{client_name}}")
})
test("rendered subject limits and injected newlines are checked", () => {
  assert.match(
    buildCompanyMessage({
      template,
      signature: "",
      fallback,
      values: { ...values, quote_reference: "x".repeat(160) },
    }).error,
    /160/,
  )
  assert.match(
    buildCompanyMessage({
      template,
      signature: "",
      fallback,
      values: { ...values, quote_reference: "A\nB" },
    }).error,
    /une seule ligne/,
  )
})
