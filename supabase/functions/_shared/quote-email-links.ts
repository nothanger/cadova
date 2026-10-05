export type QuoteSendKind = "initial" | "followup"
export interface QuoteSendLease {
  id: string
  lease_token?: string
}
export interface QuoteEmailLinks {
  portalUrl: string
  replyTo?: string
}
export type QuoteLinkRpc = <T>(
  name: string,
  args: Record<string, unknown>,
) => Promise<T>

const tokenPattern = /^[A-Za-z0-9_-]{43}$/
const publicOrigins = new Set(["https://cadova.fr", "https://www.cadova.fr"])

/** Email links always use the product's trusted public origin, never request input. */
export function quotePublicUrl(value: string | undefined): string | null {
  if (value !== undefined && (value !== value.trim() || /[\x00-\x20\x7f]/.test(value)))
    return null
  try {
    const url = new URL(value ?? "https://www.cadova.fr")
    return publicOrigins.has(url.origin) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
      ? url.origin
      : null
  } catch {
    return null
  }
}

export function validQuotePortalUrl(value: unknown): value is string {
  if (typeof value !== "string" || /[\x00-\x20\x7f]/.test(value)) return false
  try {
    const url = new URL(value)
    return (
      publicOrigins.has(url.origin) &&
      !url.username &&
      !url.password &&
      url.pathname === "/devis/suivi" &&
      !url.search &&
      tokenPattern.test(url.hash.replace(/^#token=/, "")) &&
      url.hash.startsWith("#token=")
    )
  } catch {
    return false
  }
}

export function receiveDomain(value: string | undefined): string | null {
  if (
    !value ||
    value.length > 190 ||
    value !== value.trim() ||
    !/^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(value)
  )
    return null
  const domain = value.toLowerCase()
  // Receiving must be explicitly enabled on a Cadova-owned, verified domain.
  return domain === "cadova.fr" || domain.endsWith(".cadova.fr") ? domain : null
}

export function portalTextSuffix(url: string) {
  return `\n\nConsulter mon devis : ${url}\n\nConsultez le PDF, posez une question ou indiquez votre décision.`
}

export function validFrozenQuoteText(body: string, text: string, html: string) {
  if (text === body) return true // Already attempted payloads keep their original bytes.
  const prefix = `${body}\n\nConsulter mon devis : `
  if (!text.startsWith(prefix)) return false
  const url = text.slice(prefix.length).split("\n", 1)[0]
  return (
    validQuotePortalUrl(url) &&
    text === body + portalTextSuffix(url) &&
    html.includes(`href="${url}"`)
  )
}

export function validFrozenReply(value: string, original: string) {
  if (value === original) return true
  const match = /^q-[a-f0-9]{48}@(.+)$/.exec(value)
  return Boolean(match && receiveDomain(match[1]) === match[1])
}

export function portalHtml(url: string, escape: (value: string) => string) {
  return `<div style="margin-top:28px;border-top:1px solid #e3e5ec;padding-top:24px"><a href="${escape(url)}" style="display:inline-block;background:#5146db;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">Consulter mon devis</a><p style="font-size:14px;line-height:1.5;color:#596176">Consultez le PDF, posez une question ou indiquez votre décision.</p></div>`
}

/** Deterministic per-job token: retries never create a new provider payload. */
export async function prepareQuoteEmailLinks(
  rpc: QuoteLinkRpc,
  signingKey: string,
  kind: QuoteSendKind,
  job: QuoteSendLease,
  publicUrl: string,
  replyDomain?: string,
): Promise<QuoteEmailLinks> {
  if (
    quotePublicUrl(publicUrl) !== publicUrl ||
    !job.lease_token ||
    signingKey.length < 32
  )
    throw new Error("Quote email links are unavailable")
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signingKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`cadova-quote-portal:v1:${kind}:${job.id}`),
    ),
  )
  const token = btoa(String.fromCharCode(...signature))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(token)),
  )
  const tokenHash = Array.from(digest, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")
  const linked = await rpc<{ token_hash: string; expires_at: string }>(
    "issue_quote_client_send_link",
    {
      p_kind: kind,
      p_job_id: job.id,
      p_lease_token: job.lease_token,
      p_token_hash: tokenHash,
      p_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    },
  )
  if (
    !linked ||
    linked.token_hash !== tokenHash ||
    !Number.isFinite(Date.parse(linked.expires_at)) ||
    Date.parse(linked.expires_at) <= Date.now()
  )
    throw new Error("Quote email links are unavailable")
  let replyTo: string | undefined
  if (replyDomain) {
    if (receiveDomain(replyDomain) !== replyDomain)
      throw new Error("Reply routing is unavailable")
    const routed = await rpc<string | null>("ensure_quote_send_reply_address", {
      p_kind: kind,
      p_job_id: job.id,
      p_lease_token: job.lease_token,
      p_domain: replyDomain,
    })
    if (
      routed !== null &&
      (typeof routed !== "string" ||
        !new RegExp(`^q-[a-f0-9]{48}@${replyDomain.replace(/\./g, "\\.")}$`).test(
          routed,
        ))
    )
      throw new Error("Reply routing is unavailable")
    replyTo = routed ?? undefined
  }
  return {
    portalUrl: `${publicUrl}/devis/suivi#token=${token}`,
    ...(replyTo ? { replyTo } : {}),
  }
}
