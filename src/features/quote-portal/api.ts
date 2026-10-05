import { supabase } from "@/lib/supabase"
import type { QuoteStatus } from "@/types"

export interface PortalMessage {
  id: string
  author: "client" | "company"
  kind: "question" | "accepted" | "refused" | "message"
  content: string
  created_at: string
}
export interface PortalLink {
  id: string
  expires_at: string
  revoked_at: string | null
  created_at: string
}
export interface PortalInspection {
  link: PortalLink | null
  messages: PortalMessage[]
}
export interface PortalView {
  quote: {
    reference: string
    company_name: string
    company_email?: string | null
    client_name: string
    amount_cents: number
    status: Exclude<QuoteStatus, "draft">
    expires_at: string | null
    document_available: boolean
  }
  link_expires_at: string
  can_respond: boolean
  messages: PortalMessage[]
}

const errors: Record<string, string> = {
  invalid_request: "Vérifiez votre message et réessayez.",
  unauthorized: "Votre session a expiré. Reconnectez-vous pour continuer.",
  not_allowed: "Ce devis ne peut pas être partagé pour le moment.",
  link_unavailable:
    "Ce lien a expiré ou a été désactivé. Demandez un nouveau lien à l’entreprise.",
  rate_limited: "Veuillez patienter quelques instants avant de réessayer.",
  decision_not_allowed:
    "Ce devis a déjà reçu une décision ou n’est plus valable. Actualisez la page.",
  nonce_conflict: "Le message a changé. Actualisez la page avant de réessayer.",
  portal_unavailable:
    "Le suivi du devis est momentanément indisponible. Réessayez dans quelques instants.",
}
export class PortalApiError extends Error {
  constructor(readonly code: string) {
    super(errors[code] ?? "La connexion a été interrompue. Réessayez.")
    this.name = "PortalApiError"
  }
}
export function portalError(error: unknown) {
  return error instanceof PortalApiError
    ? error.message
    : "La connexion a été interrompue. Réessayez."
}

export function portalTokenFromHash(hash: string) {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("token") ?? ""
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : ""
}
export function portalShareUrl(token: string) {
  const url = new URL("/devis/suivi", window.location.origin)
  url.hash = new URLSearchParams({ token }).toString()
  return url.toString()
}

async function request(
  body: Record<string, unknown>,
  signal: AbortSignal,
  authenticated = false,
) {
  const projectUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "")
  if (!projectUrl) throw new PortalApiError("portal_unavailable")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  }
  if (authenticated) {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session?.access_token) throw new PortalApiError("unauthorized")
    headers.Authorization = `Bearer ${data.session.access_token}`
  }
  if (signal.aborted) throw new DOMException("Opération annulée", "AbortError")
  const response = await fetch(`${projectUrl}/functions/v1/quote-client-portal`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
    cache: "no-store",
    referrerPolicy: "no-referrer",
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new PortalApiError(
      typeof detail?.errorCode === "string" ? detail.errorCode : "portal_unavailable",
    )
  }
  return response
}

export async function inspectPortal(
  quoteId: string,
  signal: AbortSignal,
): Promise<PortalInspection> {
  return (await request({ action: "inspect", quoteId }, signal, true)).json()
}
export async function createPortal(
  quoteId: string,
  signal: AbortSignal,
): Promise<{ link: PortalLink; token: string }> {
  return (await request({ action: "create", quoteId }, signal, true)).json()
}
export async function revokePortal(
  quoteId: string,
  signal: AbortSignal,
): Promise<void> {
  await request({ action: "revoke", quoteId }, signal, true)
}
export async function replyToPortal(
  quoteId: string,
  message: string,
  nonce: string,
  signal: AbortSignal,
): Promise<PortalInspection> {
  return (
    await request({ action: "member_reply", quoteId, message, nonce }, signal, true)
  ).json()
}
export async function viewPortal(
  token: string,
  signal: AbortSignal,
): Promise<PortalView> {
  return (await request({ action: "view", token }, signal)).json()
}
export async function respondToPortal(
  token: string,
  kind: "question" | "accepted" | "refused",
  message: string,
  nonce: string,
  signal: AbortSignal,
): Promise<PortalView> {
  return (
    await request(
      { action: "respond", token, kind, message, nonce, confirmed: true },
      signal,
    )
  ).json()
}
export async function downloadPortalDocument(
  token: string,
  signal: AbortSignal,
): Promise<Blob> {
  return (await request({ action: "download", token }, signal)).blob()
}
