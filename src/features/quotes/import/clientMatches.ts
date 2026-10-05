import type { Client } from "@/types"

export type ClientMatch = {
  client: Client
  reasons: string[]
  contactMatch: boolean
}

export const normalizedEmail = (value: string) => value.trim().toLowerCase()
export function normalizedPhone(value: string) {
  const digits = value
    .replace(/\D/g, "")
    .replace(/^00/, "")
    .replace(/^330(?=[1-9]\d{8}$)/, "33")
  return /^0[1-9]\d{8}$/.test(digits) ? `33${digits.slice(1)}` : digits
}

export function normalizedClientName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Suggestions stay inside the active company. A name match is only a hint;
 * contact matches guard against creating an accidental duplicate. */
export function findClientMatches(
  clients: Client[],
  companyId: string,
  contact: { name: string; email: string; phone: string },
): ClientMatch[] {
  const email = normalizedEmail(contact.email)
  const phone = normalizedPhone(contact.phone)
  const name = normalizedClientName(contact.name)
  return clients
    .filter((client) => client.company_id === companyId)
    .map((client) => {
      const sameEmail = Boolean(
        email && client.email && normalizedEmail(client.email) === email,
      )
      const samePhone = Boolean(
        phone.length >= 8 && client.phone && normalizedPhone(client.phone) === phone,
      )
      const sameName = name.length >= 3 && normalizedClientName(client.name) === name
      return {
        client,
        contactMatch: sameEmail || samePhone,
        reasons: [
          sameEmail ? "Même adresse email" : "",
          samePhone ? "Même téléphone" : "",
          sameName ? "Même nom" : "",
        ].filter(Boolean),
        score: Number(sameEmail) * 4 + Number(samePhone) * 2 + Number(sameName),
      }
    })
    .filter((match) => match.reasons.length > 0)
    .sort(
      (a, b) => b.score - a.score || a.client.name.localeCompare(b.client.name, "fr"),
    )
    .map(({ client, contactMatch, reasons }) => ({ client, contactMatch, reasons }))
}
