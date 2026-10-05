import type { ExtractedQuoteFields, QuoteImportReview } from "./types"

const emailPattern =
  /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}/g
const clientHeading =
  /^(?:client(?:e)?|destinataire|coordonn[ée]es\s+(?:du\s+)?client|factur[ée]\s+[àa]|adress[ée]\s+[àa])\s*(?::|$)/i
const sectionBoundary =
  /^(?:devis\b|r[ée]f[ée]rence\b|date\b|validit[ée]\b|objet\b|d[ée]signation\b|description\b|prestation\b|quantit[ée]\b|total\b|montant\b|conditions\b|mentions\b|acompte\b|signature\b|[ée]metteur\b|fournisseur\b|vendeur\b|nos\s+coordonn[ée]es\b|votre\s+contact\b|entreprise\s*:|siret\b|siren\b|tva\b|iban\b)/i

function unique(values: string[]) {
  return [...new Set(values)]
}

/** Amounts must occupy the complete value: dates, percentages and phone numbers
 * are deliberately not accepted as partial matches. */
export function parseDocumentAmount(value: string): string | undefined {
  const trimmed = value
    .trim()
    .replace(/^(?:EUR|€)\s*/i, "")
    .replace(/\s*(?:EUR|€)$/i, "")
    .trim()
  if (!/^\d[\d\s\u00a0\u202f.,]*$/.test(trimmed)) return
  let normalized = trimmed.replace(/[\s\u00a0\u202f]/g, "")
  if (normalized.includes(",") && normalized.includes(".")) {
    if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(normalized)) {
      normalized = normalized.replace(/\./g, "").replace(",", ".")
    } else if (/^\d{1,3}(?:,\d{3})+\.\d{2}$/.test(normalized)) {
      normalized = normalized.replace(/,/g, "")
    } else return
  } else {
    normalized = normalized.replace(",", ".")
  }
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(normalized)) return
  // Grouped digits must be real thousands, not a French phone number.
  const integerPart = trimmed.split(/[.,]/)[0]
  if (
    /\s/.test(integerPart) &&
    !/^\d{1,3}(?:[\s\u00a0\u202f]\d{3})+$/.test(integerPart)
  )
    return
  const numeric = Number(normalized)
  if (!Number.isFinite(numeric)) return
  return numeric.toFixed(2)
}

