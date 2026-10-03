export const STORY_DURATION = 24

export const storyChapters = [
  {
    label: "Client",
    title: "Le dossier client",
    detail: "Coordonnées et notes",
    start: 0,
  },
  {
    label: "Devis",
    title: "Le devis envoyé",
    detail: "En attente de réponse",
    start: 6,
  },
  {
    label: "Relance",
    title: "La relance à préparer",
    detail: "Message à personnaliser",
    start: 12,
  },
  {
    label: "Dossier",
    title: "Le dossier complet",
    detail: "Client, devis et historique",
    start: 18,
  },
] as const

export function chapterAt(time: number) {
  return Math.min(storyChapters.length - 1, Math.floor(time / 6))
}
