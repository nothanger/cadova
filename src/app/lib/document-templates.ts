export type DocumentTemplateType = "cv" | "cover-letter";
export type CVLayoutVariant = "classic" | "modern" | "student" | "premium";
export type LetterLayoutVariant = "formal" | "modern" | "student";

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  type: DocumentTemplateType;
  supportsPhoto: boolean;
  layoutVariant: CVLayoutVariant | LetterLayoutVariant;
  accentColor: string;
}

export const cvTemplates: DocumentTemplate[] = [
  {
    id: "classic",
    name: "Classique ATS",
    description: "Sobre, lisible et parfait pour les candidatures qui doivent rester très compatibles ATS.",
    type: "cv",
    supportsPhoto: false,
    layoutVariant: "classic",
    accentColor: "#4f46e5",
  },
  {
    id: "modern",
    name: "Moderne clean",
    description: "Une mise en page plus visuelle, avec photo possible et sections bien aérées.",
    type: "cv",
    supportsPhoto: true,
    layoutVariant: "modern",
    accentColor: "#0f766e",
  },
  {
    id: "student",
    name: "Étudiant junior",
    description: "Pensé pour les stages, alternances et premiers dossiers avec peu d'expérience.",
    type: "cv",
    supportsPhoto: true,
    layoutVariant: "student",
    accentColor: "#7c3aed",
  },
  {
    id: "premium",
    name: "Premium structuré",
    description: "Plus affirmé, très cadré, utile pour présenter un profil avec plusieurs éléments.",
    type: "cv",
    supportsPhoto: false,
    layoutVariant: "premium",
    accentColor: "#111827",
  },
];

export const coverLetterTemplates: DocumentTemplate[] = [
  {
    id: "formal",
    name: "Classique formel",
    description: "Structure traditionnelle, idéale pour les candidatures institutionnelles.",
    type: "cover-letter",
    supportsPhoto: false,
    layoutVariant: "formal",
    accentColor: "#4f46e5",
  },
  {
    id: "modern-letter",
    name: "Moderne clean",
    description: "Présentation plus actuelle, claire et agréable à relire.",
    type: "cover-letter",
    supportsPhoto: false,
    layoutVariant: "modern",
    accentColor: "#0f766e",
  },
  {
    id: "junior-letter",
    name: "Étudiant simple",
    description: "Ton direct et aéré, adapté aux stages, écoles et alternances.",
    type: "cover-letter",
    supportsPhoto: false,
    layoutVariant: "student",
    accentColor: "#7c3aed",
  },
];

export function getCVTemplate(id: string) {
  return cvTemplates.find((template) => template.id === id) ?? cvTemplates[0];
}

export function getCoverLetterTemplate(id: string) {
  return coverLetterTemplates.find((template) => template.id === id) ?? coverLetterTemplates[0];
}
