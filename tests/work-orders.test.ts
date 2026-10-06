import assert from "node:assert/strict"
import test from "node:test"
import {
  validateWorkOrderInput,
  validWorkOrderDate,
  workOrderConfirmation,
  workOrderFromResponse,
} from "../src/features/quotes/work-orders/model"

test("une intervention planifiée exige une vraie date calendaire", () => {
  assert.match(
    validateWorkOrderInput({ status: "scheduled", scheduled_for: null }) ?? "",
    /date/,
  )
  for (const invalid of [
    "2026-02-29",
    "2026-13-01",
    "2026-04-31",
    "0000-01-01",
    "1899-12-31",
    "2201-01-01",
    "2026-1-05",
    "2026-01-01T12:00:00Z",
  ])
    assert.equal(validWorkOrderDate(invalid), false, invalid)
  for (const valid of ["2028-02-29", "2026-12-31", "1900-01-01", "2200-12-31"])
    assert.equal(
      validateWorkOrderInput({ status: "scheduled", scheduled_for: valid }),
      null,
      valid,
    )
})

test("les autres états conservent une date facultative sans inventer de planning", () => {
  for (const status of ["to_schedule", "in_progress", "completed"] as const) {
    assert.equal(validateWorkOrderInput({ status, scheduled_for: null }), null)
    assert.match(
      validateWorkOrderInput({ status, scheduled_for: "2026-02-31" }) ?? "",
      /date/,
    )
  }
})

test("la clôture et la réouverture demandent une confirmation distincte", () => {
  assert.equal(workOrderConfirmation("scheduled", "completed"), "complete")
  assert.equal(workOrderConfirmation(null, "completed"), "complete")
  assert.equal(workOrderConfirmation("completed", "to_schedule"), "reopen")
  assert.equal(workOrderConfirmation("completed", "in_progress"), "reopen")
  assert.equal(workOrderConfirmation("completed", "completed"), null)
  assert.equal(workOrderConfirmation("scheduled", "in_progress"), null)
})

const record = {
  quote_id: "quote-one",
  company_id: "company-one",
  status: "scheduled",
  scheduled_for: "2026-10-20",
  created_at: "2026-10-05T12:00:00Z",
  updated_at: "2026-10-05T12:00:00Z",
}
test("une réponse d’une autre entreprise ou d’un autre devis est refusée", () => {
  assert.equal(workOrderFromResponse(record, "quote-other", "company-one"), null)
  assert.equal(workOrderFromResponse(record, "quote-one", "company-other"), null)
  assert.deepEqual(workOrderFromResponse(record, "quote-one", "company-one"), record)
})

test("une réponse incohérente du serveur ne devient pas un état visible", () => {
  for (const change of [
    { status: "invented" },
    { scheduled_for: null },
    { scheduled_for: "2026-02-30" },
    { updated_at: "not-a-date" },
  ])
    assert.equal(
      workOrderFromResponse({ ...record, ...change }, "quote-one", "company-one"),
      null,
    )
  assert.equal(workOrderFromResponse(null, "quote-one", "company-one"), null)
})
