import assert from "node:assert/strict"
import test from "node:test"
import {
  findClientMatches,
  normalizedPhone,
} from "../src/features/quotes/import/clientMatches"
import type { Client } from "../src/types"

const client = (id: string, fields: Partial<Client> = {}): Client => ({
  id,
  company_id: "company-current",
  name: "Éthan Noto",
  email: "ethan@example.test",
  phone: "06 12 34 56 78",
  notes: null,
  created_at: "2026-10-01",
  updated_at: "2026-10-01",
  ...fields,
})

test("les suggestions rapprochent les coordonnées françaises et restent dans l’entreprise active", () => {
  const clients = [
    client("same"),
    client("other-company", { company_id: "company-other" }),
  ]
  const matches = findClientMatches(clients, "company-current", {
    name: "Ethan-Noto",
    email: " ETHAN@example.test ",
    phone: "+33 6 12 34 56 78",
  })
  assert.deepEqual(
    matches.map((match) => match.client.id),
    ["same"],
  )
  assert.deepEqual(matches[0].reasons, [
    "Même adresse email",
    "Même téléphone",
    "Même nom",
  ])
  assert.equal(matches[0].contactMatch, true)
  assert.equal(normalizedPhone("0033 6 12 34 56 78"), normalizedPhone("06.12.34.56.78"))
  assert.equal(
    normalizedPhone("+33 (0)6 12 34 56 78"),
    normalizedPhone("06 12 34 56 78"),
  )
})

test("un même nom est seulement une suggestion, sans bloquer des homonymes", () => {
  const original = client("name-only", { email: "different@example.test", phone: null })
  const matches = findClientMatches([original], "company-current", {
    name: "Ethan Noto",
    email: "new@example.test",
    phone: "",
  })
  assert.equal(matches[0].contactMatch, false)
  assert.deepEqual(matches[0].reasons, ["Même nom"])
  assert.equal(original.email, "different@example.test")
})

test("les suggestions privilégient un contact exact et ignorent les valeurs vides ou trop courtes", () => {
  const matches = findClientMatches(
    [
      client("name", { email: null, phone: null }),
      client("email", { name: "Autre raison sociale", phone: null }),
    ],
    "company-current",
    { name: "Ethan Noto", email: "ethan@example.test", phone: "" },
  )
  assert.deepEqual(
    matches.map((match) => match.client.id),
    ["email", "name"],
  )
  assert.deepEqual(
    findClientMatches(
      [client("short", { name: "AB", email: null, phone: "123" })],
      "company-current",
      { name: "AB", email: "", phone: "123" },
    ),
    [],
  )
})
