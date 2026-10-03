import assert from "node:assert/strict"
import test from "node:test"
import { centsToInput, parseAmountToCents, formatCents } from "../src/lib/money"
import { daysBetween, toISODate } from "../src/lib/dates"
import { daysWaiting, isQuoteDueForFollowUp } from "../src/lib/followup"

test("les montants saisis en français conservent les centimes", () => {
  assert.equal(parseAmountToCents("1 250,50 €"), 125050)
  assert.equal(parseAmountToCents("0,01"), 1)
  assert.equal(parseAmountToCents(centsToInput(125050)), 125050)
  assert.match(formatCents(125050), /1\s250,50\s€/)
})
test("les montants invalides ne deviennent pas des devis à zéro", () => {
  for (const input of ["", "abc", "-1", "1.234", "1,2,3"])
    assert.equal(parseAmountToCents(input), null)
})
test("le calcul des jours couvre le changement d’heure", () => {
  assert.equal(daysBetween("2026-03-28", "2026-03-30"), 2)
  assert.equal(daysBetween("2026-10-24", "2026-10-26"), 2)
})
test("seuls les devis envoyés dépassant le délai sont à relancer", () => {
  const date = new Date()
  date.setDate(date.getDate() - 5)
  const sent_at = toISODate(date)
  assert.equal(isQuoteDueForFollowUp({ status: "sent", sent_at }, 3), true)
  assert.equal(isQuoteDueForFollowUp({ status: "sent", sent_at }, 7), false)
  assert.equal(daysWaiting({ status: "sent", sent_at }), 5)
  for (const status of ["draft", "accepted", "refused"] as const) {
    assert.equal(isQuoteDueForFollowUp({ status, sent_at }), false)
    assert.equal(daysWaiting({ status, sent_at }), null)
  }
  assert.equal(isQuoteDueForFollowUp({ status: "sent", sent_at: null }), false)
})
