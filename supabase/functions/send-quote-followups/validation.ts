const emailPattern =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/

export function isEmailAddress(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    !value.includes("..") &&
    !value.startsWith(".") &&
    !value.includes(".@") &&
    emailPattern.test(value)
  )
}

export function isEmailSender(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 320 || /[\x00-\x1f\x7f]/.test(value))
    return false
  const match = /^([^<>]+) <([^<>]+)>$/.exec(value)
  return (
    isEmailAddress(value) ||
    Boolean(match && match[1].trim() && isEmailAddress(match[2]))
  )
}

/** An absent secret never authorizes a request. No substring/token fallback. */
export function hasSchedulerAuthorization(
  request: Request,
  secret: string | undefined,
) {
  if (!secret || secret.length < 32 || secret.length > 512 || /\s/.test(secret))
    return false
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get("Authorization") ?? "")
  if (!match || match[1].length > 512) return false
  const actual = new TextEncoder().encode(match[1])
  const expected = new TextEncoder().encode(secret)
  let different = actual.length ^ expected.length
  for (let index = 0; index < Math.max(actual.length, expected.length); index++) {
    different |= (actual[index] ?? 0) ^ (expected[index] ?? 0)
  }
  return different === 0
}

export type SchedulerAuthorization =
  { kind: "private" } | { kind: "signed"; nonce: string; issuedAt: number }

/** Queue-visible credentials contain a one-use proof, never the signing key. */
export async function verifySchedulerAuthorization(
  request: Request,
  secret: string | undefined,
  now: number,
): Promise<SchedulerAuthorization | null> {
  if (hasSchedulerAuthorization(request, secret)) return { kind: "private" }
  if (!secret || secret.length < 32 || secret.length > 512 || /\s/.test(secret))
    return null
  const match =
    /^Bearer cadova-v1:([0-9]{10}):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([0-9a-f]{64})$/.exec(
      request.headers.get("Authorization") ?? "",
    )
  if (!match) return null
  const issuedAt = Number(match[1])
  const currentSecond = Math.floor(now / 1000)
  if (
    !Number.isFinite(currentSecond) ||
    issuedAt < currentSecond - 300 ||
    issuedAt > currentSecond + 30
  )
    return null
  try {
    const bytes = new TextEncoder()
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      bytes.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    )
    const signature = new Uint8Array(
      match[3].match(/../g)!.map((value) => Number.parseInt(value, 16)),
    )
    // WebCrypto performs the MAC comparison; there is no string-prefix match.
    const valid = await globalThis.crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      bytes.encode(`run:${match[1]}:${match[2]}`),
    )
    return valid ? { kind: "signed", nonce: match[2], issuedAt } : null
  } catch {
    return null
  }
}

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  )
}

export function publicHttpsUrl(value: string | undefined): string | null {
  if (!value || /[\r\n\x00]/.test(value)) return null
  try {
    const url = new URL(value)
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null
    return url.href.replace(/\/$/, "")
  } catch {
    return null
  }
}
