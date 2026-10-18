export type PortalResponseKind = "question" | "accepted" | "refused"

export function portalResponseBody(
  token: string,
  kind: PortalResponseKind,
  message: string,
  nonce: string,
) {
  const content = message.trim()
  return {
    action: "respond" as const,
    token,
    kind,
    ...(content ? { message: content } : {}),
    nonce,
    confirmed: true as const,
  }
}
