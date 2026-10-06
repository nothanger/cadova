import assert from "node:assert/strict"
import { test } from "node:test"
import {
  appendTimelineSources,
  emptyTimelineSources,
  formatTimelineDate,
  mergeQuoteTimeline,
  type TimelineJob,
  type TimelineSources,
} from "../src/features/quotes/timeline/merge.ts"
import type { QuoteEvent, QuoteWithClient } from "../src/types/index.ts"

const quote: QuoteWithClient = {
  id: "quote-a",
  company_id: "company-a",
  client_id: "client-a",
  reference: "D-001",
  amount_cents: 12000,
  status: "sent",
  sent_at: "2026-10-01",
  notes: null,
  client: { id: "client-a", name: "Client" },
  created_at: "2026-09-30T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
}
const event = (id: string, overrides: Partial<QuoteEvent> = {}): QuoteEvent => ({
  id,
  company_id: quote.company_id,
  quote_id: quote.id,
  event_type: "note",
  content: "Note privée",
  occurred_at: "2026-10-04T13:15:00Z",
  created_by: "member-a",
  ...overrides,
})
const job = (overrides: Partial<TimelineJob> = {}): TimelineJob => ({
  id: "job-a",
  company_id: quote.company_id,
  quote_id: quote.id,
  status: "sent",
  body: "Message envoyé intégral",
  sent_at: "2026-10-02T12:00:00Z",
  created_at: "2026-10-02T11:59:00Z",
  updated_at: "2026-10-02T12:00:00Z",
  ...overrides,
})
const rows = (overrides: Partial<TimelineSources> = {}) => ({
  ...emptyTimelineSources(),
  ...overrides,
})

test("a client question and its linked event appear once with client attribution", () => {
  const timeline = mergeQuoteTimeline(
    quote,
    rows({
      events: [
        event("portal-event", {
          event_type: "response",
          portal_message_id: "question-a",
          content: "Quelle date est possible ?",
        }),
      ],
      messages: [
        {
          id: "question-a",
          company_id: quote.company_id,
          quote_id: quote.id,
          author: "client",
          kind: "question",
          content: "Quelle date est possible ?",
          created_at: "2026-10-04T13:15:00Z",
        },
      ],
    }),
  )
  assert.equal(
    timeline.filter((row) => row.content === "Quelle date est possible ?").length,
    1,
  )
  assert.equal(timeline[0].title, "Question du client")
  assert.equal(timeline[0].category, "messages")
})

test("company replies and client decisions missing an event remain in the dossier", () => {
  const timeline = mergeQuoteTimeline(
    quote,
    rows({
      messages: [
        {
          id: "reply-a",
          company_id: quote.company_id,
          quote_id: quote.id,
          author: "company",
          kind: "message",
          content: "Nous pouvons venir mardi.",
          created_at: "2026-10-05T13:15:00Z",
        },
        {
          id: "accept-a",
          company_id: quote.company_id,
          quote_id: quote.id,
          author: "client",
          kind: "accepted",
          content: "Le client a indiqué accepter le devis.",
          created_at: "2026-10-06T13:15:00Z",
        },
      ],
    }),
  )
  assert.equal(timeline[0].title, "Devis accepté par le client")
  assert.equal(timeline[1].title, "Votre réponse au client")
})

test("full private email replies and all independent notes are retained", () => {
  const privateReply = "Réponse privée complète : " + "x".repeat(3600)
  const timeline = mergeQuoteTimeline(
    quote,
    rows({
      events: [
        event("private-email", {
          event_type: "response",
          email_reply_id: "reply-a",
          content: privateReply,
        }),
        event("note-one"),
        event("note-two"),
      ],
    }),
  )
  assert.equal(
    timeline.find((row) => row.id === "event:private-email")?.content,
    privateReply,
  )
  assert.equal(timeline.filter((row) => row.title === "Note interne").length, 2)
})

test("sent events, their send jobs, and provider acceptance do not become three sends", () => {
  const timeline = mergeQuoteTimeline(
    quote,
    rows({
      events: [
        event("sent-a", {
          event_type: "sent",
          initial_send_job_id: "job-a",
          content: "Message envoyé intégral",
        }),
      ],
      initialJobs: [job()],
      deliveries: [
        {
          id: "delivery-a",
          company_id: quote.company_id,
          quote_id: quote.id,
          initial_send_job_id: "job-a",
          automation_job_id: null,
          provider_message_id: "provider-a",
          status: "accepted",
          created_at: "2026-10-02T12:00:00Z",
          last_event_at: "2026-10-02T12:00:00Z",
        },
      ],
    }),
  )
  assert.equal(timeline.length, 1)
  assert.match(timeline[0].title, /remis au service email/)
  assert.match(timeline[0].detail ?? "", /ne confirme pas sa lecture/)
})

