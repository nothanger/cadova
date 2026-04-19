import type { LucideIcon } from "lucide-react";
import { FileText, MessageSquare, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";

export type ModuleSlug = "reussia" | "oralia";

export interface ModulePlan {
  name: string;
  priceMonthly: string;
  priceNote: string;
  summary: string;
  highlights: string[];
}

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
  plans: ModulePlan[];
}

export const cadovaModules: CadovaModule[] = [
  {
    slug: "reussia",
    name: "ReussIA",
    tagline: "Pour transformer un brouillon en candidature que tu oses envoyer.",
    shortDescription: "CV, lettre et analyse ATS pour poser une base propre sans repartir de zero.",
    fullDescription:
      "ReussIA t'aide quand tu sais qu'il faut envoyer quelque chose, mais que ton CV, ta lettre ou ton angle ne sont pas encore clairs. Tu construis une version propre, tu vois ce qui manque, puis tu ajustes avant d'appuyer sur envoyer.",
    targetAudience: [
      "Lyceens qui preparent un premier stage",
      "Etudiants qui doivent adapter leur dossier vite",
      "Jeunes diplomes qui veulent comprendre pourquoi leur CV bloque",
    ],
    features: [
      "CV guide selon ton niveau et ton secteur",
      "Lettre de motivation modifiable sans repartir de zero",
      "Analyse ATS avec les mots importants presents ou manquants",
      "Versions sauvegardees dans ton espace",
    ],
    useCases: [
      "Adapter ton CV a une offre sans y passer la soiree",
      "Ecrire une lettre quand tu ne sais pas par ou commencer",
      "Verifier ton dossier avant de l'envoyer",
    ],
    benefits: [
      "Tu gagnes une base claire au lieu d'une page blanche",
      "Tu comprends quoi corriger avant d'envoyer",
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
      { label: "ATS", value: "a verifier" },
      { label: "Lettre", value: "prete a ajuster" },
    ],
    plans: [
      {
        name: "Solo",
        priceMonthly: "4,99 EUR",
        priceNote: "par mois",
        summary: "Pour remettre ton dossier au propre sans payer pour le reste.",
        highlights: ["CV", "Lettre", "Analyse ATS", "Versions sauvegardees"],
      },
      {
        name: "Boost",
        priceMonthly: "7,99 EUR",
        priceNote: "par mois",
        summary: "Pour les periodes ou tu dois envoyer beaucoup de dossiers.",
        highlights: ["Plus de generations", "Plus d'analyses", "Ajustements frequents", "Exports facilites"],
      },
    ],
  },
  {
    slug: "oralia",
    name: "OralIA",
    tagline: "Pour arreter de decouvrir tes reponses le jour de l'entretien.",
    shortDescription: "Des simulations pour tester ta facon de repondre avant le vrai rendez-vous.",
    fullDescription:
      "OralIA t'aide a t'entrainer sans te sentir observe. Tu reponds a des questions proches du reel, tu vois ou tes phrases manquent de structure, puis tu recommences avec une idee plus nette de ce qu'il faut dire.",
    targetAudience: [
      "Candidats qui stressent a l'oral",
      "Etudiants qui veulent des reponses plus structurees",
      "Profils avec un entretien qui arrive vite",
    ],
    features: [
      "Simulation selon ton contexte",
      "Feedback question par question",
      "Score de session facile a comprendre",
      "Historique pour voir si tu progresses",
    ],
    useCases: [
      "Preparer un entretien d'alternance",
      "Rendre ta presentation plus fluide",
      "Reperer les reponses trop vagues avant le jour J",
    ],
    benefits: [
      "Tu arrives avec des idees deja formulees",
      "Tu sais ou tes reponses manquent de preuves",
      "Tu peux t'entrainer seul, meme a la derniere minute",
    ],
    icon: MessageSquare,
    accentColor: "#d946ef",
    hoverBackground: "rgba(217,70,239,0.05)",
    hoverBorder: "rgba(217,70,239,0.2)",
    route: "/modules/oralia",
    ctaLabel: "Preparer mon entretien",
    ctaHref: "/signup",
    previewTitle: "Entrainement",
    previewMetrics: [
      { label: "Questions", value: "realistes" },
      { label: "Feedback", value: "direct" },
      { label: "Point cle", value: "structure" },
    ],
    plans: [
      {
        name: "Solo",
        priceMonthly: "5,99 EUR",
        priceNote: "par mois",
        summary: "Pour t'entrainer avant les entretiens importants.",
        highlights: ["Simulations", "Feedback", "Scores", "Historique"],
      },
      {
        name: "Training",
        priceMonthly: "8,99 EUR",
        priceNote: "par mois",
        summary: "Pour enchainer les entrainements quand les rendez-vous arrivent.",
        highlights: ["Sessions intensives", "Mode pression", "Usage plus frequent", "Progression suivie"],
      },
    ],
  },
];

export const cadovaBundle = {
  name: "Cadova Complet",
  priceMonthly: "8,99 EUR",
  priceYearly: "89 EUR",
  note: "Dashboard, ReussIA et OralIA dans le meme espace",
  highlights: [
    "CV, lettres, analyse ATS et simulations d'entretien",
    "Un dashboard qui retrouve tes contenus sur ton compte",
    "Le plus simple pour une recherche active et suivie",
  ],
};

export const cadovaPlans = [
  {
    name: "Module unique",
    summary: "Tu prends seulement le coup de main dont tu as besoin maintenant.",
    bulletPoints: [
      "Un module choisi selon ton probleme du moment",
      "Bien pour un besoin ponctuel",
      "Prix plus bas pour commencer doucement",
    ],
  },
  {
    name: "Cadova Complet",
    summary: "Tu gardes tes documents, tes entretiens et tes progres au meme endroit.",
    bulletPoints: [
      "Dashboard, ReussIA et OralIA ensemble",
      "Moins de ruptures entre documents et preparation orale",
      "Plus confortable pour une recherche active",
    ],
  },
];

export const moduleHighlights = [
  {
    icon: ShieldCheck,
    title: "Sans jugement",
    text: "Tu peux arriver avec un brouillon, une urgence ou aucune methode. Le produit sert a remettre de l'ordre.",
  },
  {
    icon: Target,
    title: "Au bon moment",
    text: "Tu choisis selon ce qui bloque aujourd'hui: dossier, oral, suivi ou profil.",
  },
  {
    icon: Sparkles,
    title: "Lisible",
    text: "Les conseils restent courts et actionnables, pour ne pas rajouter du bruit a ta recherche.",
  },
  {
    icon: TrendingUp,
    title: "Progressif",
    text: "Chaque action nourrit ton espace: ce que tu as fait, ce qui reste, et la prochaine etape.",
  },
];

export function getModuleBySlug(slug: string | undefined) {
  return cadovaModules.find((module) => module.slug === slug);
}
