import assert from "node:assert/strict"
import test from "node:test"
import {
  extractQuoteFields,
  parseDocumentAmount,
} from "../src/features/quotes/import/extractQuoteFields"
import { quotePageText, type PdfTextItem } from "../src/features/quotes/import/pdfText"

test("un devis français extrait le TTC, la référence et le seul contact client", () => {
  const result = extractQuoteFields(`Entreprise de plomberie
contact@plombier.example
Devis n° DEV-2026-001
Date : 04/10/2026
Client :
Ethan Noto
Email : client@example.test
Téléphone : 06 12 34 56 78
Objet : remplacement chaudière
Total HT : 1 000,00 €
TVA : 200,00 €
Total TTC : 1 200,00 €
Acompte TTC : 360,00 €
Valable jusqu’au 04/11/2026
Conditions : paiement à réception
contact@plombier.example`)
  assert.deepEqual(result.fields, {
    reference: "DEV-2026-001",
    amount: "1200.00",
    clientName: "Ethan Noto",
    clientEmail: "client@example.test",
    clientPhone: "06 12 34 56 78",
    expiresAt: "2026-11-04",
  })
  assert.equal(result.warnings.length, 0)
})

test("les montants français et internationaux gardent exactement leurs centimes", () => {
  for (const value of [
    "1 250,50 €",
    "1\u202f250,50 EUR",
    "1.250,50",
    "1,250.50",
    "1250.50",
    "€ 1250,50",
  ])
    assert.equal(parseDocumentAmount(value), "1250.50", value)
  assert.equal(parseDocumentAmount("0,00"), "0.00")
  assert.equal(parseDocumentAmount("1250"), "1250.00")
})

test("un téléphone, un pourcentage ou une date ne devient jamais un montant", () => {
  for (const value of [
    "06 12 34 56 78",
    "+33 6 12 34 56 78",
    "04/10/2026",
    "20 %",
    "1.234",
    "1,2,3",
    "-150,00",
    "150 CHF",
    "$150",
    "Total 150 euros",
    "9999999999",
  ])
    assert.equal(parseDocumentAmount(value), undefined, value)
})

test("le montant HT et l’acompte ne remplacent pas un total TTC absent", () => {
  const result = extractQuoteFields(
    "Devis DEV-123\nTotal HT : 1500,00 €\nAcompte TTC : 450,00 €\nNet à payer : 1050,00 €",
  )
  assert.equal(result.fields.amount, undefined)
  assert.ok(result.warnings.some((warning) => warning.includes("total TTC")))
})

test("les totaux contradictoires restent à compléter", () => {
  const result = extractQuoteFields("Total TTC : 1200,00 €\nTotal TTC : 1400,00 €")
  assert.equal(result.fields.amount, undefined)
  assert.ok(result.warnings.some((warning) => warning.includes("Plusieurs totaux")))
})

test("un total répété en pied de page conserve la même valeur", () => {
  const result = extractQuoteFields(
    "Total TTC : 1200,00 €\nPage 2\nTotal TTC : 1 200,00 EUR",
  )
  assert.equal(result.fields.amount, "1200.00")
})

test("une valeur séparée de son libellé TTC est lue sans englober l’acompte suivant", () => {
  assert.equal(
    extractQuoteFields("Total T.T.C.\n2 050,49 €\nAcompte 30 % : 615,15 €").fields
      .amount,
    "2050.49",
  )
  assert.equal(
    extractQuoteFields("Total TTC\nAcompte : 615,15 €").fields.amount,
    undefined,
  )
})

test("un artisan exonéré de TVA peut avoir un total sans libellé TTC", () => {
  assert.equal(
    extractQuoteFields("Total : 850,00 €\nTVA non applicable, art. 293 B du CGI").fields
      .amount,
    "850.00",
  )
  assert.equal(extractQuoteFields("Total : 850,00 €").fields.amount, undefined)
})

test("l’email émetteur sans bloc client n’est jamais proposé au destinataire", () => {
  const result = extractQuoteFields(
    "Artisan Noto\nEmail : contact@artisan.example\nDevis D-456\nTotal TTC : 100,00 €",
  )
  assert.equal(result.fields.clientEmail, undefined)
  assert.equal(result.fields.clientName, undefined)
})

test("la signature et le pied de page ne complètent pas un bloc client sans email", () => {
  const result = extractQuoteFields(
    "Client : Claire Martin\n12 rue Victor Hugo\n75001 Paris\nObjet : travaux\nSignature\ncontact@artisan.example",
  )
  assert.equal(result.fields.clientName, "Claire Martin")
  assert.equal(result.fields.clientEmail, undefined)
})