test("delivery progress retains the historical delay and deduplicates latest confirmation", () => {
  const timeline = mergeQuoteTimeline(
    quote,
    rows({
      events: [
        event("delay-a", {
          email_delivery_id: "delivery-a",
          content: "Le serveur du destinataire retarde la livraison de cet email.",
          occurred_at: "2026-10-02T12:30:00Z",
        }),
        event("delivered-a", {
          email_delivery_id: "delivery-a",
          content:
            "Le serveur du destinataire a accepté cet email. Sa lecture n’est pas confirmée.",
          occurred_at: "2026-10-02T13:30:00Z",
        }),
      ],
      deliveries: [
        {
          id: "delivery-a",
          company_id: quote.company_id,
          quote_id: quote.id,
          initial_send_job_id: "job-a",
          automation_job_id: null,
          provider_message_id: "provider-a",
          status: "delivered",
          created_at: "2026-10-02T12:00:00Z",
          last_event_at: "2026-10-02T13:30:00Z",
        },
      ],
    }),
  )
  assert.equal(timeline.filter((row) => row.title === "Email livré").length, 1)
  assert.equal(timeline.filter((row) => row.title === "Livraison retardée").length, 1)
})

test("a missing sent event is recovered from a genuine job, without counting queued sends", () => {
  const timeline = mergeQuoteTimeline(
    quote,
    rows({ followupJobs: [job(), job({ id: "future-job", status: "queued" })] }),
  )
  assert.equal(
    timeline.filter(
      (row) => row.title === "Relance automatique remise au service email",
    ).length,
    1,
  )
  assert.equal(
    timeline.some((row) => row.id.includes("future-job")),
    false,
  )
})

test("an ambiguous send remains to verify and never claims delivery", () => {
  const timeline = mergeQuoteTimeline(
    { ...quote, sent_at: null },
    rows({ initialJobs: [job({ status: "delivery_unknown", sent_at: null })] }),
  )
  assert.equal(timeline.length, 1)
  assert.equal(timeline[0].tone, "warning")
  assert.match(timeline[0].title, /à vérifier/)
  assert.equal(timeline[0].title.includes("livré"), false)
})

test("sorting uses timestamps, deterministic ID ties, and ignores invalid timestamps", () => {
  const timeline = mergeQuoteTimeline(
    { ...quote, sent_at: null },
    rows({
      events: [
        event("older", { occurred_at: "2026-10-04T09:00:00Z" }),
        event("z", { occurred_at: "2026-10-04T10:00:00Z" }),
        event("a", { occurred_at: "2026-10-04T10:00:00Z" }),
        event("invalid", { occurred_at: "broken" }),
      ],
    }),
  )
  assert.deepEqual(
    timeline.map((row) => row.id),
    ["event:a", "event:z", "event:older"],
  )
})

test("the merge rejects other companies and other quotes in every source", () => {
  const foreign = { company_id: "other-company" }
  const timeline = mergeQuoteTimeline(
    { ...quote, sent_at: null },
    rows({
      events: [
        event("cross-company", foreign),
        event("cross-quote", { quote_id: "other-quote" }),
      ],
      messages: [
        {
          id: "foreign-message",
          quote_id: quote.id,
          ...foreign,
          author: "client",
          kind: "question",
          content: "Do not show",
          created_at: "2026-10-04T13:15:00Z",
        },
      ],
      documents: [
        {
          id: "foreign-doc",
          quote_id: quote.id,
          ...foreign,
          file_name: "secret.pdf",
          created_at: "2026-10-04T13:15:00Z",
        },
      ],
      initialJobs: [job({ ...foreign })],
      followupJobs: [job({ quote_id: "other-quote" })],
      deliveries: [
        {
          id: "foreign-delivery",
          ...foreign,
          quote_id: quote.id,
          initial_send_job_id: "job-a",
          automation_job_id: null,
          provider_message_id: "provider-a",
          status: "delivered",
          created_at: "2026-10-02T12:00:00Z",
          last_event_at: "2026-10-02T12:00:00Z",
        },
      ],
    }),
  )
  assert.deepEqual(timeline, [])
})

test("calendar dates display without fabricated hours; timestamp dates include time", () => {
  assert.match(formatTimelineDate("2026-10-04"), /4 oct|04 oct/)
  assert.equal(formatTimelineDate("2026-10-04").includes(":"), false)
  assert.match(formatTimelineDate("2026-10-04T13:15:00Z"), /\d{2}:15/)
  assert.equal(formatTimelineDate("broken"), "Date indisponible")
})

