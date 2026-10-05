export const maxPdfBytes = 10 * 1024 * 1024
export const idempotencyWindowMs = 23 * 60 * 60 * 1000
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    !value.includes("..") &&
    !value.startsWith(".") &&
    !value.includes(".@") &&
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(
      value,
    )
  )
}

export function isSender(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 320 || /[\x00-\x1f\x7f]/.test(value))
    return false
  const match = /^([^<>]+) <([^<>]+)>$/.exec(value)
  return isEmail(value) || Boolean(match && match[1].trim() && isEmail(match[2]))
}

export function bearerToken(request: Request): string | null {
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get("Authorization") ?? "")
  return match && match[1].length <= 8192 ? match[1] : null
}

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  )
}

export async function readLimitedBytes(
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (signal?.aborted) throw new Error("Content read aborted")
  if (!stream) return new Uint8Array()
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  let abort: (() => void) | undefined
  const aborted = signal
    ? new Promise<never>((_, reject) => {
        abort = () => {
          // Do not await cancellation: a broken upstream may never acknowledge it.
          void reader.cancel().catch(() => {})
          reject(new Error("Content read aborted"))
        }
        signal.addEventListener("abort", abort, { once: true })
        if (signal.aborted) abort()
      })
    : undefined
  try {
    while (true) {
      const reading = reader.read()
      const { done, value } = await (aborted
        ? Promise.race([reading, aborted])
        : reading)
      if (signal?.aborted) throw new Error("Content read aborted")
      if (done) break
      size += value.byteLength
      if (size > limit) throw new Error("Content exceeds limit")
      chunks.push(value)
    }
  } catch (error) {
    void reader.cancel().catch(() => {})
    throw error
  } finally {
    if (signal && abort) signal.removeEventListener("abort", abort)
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export function validPdf(bytes: Uint8Array, mimeType: unknown) {
  return (
    typeof mimeType === "string" &&
    mimeType.split(";")[0].trim().toLowerCase() === "application/pdf" &&
    bytes.length >= 5 &&
    bytes.length <= maxPdfBytes &&
    bytes[0] === 37 &&
    bytes[1] === 80 &&
    bytes[2] === 68 &&
    bytes[3] === 70 &&
    bytes[4] === 45
  )
}

export function validFilename(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 4 &&
    value.length <= 160 &&
    /\.pdf$/i.test(value) &&
    !/[\x00-\x1f\x7f/\\]/.test(value)
  )
}

export function validStoragePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 300 &&
    /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/i.test(value) &&
    value
      .slice(0, -4)
      .split("/")
      .every((part) => uuidPattern.test(part))
  )
}

export function encodeBase64(bytes: Uint8Array) {
  const parts: string[] = []
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)))
  }
  return btoa(parts.join(""))
}

export function validBase64Pdf(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > Math.ceil(maxPdfBytes / 3) * 4 ||
    value.length < 8 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    return false
  try {
    const decoded = atob(value)
    return (
      decoded.length <= maxPdfBytes &&
      decoded.startsWith("%PDF-") &&
      btoa(decoded) === value
    )
  } catch {
    return false
  }
}

export async function sha256(bytes: Uint8Array) {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(bytes).buffer,
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")
}

export async function verifyCleanupProof(
  request: Request,
  secret: string | undefined,
  now: number,
) {
  if (!secret || secret.length < 32 || secret.length > 512 || /\s/.test(secret))
    return null
  const match =
    /^Bearer cadova-documents-v1:([0-9]{10}):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([0-9a-f]{64})$/.exec(
      request.headers.get("Authorization") ?? "",
    )
  if (!match) return null
  const issuedAt = Number(match[1])
  const second = Math.floor(now / 1000)
  if (!Number.isFinite(second) || issuedAt < second - 300 || issuedAt > second + 30)
    return null
  try {
    const encoder = new TextEncoder()
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    )
    const mac = new Uint8Array(
      match[3].match(/../g)!.map((byte) => Number.parseInt(byte, 16)),
    )
    const valid = await globalThis.crypto.subtle.verify(
      "HMAC",
      key,
      mac,
      encoder.encode(`quote-documents-cleanup:${match[1]}:${match[2]}`),
    )
    return valid ? { nonce: match[2], issuedAt } : null
  } catch {
    return null
  }
}
