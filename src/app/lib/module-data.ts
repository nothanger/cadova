import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  FileText,
  Linkedin,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

export type ModuleSlug = "reussia" | "oralia" | "trackia" | "skillia";

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
    tagline: "CV, lettres et ATS sans repartir de zero a chaque candidature.",
    shortDescription: "Le bloc candidature qui te fait passer de l'idee au dossier pret a envoyer.",
    fullDescription:
      "ReussIA rassemble tout ce qui te sert avant l'envoi: creation de CV, lettres de motivation et lecture ATS. Le but n'est pas de produire plus, mais de produire plus juste, plus vite, et avec une vraie coherence entre les documents.",
    targetAudience: [
      "Etudiants qui cherchent un stage ou une alternance",
      "Jeunes diplomes qui doivent vite adapter leurs candidatures",
      "Profils qui veulent comprendre pourquoi leur CV ne convertit pas",
    ],
    features: [
      "Generateur de CV guide par secteur et niveau",
      "Lettre de motivation editable et sauvegardable",
      "Analyse ATS avec mots-cles presents et manquants",
      "Historique centralise dans le dashboard",
    ],
    useCases: [
      "Adapter un CV a une nouvelle offre en quelques minutes",
      "Produire une lettre solide sans page blanche",
      "Verifier la compatibilite d'un dossier avant envoi",
    ],
    benefits: [
      "Moins d'improvisation entre ton CV et ta lettre",
      "Plus de clarte sur ce qu'il faut corriger avant d'envoyer",
      "Une cadence de candidature plus stable sans perdre en qualite",
    ],
    icon: FileText,
    accentColor: "#5548f5",
    hoverBackground: "rgba(85,72,245,0.05)",
    hoverBorder: "rgba(85,72,245,0.2)",
    route: "/modules/reussia",
    ctaLabel: "Essayer ReussIA",
    ctaHref: "/signup",
    previewTitle: "Cycle candidature",
    previewMetrics: [
      { label: "CV genere", value: "1 document" },
      { label: "Score ATS", value: "86 / 100" },
      { label: "Lettre prete", value: "Oui" },
    ],
    plans: [
      {
        name: "Solo",
        priceMonthly: "4,99 EUR",
        priceNote: "par mois",
        summary: "Le bon point d'entree pour candidater proprement.",
        highlights: ["CV", "Lettre", "Analyse ATS", "Sauvegarde des versions"],
      },
      {
        name: "Boost",
        priceMonthly: "7,99 EUR",
        priceNote: "par mois",
        summary: "Pour les periodes ou tu candidatures beaucoup.",
        highlights: ["Plus de generations", "Plus d'analyses", "Usage intensif", "Priorite sur les exports"],
      },
    ],
  },
  {
    slug: "oralia",
    name: "OralIA",
    tagline: "Simulation d'entretien avec feedback utile, pas juste des questions qui s'enchainent.",
    shortDescription: "Le module qui te fait travailler les reponses avant le vrai rendez-vous.",
    fullDescription:
      "OralIA te met dans une logique de repetition concrete. Tu choisis un type d'entretien, tu reponds, tu vois ou tu manques de structure, et tu progresses session apres session avec un score lisible.",
    targetAudience: [
      "Candidats qui bloquent a l'oral malgre un bon dossier",
      "Etudiants qui veulent travailler leur methode STAR",
      "Profils qui preparent des entretiens repetes sur peu de temps",
    ],
    features: [
      "Simulation d'entretien par contexte",
      "Feedback question par question",
      "Score global de session",
      "Historique des sessions dans le dashboard",
    ],
    useCases: [
      "Se preparer avant une alternance en commerce ou marketing",
      "Travailler une presentation personnelle plus fluide",
      "Identifier les reponses trop vagues avant un vrai entretien",
    ],
    benefits: [
      "Tu arrives plus clair et moins dans l'improvisation",
      "Tu vois ce qui manque vraiment dans tes reponses",
      "Tu peux t'entrainer vite sans mobiliser quelqu'un en face",
    ],
    icon: MessageSquare,
    accentColor: "#d946ef",
    hoverBackground: "rgba(217,70,239,0.05)",
    hoverBorder: "rgba(217,70,239,0.2)",
    route: "/modules/oralia",
    ctaLabel: "Tester OralIA",
    ctaHref: "/signup",
    previewTitle: "Session type",
    previewMetrics: [
      { label: "Questions", value: "7" },
      { label: "Score final", value: "78 / 100" },
      { label: "Point cle", value: "Methode STAR" },
    ],
    plans: [
      {
        name: "Solo",
        priceMonthly: "5,99 EUR",
        priceNote: "par mois",
        summary: "Le module oral pour progresser avant chaque entretien.",
        highlights: ["Simulations", "Feedback", "Scores", "Historique des sessions"],
      },
      {
        name: "Training",
        priceMonthly: "8,99 EUR",
        priceNote: "par mois",
        summary: "Pour les periodes avec plusieurs entretiens a enchainer.",
        highlights: ["Sessions intensives", "Mode pression", "Usage plus frequent", "Progression suivie"],
      },
    ],
  },
  {
    slug: "trackia",
    name: "TrackIA",
    tagline: "Le suivi de candidatures qui evite de perdre le fil apres l'envoi.",
    shortDescription: "Le module de pilotage pour savoir ce qui a ete envoye, relance ou laisse en attente.",
    fullDescription:
      "TrackIA transforme les candidatures dispersees en pipeline simple. Tu ajoutes une entreprise, tu suis le statut, tu gardes une trace des relances, et ton dashboard commence a raconter ce qui bouge vraiment.",
    targetAudience: [
      "Profils qui envoient beaucoup de candidatures",
      "Etudiants qui relancent mal ou trop tard",
      "Jeunes diplomes qui veulent une vue claire sur leur pipeline",
    ],
    features: [
      "Ajout d'entreprises depuis la carte",
      "Statuts de candidature",
      "Vision centralisee dans le dashboard",
      "Suivi lisible sans tableur externe",
    ],
    useCases: [
      "Savoir qui relancer cette semaine",
      "Arreter d'oublier des candidatures envoyees il y a dix jours",
      "Garder une trace simple de ton volume d'envoi et de tes retours",
    ],
    benefits: [
      "Plus de clarte entre envoi, attente, entretien et refus",
      "Moins de perte de contexte d'une entreprise a l'autre",
      "Une vraie base de pilotage quand la recherche s'intensifie",
    ],
    icon: Briefcase,
    accentColor: "#14b8a6",
    hoverBackground: "rgba(20,184,166,0.05)",
    hoverBorder: "rgba(20,184,166,0.2)",
    route: "/modules/trackia",
    ctaLabel: "Decouvrir TrackIA",
    ctaHref: "/signup",
    previewTitle: "Suivi actuel",
    previewMetrics: [
      { label: "Candidatures actives", value: "12" },
      { label: "Relances a faire", value: "3" },
      { label: "Entretiens", value: "2" },
    ],
    plans: [
      {
        name: "Solo",
        priceMonthly: "3,99 EUR",
        priceNote: "par mois",
        summary: "Le socle de suivi pour garder le cap.",
        highlights: ["Pipeline simple", "Carte entreprises", "Statuts", "Vue dashboard"],
      },
      {
        name: "Pipeline+",
        priceMonthly: "6,99 EUR",
        priceNote: "par mois",
        summary: "Pour une recherche plus large et plus active.",
        highlights: ["Plus de suivi", "Plus d'ajouts", "Relances simplifiees", "Pilotage plus dense"],
      },
    ],
  },
  {
    slug: "skillia",
    name: "SkillIA",
    tagline: "LinkedIn et competences: ce que tu dois rendre visible et ce qu'il faut encore travailler.",
    shortDescription: "Le module qui renforce ton profil avant meme que le recruteur ouvre ton CV.",
    fullDescription:
      "SkillIA t'aide a clarifier ton positionnement: analyse de profil LinkedIn, suggestions de resume, competences a mettre en avant, et lecture rapide de ce qui manque pour le poste vise.",
    targetAudience: [
      "Candidats qui veulent un profil plus net sur LinkedIn",
      "Profils en reconversion ou repositionnement",
      "Etudiants qui ne savent pas quelles competences mettre en avant",
    ],
    features: [
      "Analyse de profil LinkedIn",
      "Resume suggere",
      "Competences recommandees",
      "Historique des analyses dans le dashboard",
    ],
    useCases: [
      "Revoir son profil avant une vague de candidatures",
      "Identifier les competences a afficher pour un metier cible",
      "Transformer un profil trop general en proposition plus lisible",
    ],
    benefits: [
      "Plus de coherence entre ton profil public et ton CV",
      "Des competences mieux choisies, donc plus credibles",
      "Un meilleur positionnement quand le recruteur te cherche ou te relit",
    ],
    icon: Linkedin,
    accentColor: "#2563eb",
    hoverBackground: "rgba(37,99,235,0.05)",
    hoverBorder: "rgba(37,99,235,0.2)",
    route: "/modules/skillia",
    ctaLabel: "Lancer SkillIA",
    ctaHref: "/signup",
    previewTitle: "Profil optimise",
    previewMetrics: [
      { label: "Score LinkedIn", value: "82 / 100" },
      { label: "Competences cibles", value: "5" },
      { label: "Resume suggere", value: "Pret" },
    ],
    plans: [
      {
        name: "Solo",
        priceMonthly: "4,99 EUR",
        priceNote: "par mois",
        summary: "Le module de positionnement pour ton profil public.",
        highlights: ["Analyse LinkedIn", "Resume suggere", "Competences", "Sauvegarde"],
      },
      {
        name: "Positioning",
        priceMonthly: "7,49 EUR",
        priceNote: "par mois",
        summary: "Pour retravailler plusieurs fois ton profil et ton cap.",
        highlights: ["Analyses plus frequentes", "Ajustements iteratifs", "Travail sur la cible", "Usage plus libre"],
      },
    ],
  },
];

