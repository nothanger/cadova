import assert from "node:assert/strict"
import test from "node:test"
import {
  buildWorkspaceActions,
  type WorkspaceContext,
  type WorkspaceQuote,
} from "../src/features/dashboard/workspaceActions"

const now = new Date("2026-10-05T12:00:00")
function quote(
  id = "quote-one",
  overrides: Partial<WorkspaceQuote> = {},
): WorkspaceQuote {
  return {
    id,
    company_id: "company-one",
    client_id: "client-one",
    reference: id,
    amount_cents: 120000,
    status: "sent",
    sent_at: "2026-09-20",
    notes: null,
    next_followup_at: null,
    expires_at: null,
    created_at: "2026-09-20T10:00:00Z",
    updated_at: "2026-09-20T10:00:00Z",
    client: { id: "client-one", name: "Client test", email: "client@example.test" },
    ...overrides,
  }
}
function context(overrides: Partial<WorkspaceContext> = {}): WorkspaceContext {
  return {
    companyId: "company-one",
    quotes: [quote()],
    automations: [],
    messages: [],
    events: [],
    deliveries: [],
    sendJobs: [],
    replyTo: "contact@example.test",
    companyPaused: false,
    reads: {
      automation: "available",
      messages: "available",
      events: "available",
      deliveries: "available",
      settings: "available",
      sendJobs: "available",
    },
    ...overrides,
  }
}
const automation = {
  quote_id: "quote-one",
  company_id: "company-one",
  enabled: true,
  paused: false,
  next_send_at: "2026-10-07T08:00:00Z",
  stop_reason: null,
}
function build(overrides: Partial<WorkspaceContext> = {}) {
  return buildWorkspaceActions(context(overrides), 3, now)
}

test("la date manuelle choisie prime sur l’âge du devis", () => {
  const future = build({
    quotes: [quote("quote-one", { next_followup_at: "2026-10-09" })],
  })
  assert.equal(future.manualDue.length, 0)
  assert.equal(future.scheduled[0].automatic, false)
  const due = build({
    quotes: [quote("quote-one", { next_followup_at: "2026-10-05" })],
  })
  assert.equal(due.manualDue.length, 1)
  assert.equal(due.actions[0].kind, "followup")
})

test("un devis automatique actif ou en pause ne devient pas une relance manuelle", () => {
  const active = build({ automations: [automation] })
  assert.equal(active.manualDue.length, 0)
  assert.equal(active.scheduled[0].automatic, true)
  for (const overrides of [
    { automations: [{ ...automation, paused: true }] },
    { automations: [automation], companyPaused: true },
  ]) {
    const paused = build(overrides)
    assert.equal(paused.manualDue.length, 0)
    assert.equal(paused.scheduled.length, 0)
    assert.equal(paused.actions[0].kind, "automation_paused")
  }
})

test("les questions sans réponse précèdent les autres actions et arrêtent les propositions de relance", () => {
  const question = {
    id: "message-one",
    company_id: "company-one",
    quote_id: "quote-one",
    author: "client" as const,
    kind: "question" as const,
    created_at: "2026-10-04T12:00:00Z",
  }
  const pending = build({ messages: [question] })
  assert.equal(pending.actions[0].kind, "question")
  assert.equal(pending.manualDue.length, 0)
  const replied = build({
    messages: [
      question,
      {
        ...question,
        id: "reply-one",
        author: "company",
        kind: "message",
        created_at: "2026-10-05T10:00:00Z",
      },
    ],
  })
  assert.equal(
    replied.actions.some((action) => action.kind === "question"),
    false,
  )
  const newQuestion = build({
    messages: [
      question,
      {
        ...question,
        id: "reply-one",
        author: "company",
        kind: "message",
        created_at: "2026-10-04T15:00:00Z",
      },
      { ...question, id: "message-two", created_at: "2026-10-05T10:00:00Z" },
    ],
  })
  assert.equal(newQuestion.actions[0].kind, "question")
})

test("une réponse enregistrée reste à traiter sans encourager un autre email", () => {
  const response = {
    company_id: "company-one",
    quote_id: "quote-one",
    event_type: "response",
    occurred_at: "2026-10-04T12:00:00Z",
  }
  const result = build({ events: [response] })
  assert.deepEqual(
    result.actions.map((action) => action.kind),
    ["response"],
  )
  assert.equal(result.manualDue.length, 0)
  const scheduled = build({
    quotes: [quote("quote-one", { next_followup_at: "2026-10-09" })],
    events: [
      response,
      {
        ...response,
        event_type: "followup_scheduled",
        occurred_at: "2026-10-05T10:00:00Z",
      },
    ],
  })
  assert.equal(scheduled.actions.length, 0)
  assert.equal(scheduled.scheduled.length, 1)
})

test("une livraison refusée demande une vérification plutôt qu’une relance", () => {
  for (const status of ["bounced", "failed", "complained"] as const) {
    const result = build({
      deliveries: [
        {
          id: "delivery-one",
          company_id: "company-one",
          quote_id: "quote-one",
          status,
          created_at: "2026-09-20T10:00:00Z",
          last_event_at: "2026-10-04T12:00:00Z",
        },
      ],
    })
    assert.equal(result.actions[0].kind, "delivery")
    assert.equal(result.manualDue.length, 0)
  }
})

