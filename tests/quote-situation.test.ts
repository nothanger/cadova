import assert from "node:assert/strict"
import test from "node:test"
import type {
  WorkspaceContext,
  WorkspaceQuote,
} from "../src/features/dashboard/workspaceActions"
import {
  resolveQuoteSituation,
  quoteSituationLink,
} from "../src/features/quotes/situation"

const now = new Date("2026-10-08T12:00:00")
const quote: WorkspaceQuote = {
  id: "quote-one",
  company_id: "company-one",
  client_id: "client-one",
  reference: "DEV-1",
  amount_cents: 120000,
  status: "sent",
  sent_at: "2026-10-01",
  notes: null,
  next_followup_at: null,
  expires_at: null,
  created_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-01T08:00:00Z",
  client: { id: "client-one", name: "Client", email: "client@example.test" },
}
const base: WorkspaceContext = {
  companyId: quote.company_id,
  quotes: [quote],
  automations: [],
  messages: [],
  events: [],
  deliveries: [],
  sendJobs: [],
  replyTo: "contact@example.test",
  companyPaused: false,
  serviceReady: true,
  workOrders: [],
  workOrdersRead: "available",
  clientRead: "available",
  reads: {
    automation: "available",
    messages: "available",
    events: "available",
    deliveries: "available",
    settings: "available",
    sendJobs: "available",
  },
}
const automatic = {
  quote_id: quote.id,
  company_id: quote.company_id,
  enabled: true,
  paused: false,
  next_send_at: "2026-10-10T07:00:00Z",
  stop_reason: null,
}
function resolve(
  overrides: Partial<WorkspaceContext> = {},
  row: WorkspaceQuote = quote,
  delay = 3,
) {
  const context = { ...base, ...overrides, quotes: overrides.quotes ?? [row] }
  return resolveQuoteSituation(row, context, delay, now)
}

