export const maxWebhookBytes = 65536
export const maxReceivedEmailBytes = 262144
export type DeliveryStatus = "accepted" | "delayed" | "delivered" | "bounced" | "failed" | "complained"

const eventStatuses: Record<string, DeliveryStatus> = {
  "email.sent": "accepted",
  "email.delivery_delayed": "delayed",
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.failed": "failed",
  "email.complained": "complained",
}

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function validProviderId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(value)
}

export function validReceiveDomain(value: unknown): value is string {
  return typeof value === "string" && value.length <= 253 &&
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)
}

export function mailbox(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 320 || /[\r\n\u0000-\u001f\u007f]/.test(value)) return null
  const trimmed = value.trim()
  const candidate = /[<>]/.test(trimmed) ? /^[^<>]*<([^<>]+)>$/.exec(trimmed)?.[1] : trimmed
  const match = typeof candidate === "string" ? /^([A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,63})$/.exec(candidate) : null
  const email = match?.[1].toLowerCase()
  return email && email.length <= 254 && email.split("@")[0].length <= 64 && !email.includes("..") && !email.startsWith(".") && !email.includes(".@") ? email : null
}

export async function limitedBytes(body: ReadableStream<Uint8Array> | null, limit: number, signal?: AbortSignal) {
  if (!body) return new Uint8Array()
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  let rejectAbort: (reason: Error) => void = () => {}
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject })
  const onAbort = () => {
    void reader.cancel().catch(() => {})
    rejectAbort(new Error("Body aborted"))
  }
  signal?.addEventListener("abort", onAbort, { once: true })
  try {
    if (signal?.aborted) onAbort()
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), aborted])
      if (done) break
      size += value.byteLength
      if (size > limit) {
        void reader.cancel().catch(() => {})
        throw new Error("Body limit exceeded")
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return bytes
  } finally {
    signal?.removeEventListener("abort", onAbort)
    reader.releaseLock()
  }
}

export async function verifyWebhookSignature(raw: Uint8Array, headers: Headers, secret: string, now: number) {
  const id = headers.get("svix-id")
  const timestamp = headers.get("svix-timestamp")
  const signatures = headers.get("svix-signature")
  if (!id || !/^[A-Za-z0-9_-]{1,200}$/.test(id) || !timestamp || !/^\d{10}$/.test(timestamp) || !signatures || signatures.length > 2048 ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 || !/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret)) return false
  try {
    const key = await crypto.subtle.importKey("raw", Uint8Array.from(atob(secret.slice(6)), c => c.charCodeAt(0)), { name: "HMAC", hash: "SHA-256" }, false, ["verify"])
    const prefix = new TextEncoder().encode(`${id}.${timestamp}.`)
    const signed = new Uint8Array(prefix.length + raw.length)
    signed.set(prefix); signed.set(raw, prefix.length)
    for (const entry of signatures.trim().split(/\s+/)) {
      const match = /^v1,([A-Za-z0-9+/]+={0,2})$/.exec(entry)
      if (!match) continue
      const signature = Uint8Array.from(atob(match[1]), c => c.charCodeAt(0))
      if (signature.length === 32 && await crypto.subtle.verify("HMAC", key, signature, signed)) return true
    }
  } catch { /* Malformed signature and unavailable crypto fail closed. */ }
  return false
}

export interface ResendEvent {
  type: string
  occurredAt: string
  emailId: string
  status?: DeliveryStatus
  from?: string
  to?: string[]
}

export function parseEvent(value: unknown): ResendEvent | null {
  if (!record(value) || typeof value.type !== "string" || value.type.length > 80 || !record(value.data)) return null
  const status = eventStatuses[value.type]
  if (!status && value.type !== "email.received") return { type: value.type, occurredAt: "", emailId: "" }
  const createdAt = value.created_at ?? value.data.created_at
  if (!validProviderId(value.data.email_id) || typeof createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(createdAt) || !Number.isFinite(Date.parse(createdAt))) return null
  const occurredAt = new Date(createdAt).toISOString()
  if (value.type !== "email.received") return { type: value.type, emailId: value.data.email_id, occurredAt, status }
  const from = mailbox(value.data.from)
  const recipients = Array.isArray(value.data.to) && value.data.to.length <= 20 ? value.data.to.map(mailbox) : []
  if (!from || !recipients.length || recipients.some(item => !item)) return null
  return { type: value.type, emailId: value.data.email_id, occurredAt, from, to: recipients as string[] }
}

export function plainContent(value: unknown, html = false) {
  if (typeof value !== "string") return ""
  let text = value.slice(0, maxReceivedEmailBytes)
  if (html) text = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "").replace(/<\/?(?:p|div|br|li|h[1-6])\b[^>]*>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&(nbsp|amp|lt|gt|quot|apos);/g, (_, entity: string) => ({ nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[entity] ?? "")
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "").replace(/\r\n?/g, "\n").trim().slice(0, 4000)
}

export function safeReplyHeaders(value: unknown) {
  const headers: Record<string, string> = {}
  if (!record(value)) return headers
  for (const [name, entry] of Object.entries(value)) {
    const lower = name.toLowerCase()
    if (!["message-id", "in-reply-to", "references"].includes(lower) || typeof entry !== "string") continue
    headers[lower] = entry.slice(0, 2000).replace(/[\u0000-\u001f\u007f]/g, "")
  }
  return headers
}
