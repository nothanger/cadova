import type { LucideIcon } from "lucide-react";
import { FileText, MessageSquare, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";

export type ModuleSlug = "reussia" | "oralia";

export interface CadovaModule {
  slug: ModuleSlug;
  name: string;
  tagline: string;
  shortDescription: string;
  fullDescription: string;
  targetAudience: string[];
  features: string[];
  useCases: string[];
  benefits: string[];
  icon: LucideIcon;
  accentColor: string;
  hoverBackground: string;
  hoverBorder: string;
  route: string;
  ctaLabel: string;
  ctaHref: string;
  previewTitle: string;
  previewMetrics: { label: string; value: string }[];
}

export const cadovaModules: CadovaModule[] = [
  {
    slug: "reussia",
    name: "ReussIA",
    tagline: "Pour transformer un brouillon en candidature que tu oses envoyer.",
    shortDescription: "CV, lettre et analyse ATS pour poser une base propre sans repartir de zéro.",
    fullDescription:
      "ReussIA t’aide quand tu sais qu’il faut envoyer quelque chose, mais que ton CV, ta lettre ou ton angle ne sont pas encore clairs. Tu construis une version propre, tu vois ce qui manque, puis tu ajustes avant d’appuyer sur envoyer.",
    targetAudience: [
      "Lycéens qui préparent un premier stage",
      "Étudiants qui doivent adapter leur dossier vite",
      "Jeunes diplômés qui veulent comprendre pourquoi leur CV bloque",
    ],
    features: [
      "CV guidé selon ton niveau et ton secteur",
      "Lettre de motivation modifiable sans repartir de zéro",
      "Analyse ATS avec les mots importants présents ou manquants",
      "Versions sauvegardées dans ton espace",
    ],
    useCases: [
      "Adapter ton CV à une offre sans y passer la soirée",
      "Écrire une lettre quand tu ne sais pas par où commencer",
      "Vérifier ton dossier avant de l’envoyer",
    ],
    benefits: [
      "Tu gagnes une base claire au lieu d’une page blanche",
      "Tu comprends quoi corriger avant d’envoyer",
      "Tu gardes un rythme plus calme dans tes candidatures",
    ],
    icon: FileText,
    accentColor: "#5044f5",
    hoverBackground: "rgba(80,68,245,0.05)",
    hoverBorder: "rgba(80,68,245,0.2)",
    route: "/modules/reussia",
    ctaLabel: "Commencer par mon dossier",
    ctaHref: "/signup",
    previewTitle: "Avant envoi",
    previewMetrics: [
      { label: "CV", value: "plus clair" },
      { label: "ATS", value: "à vérifier" },
      { label: "Lettre", value: "prête à ajuster" },
    ],
  },
  {
    slug: "oralia",
    name: "OralIA",
    tagline: "Pour arrêter de découvrir tes réponses le jour de l’entretien.",
    shortDescription: "Des simulations pour tester ta façon de répondre avant le vrai rendez-vous.",
    fullDescription:
      "OralIA t’aide à t’entraîner sans te sentir observé. Tu réponds à des questions proches du réel, tu vois où tes phrases manquent de structure, puis tu recommences avec une idée plus nette de ce qu’il faut dire.",
    targetAudience: [
      "Candidats qui stressent à l’oral",
      "Étudiants qui veulent des réponses plus structurées",
      "Profils avec un entretien qui arrive vite",
    ],
    features: [
      "Simulation selon ton contexte",
      "Feedback question par question",
      "Score de session facile à comprendre",
      "Historique pour voir si tu progresses",
    ],
    useCases: [
      "Préparer un entretien d’alternance",
      "Rendre ta présentation plus fluide",
      "Repérer les réponses trop vagues avant le jour J",
    ],
    benefits: [
      "Tu arrives avec des idées déjà formulées",
      "Tu sais où tes réponses manquent de preuves",
      "Tu peux t’entraîner seul, même à la dernière minute",
    ],
    icon: MessageSquare,
    accentColor: "#d946ef",
    hoverBackground: "rgba(217,70,239,0.05)",
    hoverBorder: "rgba(217,70,239,0.2)",
    route: "/modules/oralia",
    ctaLabel: "Préparer mon entretien",
    ctaHref: "/signup",
    previewTitle: "Entraînement",
    previewMetrics: [
      { label: "Questions", value: "réalistes" },
      { label: "Feedback", value: "direct" },
      { label: "Point clé", value: "structure" },
    ],
  },
];

export const moduleHighlights = [
  {
    icon: ShieldCheck,
    title: "Sans jugement",
    text: "Tu peux arriver avec un brouillon, une urgence ou aucune méthode. Le produit sert à remettre de l’ordre.",
  },
  {
    icon: Target,
    title: "Au bon moment",
    text: "Tu choisis selon ce qui bloque aujourd’hui : dossier, oral, suivi ou profil.",
  },
  {
    icon: Sparkles,
    title: "Lisible",
    text: "Les conseils restent courts et actionnables, pour ne pas rajouter du bruit à ta recherche.",
  },
  {
    icon: TrendingUp,
    title: "Progressif",
    text: "Chaque action nourrit ton espace : ce que tu as fait, ce qui reste, et la prochaine étape.",
  },
];

export function getModuleBySlug(slug: string | undefined) {
  return cadovaModules.find((module) => module.slug === slug);
}
