// Keep the movement durations; each reading pause lasts about one second.
export const STORY_DURATION = 15.4

export const storyChapters = [
  {
    label: "Client",
    title: "Le dossier du client",
    detail: "Coordonnées et notes",
    start: 0,
  },
  {
    label: "Devis",
    title: "Le devis envoyé",
    detail: "En attente de réponse",
    start: 4,
  },
  {
    label: "Relance",
    title: "La prochaine relance",
    detail: "Un message à adapter",
    start: 7.5,
  },
  {
    label: "Dossier",
    title: "Le suivi du dossier",
    detail: "Devis, notes et relances",
    start: 11,
  },
] as const

export function chapterAt(time: number) {
  return storyChapters.reduce(
    (current, chapter, index) => (time >= chapter.start ? index : current),
    0,
  )
}