test("le même devis ancien est à préparer manuellement ou déjà suivi automatiquement selon le contexte", () => {
  assert.equal(resolve().kind, "followup")
  const active = resolve({ automations: [automatic] })
  assert.equal(active.kind, "automatic")
  assert.equal(active.automatic, true)
  assert.equal(active.attention, false)
  assert.equal(active.date, automatic.next_send_at)
  assert.equal(
    quoteSituationLink(quote.id, active),
    "/app/quotes/quote-one?focus=followups",
  )
})
test("la date choisie manuellement prime sur l’ancienneté et ne prétend pas envoyer un email", () => {
  const scheduled = resolve({}, { ...quote, next_followup_at: "2026-10-12" })
  assert.equal(scheduled.kind, "manual_scheduled")
  assert.equal(scheduled.automatic, false)
  assert.equal(scheduled.attention, false)
  assert.match(scheduled.detail, /n’envoie aucun email/)
})
test("le délai personnel s’applique à la projection de liste et de fiche", () => {
  assert.equal(resolve({}, quote, 14).kind, "awaiting")
  assert.equal(resolve({}, quote, 5).kind, "followup")
})
test("compléter les coordonnées ouvre directement le bon client", () => {
  const row = { ...quote, client: { ...quote.client!, email: null } }
  const situation = resolve({}, row)
  assert.equal(situation.kind, "missing_email")
  assert.equal(quoteSituationLink(row.id, situation), "/app/clients/client-one/edit")
})
test("une question client prend la priorité et mène directement aux échanges", () => {
  const situation = resolve({
    automations: [automatic],
    messages: [
      {
        id: "question",
        company_id: quote.company_id,
        quote_id: quote.id,
        author: "client",
        kind: "question",
        created_at: "2026-10-08T09:00:00Z",
      },
    ],
  })
  assert.equal(situation.kind, "question")
  assert.equal(situation.target, "conversation")
  assert.equal(situation.attention, true)
  assert.equal(situation.automatic, false)
})
test("une question déjà répondue ne réclame plus une deuxième réponse", () => {
  const situation = resolve({
    automations: [automatic],
    messages: [
      {
        id: "q",
        company_id: quote.company_id,
        quote_id: quote.id,
        author: "client",
        kind: "question",
        created_at: "2026-10-08T09:00:00Z",
      },
      {
        id: "r",
        company_id: quote.company_id,
        quote_id: quote.id,
        author: "company",
        kind: "message",
        created_at: "2026-10-08T10:00:00Z",
      },
    ],
  })
  assert.notEqual(situation.kind, "question")
})
test("un résultat d’envoi incertain reste prioritaire même pour un brouillon", () => {
  const situation = resolve(
    {
      sendJobs: [
        {
          company_id: quote.company_id,
          quote_id: quote.id,
          status: "delivery_unknown",
          created_at: now.toISOString(),
        },
      ],
    },
    { ...quote, status: "draft", sent_at: null },
  )
  assert.equal(situation.kind, "delivery")
  assert.equal(situation.target, "document")
  assert.notEqual(situation.label, "Préparer l’envoi")
})
test("une livraison rejetée appelle une vérification, sans proposer une relance normale", () => {
  const situation = resolve({
    deliveries: [
      {
        id: "delivery",
        company_id: quote.company_id,
        quote_id: quote.id,
        status: "bounced",
        last_event_at: now.toISOString(),
        created_at: now.toISOString(),
      },
    ],
  })
  assert.equal(situation.kind, "delivery")
  assert.equal(situation.tone, "danger")
})
test("un résultat de relance incertain mène au suivi automatique, pas à l’envoi initial", () => {
  const situation = resolve({
    automations: [
      {
        ...automatic,
        enabled: false,
        next_send_at: null,
        stop_reason: "delivery_unknown",
      },
    ],
  })
  assert.equal(situation.kind, "delivery")
  assert.equal(situation.target, "followups")
})
test("une réponse enregistrée mène à la décision plutôt qu’à une nouvelle relance", () => {
  const situation = resolve({
    events: [
      {
        company_id: quote.company_id,
        quote_id: quote.id,
        event_type: "response",
        occurred_at: now.toISOString(),
      },
    ],
  })
  assert.equal(situation.kind, "response")
  assert.equal(situation.target, "history")
})
test("la fin des deux relances invite à faire le point", () => {
  const situation = resolve({
    automations: [
      { ...automatic, enabled: false, next_send_at: null, stop_reason: "completed" },
    ],
  })
  assert.equal(situation.kind, "review")
  assert.equal(situation.automatic, false)
})
test("la pause du devis ou de l’entreprise ne redevient pas une relance manuelle", () => {
  for (const context of [
    { automations: [{ ...automatic, paused: true }] },
    { automations: [automatic], companyPaused: true },
  ]) {
    assert.equal(resolve(context).kind, "automation_paused")
    assert.equal(resolve(context).automatic, false)
  }
})
test("le service désactivé ou non vérifié ne donne jamais Cadova s’en charge", () => {
  for (const serviceReady of [false, null, undefined]) {
    const situation = resolve({ automations: [automatic], serviceReady })
    assert.equal(situation.automatic, false)
    assert.equal(
      situation.kind,
      serviceReady === undefined ? "unknown" : "automation_paused",
    )
    if (serviceReady !== false) assert.equal(situation.complete, false)
    if (serviceReady === false) assert.match(situation.detail, /indisponible/)
  }
})
test("une lecture manquante ne signifie ni sans réponse ni à relancer", () => {
  for (const source of [
    "automation",
    "messages",
    "events",
    "deliveries",
    "settings",
    "sendJobs",
  ] as const) {
    const situation = resolve({ reads: { ...base.reads, [source]: "unavailable" } })
    assert.equal(situation.kind, "unknown", source)
    assert.equal(situation.complete, false)
    assert.equal(situation.attention, false)
  }
  assert.equal(resolve({ clientRead: "unavailable" }).kind, "unknown")
  assert.equal(resolve({ preferencesUnavailable: true }).kind, "unknown")
})
test("le client enrichi du contexte est utilisé quand la fiche ne joint que son nom", () => {
  const row = { ...quote, client: { id: "client-one", name: "Client" } }
  assert.equal(
    resolveQuoteSituation(row, { ...base, automations: [automatic] }, 3, now).kind,
    "automatic",
  )
})
test("un brouillon propose l’envoi et ne propose pas de relance", () => {
  const situation = resolve({}, { ...quote, status: "draft", sent_at: null })
  assert.equal(situation.kind, "draft")
  assert.equal(situation.target, "document")
  assert.equal(situation.automatic, false)
})
test("un devis expiré ne suggère plus une relance automatique", () => {
  const situation = resolve(
    { automations: [automatic] },
    { ...quote, expires_at: "2026-10-07" },
  )
  assert.equal(situation.kind, "expired")
  assert.equal(situation.automatic, false)
})
test("un accord conduit à l’intervention connue et sa fin clôt la prochaine action", () => {
  const row = { ...quote, status: "accepted" as const }
  assert.equal(resolve({}, row).kind, "accepted")
  assert.equal(resolve({}, row).attention, true)
  const work = {
    quote_id: quote.id,
    company_id: quote.company_id,
    status: "scheduled" as const,
    scheduled_for: "2026-10-12",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }
  assert.equal(resolve({ workOrders: [work] }, row).kind, "work_scheduled")
  assert.equal(resolve({ workOrders: [work] }, row).attention, false)
  assert.equal(
    resolve({ workOrders: [{ ...work, status: "in_progress" }] }, row).kind,
    "work_in_progress",
  )
  assert.equal(
    resolve({ workOrders: [{ ...work, status: "completed" }] }, row).attention,
    false,
  )
  assert.equal(
    resolve({ workOrdersRead: "unavailable" }, row).label,
    "Voir l’intervention",
  )
})
test("un refus garde l’historique sans demander d’action commerciale", () => {
  const situation = resolve({}, { ...quote, status: "refused" })
  assert.equal(situation.kind, "refused")
  assert.equal(situation.attention, false)
})
test("aucune situation issue d’une autre entreprise n’est utilisée", () => {
  assert.equal(resolve({ companyId: "other-company" }).kind, "unknown")
  const situation = resolve({
    messages: [
      {
        id: "foreign",
        company_id: "other-company",
        quote_id: quote.id,
        author: "client",
        kind: "question",
        created_at: now.toISOString(),
      },
    ],
    automations: [{ ...automatic, company_id: "other-company" }],
  })
  assert.equal(situation.kind, "followup")
})
