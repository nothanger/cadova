import { supabase } from "@/lib/supabase"
import { getClient } from "@/features/clients/api"
import {
  getCompanyEmailSettings,
  getFollowupServiceStatus,
} from "@/features/company/contactApi"
import type { Quote, QuoteWithClient } from "@/types"

const BUCKET = "quote-documents"
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

export interface QuoteDocument {
  id: string
  company_id: string
  quote_id: string
  storage_path: string
  file_name: string
  size_bytes: number
  created_at: string
}

export type InitialSendStatus =
  "preparing" | "processing" | "sent" | "failed" | "delivery_unknown" | "cancelled"

export interface InitialSendJob {
  id: string
  quote_id: string
  status: InitialSendStatus
  recipient_email: string
  subject: string
  body: string
  attempts: number
  first_attempt_at: string | null
  sent_at: string | null
  provider_message_id: string | null
  last_error_code: string | null
  created_at: string
}

export interface ImportedQuoteInput {
  clientId: string | null
  newClient: { name: string; email?: string | null; phone?: string | null } | null
  reference: string
  amountCents: number
  notes: string
  alreadySent: boolean
  sentAt: string | null
  expiresAt: string | null
  document: File | null
}

export interface InitialSendInput {
  recipientEmail: string
  subject: string
  message: string
  retry?: boolean
}

export interface InitialSendResult {
  state: InitialSendStatus
  job?: InitialSendJob
  error?: string
}

export class DocumentApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = "DocumentApiError"
  }
}

const sendErrors: Record<string, string> = {
  send_in_progress: "Un envoi de ce devis est déjà en cours. Actualisez son état.",
  reply_address_missing:
    "Ajoutez une adresse de réponse dans les paramètres de l’entreprise.",
  delivery_unknown:
    "Le résultat de cet envoi reste à vérifier. Actualisez son état avant de reprendre le même envoi.",
  provider_domain_not_verified:
    "Le domaine d’envoi doit être validé dans Resend. Contactez l’administrateur.",
  provider_restricted_key:
    "La clé du service email n’autorise pas cet expéditeur. Contactez l’administrateur.",
  provider_suspended_key:
    "Le service email a suspendu cette clé. Contactez l’administrateur.",
  provider_authentication_failed:
    "Le service email a refusé l’expéditeur. L’administrateur doit vérifier sa configuration.",
  provider_sender_not_allowed:
    "Cette adresse d’envoi n’est pas autorisée par le service email.",
  provider_rate_limited:
    "Le service email est momentanément sollicité. Réessayez dans quelques instants.",
  provider_quota_exceeded:
    "La limite d’envoi du service email est atteinte. Contactez l’administrateur.",
  provider_rejected:
    "Le service email a refusé le message. Vérifiez le destinataire et les informations d’envoi.",
  email_configuration_missing: "Le service d’envoi n’est pas encore configuré.",
  service_disabled: "Le service d’envoi est désactivé.",
  unauthorized: "Votre session a expiré. Reconnectez-vous avant de réessayer.",
  forbidden: "Vous n’avez pas accès à ce devis.",
  invalid_request: "Vérifiez l’adresse du destinataire, l’objet et le message.",
  document_invalid: "Le document ne peut pas être envoyé. Ajoutez un PDF valide.",
  document_missing: "Ajoutez le document original avant d’envoyer le devis.",
  document_too_large: "Le document doit peser moins de 10 Mo.",
  invalid_document: "Le PDF n’a pas pu être validé. Vérifiez le document original.",
  document_unavailable:
    "Le PDF n’a pas pu être chargé. Actualisez le devis avant de réessayer.",
  send_snapshot_changed:
    "Les informations du devis ont changé. Actualisez le devis avant de réessayer.",
  send_not_allowed:
    "Cet envoi n’est pas autorisé. Vérifiez le document, l’adresse de réponse et le statut du devis.",
  send_unavailable:
    "Le service d’envoi est momentanément indisponible. Actualisez son état avant de réessayer.",
  authentication_unavailable:
    "Votre session n’a pas pu être vérifiée. Réessayez dans quelques instants.",
  reply_to_missing:
    "Ajoutez une adresse de réponse dans les paramètres de l’entreprise.",
  already_sent: "Ce devis a déjà été envoyé. Actualisez son état.",
  in_progress: "Un envoi de ce devis est déjà en cours. Actualisez son état.",
  idempotency_window_expired:
    "Le résultat de cet envoi doit être vérifié dans l’historique du service email avant toute nouvelle action.",
}