export const cadovaBundle = {
  name: "Cadova Complet",
  priceMonthly: "14,99 EUR",
  priceYearly: "149 EUR",
  note: "les 4 modules dans le meme espace",
  highlights: [
    "ReussIA, OralIA, TrackIA et SkillIA",
    "Un seul dashboard pour toutes les actions",
    "Ideal pour une recherche active sur plusieurs semaines",
  ],
};

export const cadovaPlans = [
  {
    name: "Module unique",
    summary: "Tu choisis un besoin precis et tu prends seulement le module adapte.",
    bulletPoints: [
      "Acces a un seul module",
      "Parfait pour un besoin ponctuel ou cible",
      "Prix d'entree plus bas",
    ],
  },
  {
    name: "Cadova Complet",
    summary: "La formule la plus logique si tu veux construire, suivre et ajuster sans sortir de l'outil.",
    bulletPoints: [
      "Les 4 modules ensemble",
      "Meilleure coherence produit",
      "Meilleur rapport couverture / prix",
    ],
  },
];

export const moduleHighlights = [
  {
    icon: ShieldCheck,
    title: "Clair",
    text: "Chaque module a un role net et une place visible dans le parcours candidat.",
  },
  {
    icon: Target,
    title: "Cible",
    text: "Tu peux prendre un module seul ou comparer les usages avant de choisir.",
  },
  {
    icon: Sparkles,
    title: "Simple",
    text: "Le produit reste lisible meme quand tu montes en intensite dans ta recherche.",
  },
  {
    icon: TrendingUp,
    title: "Suivi",
    text: "Le dashboard garde la memoire de ce que tu as vraiment produit et lance.",
  },
];

export function getModuleBySlug(slug: string | undefined) {
  return cadovaModules.find((module) => module.slug === slug);
}