test("plusieurs emails ou plusieurs clients exigent une confirmation manuelle", () => {
  for (const text of [
    "Client : Martin\ncontact@martin.example\ncompta@martin.example\nObjet : devis",
    "Client : Martin\ncontact@martin.example\nObjet : devis\nClient : Dupont\ncontact@dupont.example",
  ])
    assert.equal(extractQuoteFields(text).fields.clientEmail, undefined)
})

test("une adresse email ne devient pas un nom de client", () => {
  const result = extractQuoteFields("Destinataire : client@example.test\nObjet : devis")
  assert.equal(result.fields.clientEmail, "client@example.test")
  assert.equal(result.fields.clientName, undefined)
})

test("la date du document et la durée de validité ne créent aucune date d’envoi", () => {
  const result = extractQuoteFields(
    "Devis DEV-987\nDate : 04/10/2026\nValidité : 30 jours\nTotal TTC : 500,00 €",
  )
  assert.equal(result.fields.expiresAt, undefined)
  assert.equal("sentAt" in result.fields, false)
  assert.equal("sent_at" in result.fields, false)
})

test("les dates impossibles et les validités contradictoires ne sont pas devinées", () => {
  assert.equal(
    extractQuoteFields("Valable jusqu’au 31/02/2026").fields.expiresAt,
    undefined,
  )
  assert.equal(
    extractQuoteFields("Validité : 04/11/2026\nValidité : 05/11/2026").fields.expiresAt,
    undefined,
  )
})

test("les références contradictoires ou une date à la place d’une référence restent vides", () => {
  assert.equal(extractQuoteFields("Devis : 04/10/2026").fields.reference, undefined)
  assert.equal(
    extractQuoteFields("Devis DEV-123\nRéférence du devis : DEV-456").fields.reference,
    undefined,
  )
})

test("un scan sans texte produit une aide à la saisie manuelle", () => {
  const result = extractQuoteFields("")
  assert.deepEqual(result.fields, {})
  assert.ok(result.warnings.some((warning) => warning.includes("manuellement")))
})

function item(str: string, x: number, y: number): PdfTextItem {
  return { str, transform: [12, 0, 0, 12, x, y], width: str.length * 6, height: 12 }
}

test("les colonnes client et fournisseur d’un PDF gardent leurs propres coordonnées", () => {
  for (const [clientX, issuerX] of [
    [40, 340],
    [340, 40],
  ]) {
    const text = quotePageText(
      [
        item("Devis DEV-345", 40, 800),
        item("Client :", clientX, 720),
        item("Fournisseur :", issuerX, 720),
        item("Claire Martin", clientX, 702),
        item("Artisan Dupont", issuerX, 702),
        item("client@example.test", clientX, 684),
        item("contact@artisan.example", issuerX, 684),
        item("Total HT :", 340, 450),
        item("1000,00 €", 490, 450),
        item("TVA :", 340, 432),
        item("200,00 €", 490, 432),
        item("Total TTC :", 340, 414),
        item("1200,00 €", 490, 414),
        item("Acompte TTC :", 340, 396),
        item("360,00 €", 490, 396),
      ],
      595,
    )
    assert.deepEqual(extractQuoteFields(text).fields, {
      reference: "DEV-345",
      amount: "1200.00",
      clientName: "Claire Martin",
      clientEmail: "client@example.test",
    })
  }
})

test("un client sans email ne récupère pas l’email de la colonne fournisseur", () => {
  for (const [clientX, issuerX] of [
    [40, 240],
    [40, 280],
    [40, 310],
    [340, 40],
  ]) {
    const text = quotePageText(
      [
        item("Client :", clientX, 720),
        item("Entreprise :", issuerX, 720),
        item("Claire Martin", clientX, 702),
        item("Artisan Dupont", issuerX, 702),
        item("12 rue des Fleurs", clientX, 684),
        item("contact@artisan.example", issuerX, 684),
      ],
      595,
    )
    assert.equal(extractQuoteFields(text).fields.clientEmail, undefined)
  }
})

test("un bloc commercial séparé ne complète pas les coordonnées client", () => {
  const result = extractQuoteFields(
    "Client : Claire Martin\n12 rue des Fleurs\nVotre contact :\ncontact@artisan.example",
  )
  assert.equal(result.fields.clientName, "Claire Martin")
  assert.equal(result.fields.clientEmail, undefined)
})