export function documentError(error: unknown, fallback: string) {
  return error instanceof DocumentApiError ? error.message : fallback
}

export function initialSendError(code: string | null | undefined) {
  return (
    (code && sendErrors[code]) ||
    "L’envoi n’a pas abouti. Consultez son état avant de réessayer."
  )
}

function fail(error: { code?: string; message?: string }, fallback: string): never {
  if (error.code === "23505")
    throw new DocumentApiError(
      "Cette référence existe déjà dans votre entreprise. Ouvrez le devis existant ou choisissez une autre référence.",
      error.code,
    )
  if (
    error.code &&
    ["42501", "23514", "22023", "P0002", "55000"].includes(error.code) &&
    error.message
  )
    throw new DocumentApiError(error.message, error.code)
  throw new DocumentApiError(fallback, error.code)
}

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Opération annulée", "AbortError")
}

async function uploadDocument(companyId: string, file: File, signal?: AbortSignal) {
  checkAbort(signal)
  if (!file.size || file.size > MAX_DOCUMENT_BYTES)
    throw new DocumentApiError("Le PDF doit peser moins de 10 Mo.")
  if ((await file.slice(0, 5).text()) !== "%PDF-")
    throw new DocumentApiError("Choisissez un PDF valide pour le document du devis.")
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user)
    throw new DocumentApiError("Reconnectez-vous pour enregistrer le document.")
  checkAbort(signal)
  const id = crypto.randomUUID()
  const path = `${companyId}/${auth.user.id}/${id}.pdf`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: "application/pdf",
    cacheControl: "0",
    upsert: false,
  })
  if (error) fail(error, "Le document n’a pas pu être enregistré. Réessayez.")
  const metadata = {
    id,
    storage_path: path,
    file_name:
      (Array.from(file.name, (character) =>
        character.charCodeAt(0) < 32 ||
        character.charCodeAt(0) === 127 ||
        character === "/" ||
        character === "\\"
          ? " "
          : character,
      )
        .join("")
        .trim()
        .slice(0, 156)
        .replace(/\.pdf$/i, "") || "devis") + ".pdf",
    size_bytes: file.size,
  }
  if (signal?.aborted) {
    await removeUnattachedDocument(path)
    checkAbort(signal)
  }
  return metadata
}

async function removeUnattachedDocument(path: string) {
  // Browser deletion is denied to avoid a race with attachment. The private
  // cleanup worker removes abandoned uploads after 24 hours.
  try {
    await supabase.storage.from(BUCKET).remove([path])
  } catch {
    /* server cleanup covers abandoned uploads */
  }
}

export async function saveImportedQuote(
  companyId: string,
  input: ImportedQuoteInput,
  options: { signal?: AbortSignal } = {},
): Promise<Quote> {
  const { signal } = options
  checkAbort(signal)
  const quoteId = crypto.randomUUID()
  const document = input.document
    ? await uploadDocument(companyId, input.document, signal)
    : null
  try {
    checkAbort(signal)
    const request = supabase.rpc("save_imported_quote", {
      p_quote_id: quoteId,
      p_company_id: companyId,
      p_client_id: input.clientId,
      p_new_client: input.newClient,
      p_reference: input.reference.trim(),
      p_amount_cents: input.amountCents,
      p_notes: input.notes.trim() || null,
      p_already_sent: input.alreadySent,
      p_sent_at: input.alreadySent ? input.sentAt : null,
      p_expires_at: input.expiresAt || null,
      p_document: document,
    })
    const { data, error } = await (signal ? request.abortSignal(signal) : request)
    if (error) {
      // Only a definite database rejection proves that the transaction rolled back.
      if (
        error.code &&
        /^[0-9A-Z]{5}$/.test(error.code) &&
        !error.code.startsWith("08")
      ) {
        if (document) await removeUnattachedDocument(document.storage_path)
        fail(error, "Le devis n’a pas pu être enregistré.")
      }
      throw new DocumentApiError(
        "L’enregistrement n’a pas pu être confirmé. Actualisez la liste des devis avant de réessayer.",
        "creation_unknown",
      )
    }
    if (!data || typeof data.id !== "string")
      throw new DocumentApiError(
        "L’enregistrement n’a pas pu être confirmé. Actualisez la liste des devis avant de réessayer.",
        "creation_unknown",
      )
    return data as Quote
  } catch (error) {
    if (error instanceof DocumentApiError && error.code !== "creation_unknown")
      throw error
    // The server may have committed before the connection disappeared.
    try {
      const { data, error: readError } = await supabase
        .from("quotes")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", quoteId)
        .maybeSingle()
      if (!readError && data) return data as Quote
    } catch {
      /* preserve the file for reconciliation if the network is unavailable */
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      if (document) await removeUnattachedDocument(document.storage_path)
      throw error
    }
    throw new DocumentApiError(
      "L’enregistrement n’a pas pu être confirmé. Actualisez la liste des devis avant de réessayer.",
      "creation_unknown",
    )
  }
}