test("un ancien rebond arrivé tard ne masque pas la livraison du nouvel envoi", () => {
  const result = build({
    deliveries: [
      {
        id: "old",
        company_id: "company-one",
        quote_id: "quote-one",
        status: "bounced",
        created_at: "2026-09-20T10:00:00Z",
        last_event_at: "2026-10-05T10:00:00Z",
      },
      {
        id: "new",
        company_id: "company-one",
        quote_id: "quote-one",
        status: "delivered",
        created_at: "2026-10-04T10:00:00Z",
        last_event_at: "2026-10-04T10:01:00Z",
      },
    ],
  })
  assert.equal(
    result.actions.some((action) => action.kind === "delivery"),
    false,
  )
})

test("un devis expiré ou décidé ne déclenche aucune relance", () => {
  const expired = build({ quotes: [quote("quote-one", { expires_at: "2026-10-04" })] })
  assert.deepEqual(
    expired.actions.map((action) => action.kind),
    ["expired"],
  )
  assert.equal(expired.manualDue.length, 0)
  for (const status of ["accepted", "refused"] as const) {
    assert.equal(build({ quotes: [quote("quote-one", { status })] }).actions.length, 0)
  }
})

test("la relance cesse à la date de validité selon le jour de Paris, comme sur le serveur", () => {
  const rows = context({
    quotes: [quote("quote-one", { expires_at: "2026-10-05" })],
    automations: [automation],
    serviceReady: true,
  })
  // It is still October 4 in UTC, but already October 5 in Paris.
  const atParisExpiry = buildWorkspaceActions(rows, 3, new Date("2026-10-04T22:00:00Z"))
  assert.deepEqual(
    atParisExpiry.actions.map((action) => action.kind),
    ["expired"],
  )
  assert.equal(atParisExpiry.scheduled.length, 0)
  assert.equal(atParisExpiry.manualDue.length, 0)
  const beforeParisExpiry = buildWorkspaceActions(
    rows,
    3,
    new Date("2026-10-04T21:59:59Z"),
  )
  assert.equal(beforeParisExpiry.actions.length, 0)
  assert.equal(beforeParisExpiry.scheduled[0].automatic, true)
})

test("les brouillons et adresses manquantes ouvrent les bonnes pages", () => {
  const result = build({
    quotes: [
      quote("quote-one", {
        status: "draft",
        sent_at: null,
        client: { id: "client-one", name: "Client test", email: null },
      }),
    ],
  })
  assert.deepEqual(
    result.actions.map((action) => action.kind),
    ["missing_email", "draft"],
  )
  assert.equal(result.actions[0].to, "/app/clients/client-one/edit")
  assert.equal(result.actions[1].to, "/app/quotes/quote-one?focus=document")
})

test("une lecture des relances échouée ne prétend pas avoir trouvé zéro relance", () => {
  for (const table of [
    "automation",
    "events",
    "messages",
    "deliveries",
    "sendJobs",
    "settings",
  ] as const) {
    const result = build({ reads: { ...context().reads, [table]: "unavailable" } })
    assert.equal(result.followupsKnown, false, table)
    assert.equal(result.manualDue.length, 0, table)
    assert.equal(
      result.actions.some((action) => action.kind === "followup"),
      false,
      table,
    )
  }
  const calendar = build({
    automations: [automation],
    reads: { ...context().reads, settings: "unavailable" },
  })
  assert.equal(calendar.scheduled.length, 0)
})

test("les cycles automatiques terminés demandent une décision, pas une troisième relance", () => {
  const result = build({
    automations: [
      { ...automation, enabled: false, next_send_at: null, stop_reason: "completed" },
    ],
  })
  assert.deepEqual(
    result.actions.map((action) => action.kind),
    ["review"],
  )
  assert.equal(result.manualDue.length, 0)
})

test("un envoi initial incertain ne propose pas de renvoyer le brouillon", () => {
  for (const status of [
    "preparing",
    "processing",
    "delivery_unknown",
    "failed",
  ] as const) {
    const result = build({
      quotes: [quote("quote-one", { status: "draft", sent_at: null })],
      sendJobs: [
        {
          company_id: "company-one",
          quote_id: "quote-one",
          status,
          created_at: "2026-10-05T10:00:00Z",
        },
      ],
    })
    assert.deepEqual(
      result.actions.map((action) => action.kind),
      ["delivery"],
    )
    assert.equal(result.manualDue.length, 0)
    assert.match(result.actions[0].title, /Vérifier l’envoi/)
    assert.equal(result.actions[0].to, "/app/quotes/quote-one?focus=document")
  }
})