test("current accepted status alone never fabricates a client acceptance", () => {
  const timeline = mergeQuoteTimeline(
    { ...quote, status: "accepted", sent_at: null },
    rows(),
  )
  assert.deepEqual(timeline, [])
})

test("an email reply joins its public excerpt by reply ID, keeping the full private text and receipt date", () => {
  const fullText = "Réponse complète " + "x".repeat(3500)
  const received = "2026-10-03T09:00:00Z"
  const timeline = mergeQuoteTimeline(
    { ...quote, sent_at: null },
    rows({
      events: [
        event("email-response", {
          event_type: "response",
          email_reply_id: "email-reply-id",
          content: fullText,
        }),
      ],
      messages: [
        {
          id: "public-excerpt",
          company_id: quote.company_id,
          quote_id: quote.id,
          author: "client",
          kind: "question",
          content: fullText.slice(0, 2000),
          nonce: "email-reply-id",
          created_at: received,
        },
        {
          id: "independent-question",
          company_id: quote.company_id,
          quote_id: quote.id,
          author: "client",
          kind: "question",
          content: fullText.slice(0, 2000),
          nonce: "different-nonce",
          created_at: received,
        },
      ],
    }),
  )
  assert.equal(timeline.length, 2)
  const reply = timeline.find((item) => item.id === "event:email-response")!
  assert.equal(reply.title, "Réponse reçue par email")
  assert.equal(reply.content, fullText)
  assert.equal(reply.at, received)
  assert.equal(
    timeline.some((item) => item.id === "message:public-excerpt"),
    false,
  )
  assert.equal(
    timeline.some((item) => item.id === "message:independent-question"),
    true,
  )
})

test("a failed initial job never claims that the email service accepted it", () => {
  const timeline = mergeQuoteTimeline(
    { ...quote, sent_at: null },
    rows({
      events: [
        event("failure", {
          event_type: "followup_auto_failed",
          initial_send_job_id: "job-a",
          delivery_status: "failed",
          content: "L’envoi a échoué.",
        }),
      ],
      initialJobs: [job({ status: "failed", sent_at: null })],
    }),
  )
  assert.equal(timeline.length, 1)
  assert.equal(timeline[0].tone, "danger")
  assert.equal(timeline[0].detail, undefined)
  assert.equal(timeline[0].title.includes("remis"), false)
})

test("deduplicating a provider failure preserves its visible error state", () => {
  const timeline = mergeQuoteTimeline(
    { ...quote, sent_at: null },
    rows({
      events: [
        event("provider-failure", {
          email_delivery_id: "delivery-a",
          content: "Le service d’envoi n’a pas pu livrer cet email.",
        }),
      ],
      deliveries: [
        {
          id: "delivery-a",
          company_id: quote.company_id,
          quote_id: quote.id,
          initial_send_job_id: "job-a",
          automation_job_id: null,
          provider_message_id: "provider-a",
          status: "failed",
          created_at: "2026-10-02T12:00:00Z",
          last_event_at: "2026-10-04T13:15:00Z",
        },
      ],
    }),
  )
  assert.equal(timeline.length, 1)
  assert.equal(timeline[0].title, "Échec de livraison")
  assert.equal(timeline[0].tone, "danger")
})

test("an invalid timestamp on a linked event cannot hide a valid client message or send", () => {
  const timeline = mergeQuoteTimeline(
    { ...quote, sent_at: null },
    rows({
      events: [
        event("invalid-send", {
          event_type: "sent",
          occurred_at: "broken",
          initial_send_job_id: "job-a",
        }),
        event("invalid-question", {
          event_type: "response",
          occurred_at: "broken",
          portal_message_id: "question-a",
        }),
      ],
      initialJobs: [job()],
      messages: [
        {
          id: "question-a",
          company_id: quote.company_id,
          quote_id: quote.id,
          author: "client",
          kind: "question",
          content: "Question conservée",
          created_at: "2026-10-04T13:15:00Z",
        },
      ],
    }),
  )
  assert.equal(timeline.length, 2)
  assert.equal(
    timeline.some((row) => row.title === "Devis remis au service email"),
    true,
  )
  assert.equal(
    timeline.some((row) => row.content === "Question conservée"),
    true,
  )
})

test("paginated overlap keeps notes once and replaces updated delivery state", () => {
  const first = rows({ events: [event("note-a")] })
  const next = rows({ events: [event("note-a"), event("note-b")] })
  assert.equal(appendTimelineSources(first, next).events.length, 2)
  const corrected = appendTimelineSources(
    first,
    rows({ events: [event("note-a", { content: "Corrected" })] }),
  )
  assert.equal(corrected.events[0].content, "Corrected")
})