export async function getQuoteDocument(quoteId: string): Promise<QuoteDocument | null> {
  const { data, error } = await supabase
    .from("quote_documents")
    .select("id,company_id,quote_id,storage_path,file_name,size_bytes,created_at")
    .eq("quote_id", quoteId)
    .maybeSingle()
  if (error) fail(error, "Impossible de charger le document de ce devis.")
  return data as QuoteDocument | null
}

export async function getInitialSendJob(
  quoteId: string,
): Promise<InitialSendJob | null> {
  const { data, error } = await supabase
    .from("quote_initial_send_jobs")
    .select(
      "id,quote_id,status,recipient_email,subject,body,attempts,first_attempt_at,sent_at,provider_message_id,last_error_code,created_at",
    )
    .eq("quote_id", quoteId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
  if (error) fail(error, "Impossible de vérifier l’état de l’envoi.")
  return (data?.[0] ?? null) as InitialSendJob | null
}

export async function attachQuoteDocument(
  quote: Quote,
  file: File,
): Promise<QuoteDocument> {
  const document = await uploadDocument(quote.company_id, file)
  const { data, error } = await supabase.rpc("attach_quote_document", {
    p_quote_id: quote.id,
    p_document: document,
  })
  if (error) {
    if (error.code && /^[0-9A-Z]{5}$/.test(error.code) && !error.code.startsWith("08"))
      await removeUnattachedDocument(document.storage_path)
    fail(error, "L’ajout du document n’a pas pu être confirmé. Actualisez le devis.")
  }
  if (!data || typeof data.id !== "string")
    throw new DocumentApiError(
      "L’ajout du document n’a pas pu être confirmé. Actualisez le devis.",
    )
  return data as QuoteDocument
}

export async function downloadQuoteDocument(document: QuoteDocument): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(document.storage_path)
  if (error || !data)
    throw new DocumentApiError("Impossible de télécharger le document.")
  return data
}

export async function loadDocumentContext(quote: QuoteWithClient) {
  const [document, job, client, settings, service] = await Promise.all([
    getQuoteDocument(quote.id),
    getInitialSendJob(quote.id),
    getClient(quote.client_id),
    getCompanyEmailSettings(quote.company_id),
    getFollowupServiceStatus(),
  ])
  return { document, job, client, settings, service }
}

export async function sendQuoteDocument(
  quoteId: string,
  input: InitialSendInput,
): Promise<InitialSendResult> {
  const { data, error } = await supabase.functions.invoke("send-quote-document", {
    body: {
      action: "send",
      quoteId,
      recipientEmail: input.recipientEmail.trim(),
      subject: input.subject.trim(),
      message: input.message.trim(),
      retry: input.retry === true,
    },
  })
  if (error) {
    const context = "context" in error ? error.context : null
    if (context instanceof Response) {
      try {
        const detail = (await context.clone().json()) as {
          error?: string
          message?: string
        }
        if (detail.error && sendErrors[detail.error])
          throw new DocumentApiError(sendErrors[detail.error], detail.error)
      } catch (detailError) {
        if (detailError instanceof DocumentApiError) throw detailError
      }
    }
    throw new DocumentApiError(
      "L’envoi n’a pas pu être confirmé. Actualisez son état avant de réessayer.",
      "send_unknown",
    )
  }
  if (
    !data ||
    ![
      "preparing",
      "processing",
      "sent",
      "failed",
      "delivery_unknown",
      "cancelled",
    ].includes(data.state)
  )
    throw new DocumentApiError(
      "L’envoi n’a pas pu être confirmé. Actualisez son état avant de réessayer.",
      "send_unknown",
    )
  return data as InitialSendResult
}