test("une relance automatique incertaine ne devient pas une nouvelle relance manuelle", () => {
  const result = build({
    automations: [
      {
        ...automation,
        enabled: false,
        next_send_at: null,
        stop_reason: "delivery_unknown",
      },
    ],
  })
  assert.deepEqual(
    result.actions.map((action) => action.kind),
    ["delivery"],
  )
  assert.equal(result.manualDue.length, 0)
  assert.equal(result.actions[0].to, "/app/quotes/quote-one?focus=followups")
})

test("un brouillon dont l’état d’envoi est inaccessible demande une vérification", () => {
  const result = build({
    quotes: [quote("quote-one", { status: "draft", sent_at: null })],
    reads: { ...context().reads, sendJobs: "unavailable" },
  })
  assert.deepEqual(
    result.actions.map((action) => action.kind),
    ["delivery"],
  )
  assert.match(result.actions[0].detail, /n’a pas pu être vérifié/)
  assert.equal(result.actions[0].to, "/app/quotes/quote-one?focus=document")
  assert.equal(result.followupsKnown, false)
})

test("un ancien envoi rejeté ne bloque pas un devis ensuite envoyé autrement", () => {
  const result = build({
    sendJobs: [
      {
        company_id: "company-one",
        quote_id: "quote-one",
        status: "failed",
        created_at: "2026-09-19T10:00:00Z",
      },
    ],
  })
  assert.deepEqual(
    result.actions.map((action) => action.kind),
    ["followup"],
  )
  assert.equal(result.manualDue.length, 1)
})

test("aucune donnée provenant d’une autre entreprise n’influence la liste", () => {
  const result = build({
    quotes: [quote(), quote("quote-other", { company_id: "company-other" })],
    automations: [{ ...automation, company_id: "company-other", paused: true }],
    messages: [
      {
        id: "other-message",
        company_id: "company-other",
        quote_id: "quote-one",
        author: "client",
        kind: "question",
        created_at: "2026-10-04T12:00:00Z",
      },
    ],
    events: [
      {
        company_id: "company-other",
        quote_id: "quote-one",
        event_type: "response",
        occurred_at: "2026-10-04T12:00:00Z",
      },
    ],
  })
  assert.deepEqual(
    result.actions.map((action) => action.kind),
    ["followup"],
  )
  assert.deepEqual(
    result.manualDue.map((entry) => entry.id),
    ["quote-one"],
  )
})

test("les liens d’action ouvrent directement la partie utile du dossier", () => {
  const result = build({
    messages: [
      {
        id: "question-focus",
        company_id: "company-one",
        quote_id: "quote-one",
        author: "client",
        kind: "question",
        created_at: "2026-10-05T10:00:00Z",
      },
    ],
  })
  assert.equal(result.actions[0].to, "/app/quotes/quote-one?focus=conversation")
  assert.equal(build().actions[0].to, "/app/quotes/quote-one?focus=followups")
})

test("un service indisponible ou inconnu ne promet pas un envoi automatique", () => {
  for (const serviceReady of [false, null]) {
    const result = build({ automations: [automation], serviceReady })
    assert.equal(result.scheduled.length, 0)
    assert.equal(result.manualDue.length, 0)
    assert.equal(result.actions[0].kind, "automation_paused")
  }
  assert.equal(
    build({ automations: [automation], serviceReady: true }).scheduled.length,
    1,
  )
})

test("un délai personnel inaccessible ne devient pas une relance à préparer", () => {
  const result = build({ preferencesUnavailable: true })
  assert.equal(result.followupsKnown, false)
  assert.equal(result.manualDue.length, 0)
  assert.equal(
    result.actions.some((action) => action.kind === "followup"),
    false,
  )
})

test("le suivi accepté n’invente pas d’intervention lorsque sa lecture est inconnue", () => {
  const quotes = [quote("quote-one", { status: "accepted" })]
  assert.equal(build({ quotes, workOrdersRead: "unavailable" }).actions.length, 0)
  const known = build({ quotes, workOrders: [], workOrdersRead: "available" })
  assert.equal(known.actions[0].kind, "work")
  assert.equal(known.actions[0].to, "/app/quotes/quote-one?focus=work")
})

test("une intervention future est un rappel utilisateur et une intervention terminée est close", () => {
  const quotes = [quote("quote-one", { status: "accepted" })]
  const work = {
    quote_id: "quote-one",
    company_id: "company-one",
    status: "scheduled" as const,
    scheduled_for: "2026-10-08",
    created_at: "2026-10-04T10:00:00Z",
    updated_at: "2026-10-04T10:00:00Z",
  }
  const planned = build({ quotes, workOrdersRead: "available", workOrders: [work] })
  assert.equal(planned.actions.length, 0)
  assert.equal(planned.scheduled[0].automatic, false)
  assert.equal(planned.scheduled[0].kind, "work")
  const completed = build({
    quotes,
    workOrdersRead: "available",
    workOrders: [{ ...work, status: "completed" }],
  })
  assert.equal(completed.actions.length, 0)
  assert.equal(completed.scheduled.length, 0)
  const other = build({
    quotes,
    workOrdersRead: "available",
    workOrders: [{ ...work, company_id: "company-other" }],
  })
  assert.equal(other.actions[0].title, "Planifier l’intervention")
})
