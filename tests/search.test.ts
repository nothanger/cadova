import assert from "node:assert/strict"
import { test } from "node:test"
import {
  isSearchQueryValid,
  normalizeSearchQuery,
  parseSearchResults,
  searchRecordPath,
} from "../src/features/search/search.ts"

const client = {
  kind: "client",
  id: "client-1",
  company_id: "company-1",
  label: "Émile",
  detail: "contact@example.test",
  client_name: "Émile",
  amount_cents: null,
  status: null,
}

test("search accepts useful queries and trims without altering names or amounts", () => {
  assert.equal(normalizeSearchQuery("  1 250,50 €  "), "1 250,50 €")
  for (const query of ["", "  ", " a ", "x".repeat(121)])
    assert.equal(isSearchQueryValid(query), false)
  for (const query of [" Ém ", "x".repeat(120), "01 02 03", "1 250,50 €"])
    assert.equal(isSearchQueryValid(query), true)
})

test("search refuses rows outside the selected company", () => {
  assert.throws(() =>
    parseSearchResults({ items: [client], hasMore: false }, "company-2"),
  )
  assert.deepEqual(
    parseSearchResults({ items: [client], hasMore: false }, "company-1"),
    { items: [client], hasMore: false },
  )
})

test("search refuses malformed shapes, amounts, labels, and states", () => {
  for (const data of [
    null,
    {},
    { items: null, hasMore: false },
    { items: [], hasMore: "false" },
    { items: Array(21).fill(client), hasMore: true },
  ])
    assert.throws(() => parseSearchResults(data, "company-1"))
  for (const mutation of [
    { kind: "company" },
    { label: " " },
    { id: "" },
    { detail: 2 },
    { amount_cents: -1 },
    { amount_cents: 1250.5 },
    { status: "sent-ish" },
  ])
    assert.throws(() =>
      parseSearchResults(
        { items: [{ ...client, ...mutation }], hasMore: false },
        "company-1",
      ),
    )
})

test("search accepts factual quote data and scopes navigation to existing details", () => {
  const quote = {
    ...client,
    kind: "quote",
    label: "D-2026-01",
    amount_cents: 125050,
    status: "sent",
  }
  assert.deepEqual(parseSearchResults({ items: [quote], hasMore: true }, "company-1"), {
    items: [quote],
    hasMore: true,
  })
  assert.equal(
    searchRecordPath({ kind: "quote", id: "quote-1" }),
    "/app/quotes/quote-1",
  )
  assert.equal(
    searchRecordPath({ kind: "client", id: "client/fragment?" }),
    "/app/clients/client%2Ffragment%3F",
  )
})
