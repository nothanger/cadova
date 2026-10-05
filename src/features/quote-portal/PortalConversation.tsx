import type { PortalMessage } from "./api"

const date = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
})
const kinds = {
  question: "Question",
  accepted: "Décision : accepté",
  refused: "Décision : refusé",
  message: "Réponse",
}

export function PortalConversation({
  messages,
  companyName = "L’entreprise",
}: {
  messages: PortalMessage[]
  companyName?: string
}) {
  if (!messages.length)
    return <p className="text-sm leading-6 text-muted">Aucun échange pour le moment.</p>
  return (
    <ol aria-label="Échanges au sujet du devis" className="space-y-3">
      {messages.map((message) => (
        <li
          key={message.id}
          className={`min-w-0 rounded-lg border p-4 ${message.author === "company" ? "border-primary/15 bg-primary-soft/40" : "border-line bg-background"}`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="break-words text-sm font-medium text-ink">
              {message.author === "company" ? companyName : "Client"} ·{" "}
              {kinds[message.kind]}
            </p>
            <time dateTime={message.created_at} className="text-xs text-muted">
              {date.format(new Date(message.created_at))}
            </time>
          </div>
          {message.content && (
            <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-6 text-ink-soft">
              {message.content}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}