function explicitValidityDate(lines: string[]): string | undefined {
  const values: string[] = []
  for (const line of lines) {
    const match = line.match(
      /(?:valable\s+jusqu['’]?(?:au|[àa])|validit[ée]\s*(?:jusqu['’]?(?:au|[àa]))?|date\s+(?:limite\s+de\s+validit[ée]|d['’]expiration))\s*:?\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/i,
    )
    if (!match) continue
    const [, day, month, year] = match
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    if (
      parsed.getUTCFullYear() !== Number(year) ||
      parsed.getUTCMonth() !== Number(month) - 1 ||
      parsed.getUTCDate() !== Number(day)
    )
      continue
    values.push(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`)
  }
  const dates = unique(values)
  return dates.length === 1 ? dates[0] : undefined
}

export function extractQuoteFields(
  text: string,
  options: { lowConfidenceText?: string[] } = {},
): {
  fields: ExtractedQuoteFields
  warnings: string[]
  review: QuoteImportReview
} {
  // Bound work even when a malformed text layer contains millions of characters.
  const lines = text
    .slice(0, 160_000)
    .normalize("NFKC")
    .split(/\r?\n/)
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .filter(Boolean)
  const fields: ExtractedQuoteFields = {}
  const warnings: string[] = []
  const references: string[] = []
  const referenceSources: string[] = []
  for (const line of lines.slice(0, 40)) {
    const match = line.match(
      /^(?:(?:num[ée]ro|n[°ºo])\s*(?:de\s+)?devis|devis\s*(?:(?:n[°ºo]|num[ée]ro|r[ée]f(?:[ée]rence)?\.?)\s*)?|r[ée]f[ée]rence\s*(?:du\s+devis)?)\s*[:#]?\s*([a-zA-Z0-9][a-zA-Z0-9_./-]{1,59})(?:\s|$)/i,
    )
    if (
      match &&
      /\d/.test(match[1]) &&
      !/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(match[1])
    ) {
      references.push(match[1])
      referenceSources.push(line)
    }
  }
  const distinctReferences = unique(references)
  if (distinctReferences.length === 1) fields.reference = distinctReferences[0]
  else if (distinctReferences.length > 1)
    warnings.push("Plusieurs références ont été trouvées. Choisissez celle du devis.")

  const totals: string[] = []
  const totalSources: string[] = []
  const exemptFromVat = /tva\s+non\s+applicable|exon[ée]r[ée]\s+de\s+tva/i.test(text)
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const label =
      line.match(
        /^(?:(?:montant\s+)?total(?:\s+g[ée]n[ée]ral)?|montant)\s+t\.?\s*t\.?\s*c\.?\s*[:=]?\s*(.*)$/i,
      ) ?? (exemptFromVat ? line.match(/^(?:montant\s+)?total\s*[:=]?\s*(.*)$/i) : null)
    if (!label) continue
    const value = label[1] || lines[index + 1] || ""
    totalSources.push(label[1] ? line : `${line}\n${value}`)
    const amount = parseDocumentAmount(value)
    if (amount !== undefined) {
      totals.push(amount)
    }
  }
  const amounts = unique(totals)
  if (amounts.length === 1) fields.amount = amounts[0]
  else if (amounts.length > 1)
    warnings.push(
      "Plusieurs totaux TTC différents ont été trouvés. Vérifiez le montant du devis.",
    )
  else
    warnings.push(
      "Le total TTC n’a pas pu être identifié avec certitude. Renseignez-le après vérification.",
    )

  const blocks: string[][] = []
  for (let index = 0; index < lines.length; index++) {
    if (!clientHeading.test(lines[index])) continue
    const first = lines[index].replace(clientHeading, "").trim()
    const block = first ? [first] : []
    for (let offset = 1; offset <= 7 && index + offset < lines.length; offset++) {
      const next = lines[index + offset]
      if (sectionBoundary.test(next) || clientHeading.test(next)) break
      block.push(next)
    }
    blocks.push(block)
  }
  const candidates = blocks.map((block) => {
    const emails = unique(
      (block.join("\n").match(emailPattern) ?? []).map((email) => email.toLowerCase()),
    )
    const phoneLines = block.filter((line) =>
      /^(?:t[ée]l(?:[ée]phone)?\.?|mobile|portable)\s*:/i.test(line),
    )
    const phones = phoneLines
      .map((line) =>
        line.replace(/^(?:t[ée]l(?:[ée]phone)?\.?|mobile|portable)\s*:\s*/i, "").trim(),
      )
      .filter((phone) =>
        /^(?:\+33\s*(?:\(0\)\s*)?|0)[1-9](?:[ .-]*\d{2}){4}$/.test(phone),
      )
    const uniquePhones = unique(
      phones.map((phone) => phone.replace(/\D/g, "").replace(/^33(?:0)?/, "0")),
    )
    const validPhone = uniquePhones.length === 1 ? phones[0] : undefined
    const first = block[0]?.replace(/^(?:nom|raison\s+sociale)\s*:\s*/i, "")
    const validName =
      first &&
      first.length <= 100 &&
      /[a-zA-ZÀ-ÿ]/.test(first) &&
      !emailPattern.test(first) &&
      !/^(?:email|e-mail|courriel|t[ée]l|mobile|portable|adresse|\d)\b/i.test(first) &&
      !/\s{2,}|\|/.test(first)
        ? first
        : undefined
    emailPattern.lastIndex = 0
    return {
      email: emails.length === 1 ? emails[0] : undefined,
      name: validName,
      phone: validPhone,
      emails,
      phones: uniquePhones,
      block,
    }
  })
  // A single clearly delimited client section is needed. Unlabelled company
  // headers and footers never supply an automatic recipient.
  if (candidates.length === 1) {
    if (candidates[0].email) fields.clientEmail = candidates[0].email
    if (candidates[0].name) fields.clientName = candidates[0].name
    if (candidates[0].phone) fields.clientPhone = candidates[0].phone
  }
  if (!fields.clientEmail)
    warnings.push(
      "L’adresse email du destinataire reste à confirmer : celle de l’entreprise émettrice n’est pas utilisée.",
    )
  const expiresAt = explicitValidityDate(lines)
  if (expiresAt) fields.expiresAt = expiresAt
  if (!text.trim())
    warnings.push(
      "Le document n’a pas fourni de texte lisible. Vous pouvez compléter les informations manuellement.",
    )
  const sources = (values: string[]) =>
    unique(values)
      .slice(0, 4)
      .map((value) => value.slice(0, 320))
  const clientSources = sources(blocks.map((block) => block.join("\n")))
  const dateSources = sources(
    lines.filter((line) =>
      /valable\s+jusqu|validit[ée]|date\s+(?:limite|d['’]expiration)/i.test(line),
    ),
  )
  const multipleClients = candidates.length > 1
  const multipleEmails =
    multipleClients || candidates.some((candidate) => candidate.emails.length > 1)
  const multiplePhones =
    multipleClients || candidates.some((candidate) => candidate.phones.length > 1)
  const review: QuoteImportReview = {
    reference: {
      state: fields.reference
        ? "identified"
        : distinctReferences.length > 1
          ? "ambiguous"
          : "missing",
      reason: fields.reference
        ? "Référence repérée dans le document."
        : distinctReferences.length > 1
          ? "Plusieurs références figurent dans le document. Choisissez celle de ce devis."
          : "Aucune référence exploitable n’a été repérée.",
      sources: sources(referenceSources),
    },
    amount: {
      state: fields.amount
        ? "identified"
        : amounts.length > 1
          ? "ambiguous"
          : "missing",
      reason: fields.amount
        ? "Total TTC repéré dans le document."
        : amounts.length > 1
          ? "Plusieurs totaux TTC différents figurent dans le document."
          : "Le total TTC manque ou n’a pas pu être lu. Le montant HT et l’acompte ne le remplacent pas.",
      sources: sources(totalSources),
    },
    clientName: {
      state: fields.clientName
        ? "identified"
        : multipleClients
          ? "ambiguous"
          : "missing",
      reason: fields.clientName
        ? "Nom repéré dans le bloc client."
        : multipleClients
          ? "Plusieurs blocs client ont été repérés."
          : "Le nom du destinataire n’a pas pu être identifié.",
      sources: clientSources,
    },
    clientEmail: {
      state: fields.clientEmail
        ? "identified"
        : multipleEmails
          ? "ambiguous"
          : "missing",
      reason: fields.clientEmail
        ? "Adresse repérée dans le bloc client."
        : multipleEmails
          ? "Plusieurs destinataires sont possibles. Confirmez l’adresse du bon client."
          : "Aucune adresse unique dans le bloc client. L’adresse de l’émetteur n’est pas utilisée.",
      sources: clientSources,
    },
    clientPhone: {
      state: fields.clientPhone
        ? "identified"
        : multiplePhones
          ? "ambiguous"
          : "missing",
      reason: fields.clientPhone
        ? "Téléphone repéré dans le bloc client."
        : multiplePhones
          ? "Plusieurs téléphones client ont été repérés. Choisissez le bon numéro."
          : "Aucun téléphone exploitable repéré. Ce champ reste facultatif.",
      sources: clientSources,
    },
    expiresAt: {
      state: fields.expiresAt
        ? "identified"
        : dateSources.length
          ? "uncertain"
          : "missing",
      reason: fields.expiresAt
        ? "Date de validité explicite repérée."
        : dateSources.length
          ? "La validité ne fournit pas une date unique et exploitable. Vérifiez le document."
          : "Aucune date limite repérée. Ce champ reste facultatif.",
      sources: dateSources,
    },
  }
  const uncertainPages = (options.lowConfidenceText ?? []).map((page) =>
    page.normalize("NFKC").replace(/[\t ]+/g, " "),
  )
  for (const field of Object.values(review)) {
    if (
      field.state === "identified" &&
      field.sources.some((source) =>
        source
          .split("\n")
          .some(
            (line) =>
              line.length >= 4 && uncertainPages.some((page) => page.includes(line)),
          ),
      )
    ) {
      field.state = "uncertain"
      field.reason =
        "Le scan de ce passage manque de netteté. Comparez cette information à l’original."
    }
  }
  return { fields, warnings, review }
}
