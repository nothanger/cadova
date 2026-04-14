/* ─────────────────────────────────────────────────────────────────────────────
   reussia-data.ts
   Toutes les données statiques du module ReussIA :
   secteurs, bullets par secteur, compétences par secteur,
   templates de résumé, blocs de lettre de motivation,
   mots-clés stop list pour l'analyse ATS.
───────────────────────────────────────────────────────────────────────────── */

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Briefcase,
  Calculator,
  Cpu,
  GraduationCap,
  Hammer,
  Heart,
  Megaphone,
  Palette,
  Scale,
  School,
  Users,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";

export type SectorId =
  | "marketing"
  | "commerce"
  | "rh"
  | "finance"
  | "droit"
  | "sante"
  | "informatique"
  | "hotellerie"
  | "design"
  | "btp"
  | "education"
  | "autre";

export type ExperienceLevel = "lyceen" | "etudiant" | "junior" | "intermediaire";
export type CandidatureType = "stage" | "alternance" | "emploi" | "parcoursup";
export type LetterTone = "professionnel" | "dynamique" | "formel" | "creatif";

/* ─── SECTEURS ───────────────────────────────────────���──────────────────────── */

export const SECTORS: { id: SectorId; label: string; icon: LucideIcon }[] = [
  { id: "marketing",    label: "Marketing / Communication", icon: Megaphone },
  { id: "commerce",     label: "Commerce / Vente",           icon: Briefcase },
  { id: "rh",           label: "RH / Administration",        icon: Users },
  { id: "finance",      label: "Finance / Comptabilite",     icon: Calculator },
  { id: "droit",        label: "Droit / Juridique",          icon: Scale },
  { id: "sante",        label: "Sante / Social",             icon: Heart },
  { id: "informatique", label: "Informatique / Tech",        icon: Cpu },
  { id: "hotellerie",   label: "Hotellerie / Restauration",  icon: UtensilsCrossed },
  { id: "design",       label: "Design / Creatif",           icon: Palette },
  { id: "btp",          label: "BTP / Ingenierie",           icon: Hammer },
  { id: "education",    label: "Education / Formation",      icon: BookOpen },
  { id: "autre",        label: "Autre / General",            icon: Wrench },
];

/* ─── BULLETS PAR SECTEUR ───────────────────────────────────────────────────── */

export const BULLETS: Record<SectorId, string[]> = {
  marketing: [
    "Animation des reseaux sociaux et creation de contenus (Instagram, LinkedIn, TikTok)",
    "Participation a la mise en place de campagnes d'emailing (taux d'ouverture > 30%)",
    "Redaction d'articles de blog optimises pour le referencement naturel (SEO)",
    "Analyse des performances via Google Analytics et Meta Business Suite",
    "Conception de supports de communication (flyers, presentations, newsletters)",
    "Veille concurrentielle et analyse des tendances du marche",
    "Coordination avec les agences creatives et les prestataires externes",
    "Organisation et suivi logistique d'evenements et de webinaires",
  ],
  commerce: [
    "Conseil et accompagnement client en boutique ou par telephone",
    "Atteinte et depassement des objectifs de vente mensuels",
    "Prospection de nouveaux clients (appels sortants, terrain, LinkedIn)",
    "Gestion et fidelisation d'un portefeuille de clients existants",
    "Traitement des reclamations et gestion des retours produits",
    "Saisie et suivi des commandes via le logiciel CRM interne",
    "Participation aux reunions commerciales hebdomadaires de l'equipe",
    "Redaction de propositions commerciales et envoi de devis personnalises",
  ],
  rh: [
    "Participation active au processus de recrutement (diffusion d'offres, tri de CV, entretiens)",
    "Gestion administrative des contrats, DPAE et dossiers salaries",
    "Accueil et integration des nouveaux collaborateurs (programme d'onboarding)",
    "Suivi des absences, conges et planning dans le SIRH",
    "Support a l'organisation des actions de formation interne",
    "Redaction de fiches de poste et de descriptions metier",
    "Participation a des forums emploi et salons de recrutement",
    "Contribution aux projets RSE et aux initiatives bien-etre au travail",
  ],
  finance: [
    "Saisie, controle et lettrage des ecritures comptables",
    "Preparation et depot des declarations fiscales (TVA, IS, DEB)",
    "Suivi quotidien de la tresorerie et rapprochements bancaires",
    "Participation a la cloture mensuelle et annuelle des comptes",
    "Elaboration de tableaux de bord financiers et de reportings",
    "Gestion des factures fournisseurs et relances clients",
    "Analyse des ecarts budgetaires et aide au controle de gestion",
    "Participation aux audits internes et preparation des liasses fiscales",
  ],
  droit: [
    "Recherche juridique et veille legislative et reglementaire",
    "Redaction de contrats, courriers juridiques et notes de synthese",
    "Assistance lors des consultations client et suivi des dossiers",
    "Participation aux procedures judiciaires et redaction de conclusions",
    "Preparation des assemblees generales et actes de societe",
    "Classement et archivage des dossiers sensibles et confidentiels",
    "Utilisation des bases de donnees juridiques (LexisNexis, Doctrine)",
  ],
  sante: [
    "Accueil, orientation et prise en charge des patients ou usagers",
    "Assistance aux soins dans le respect strict des protocoles en vigueur",
    "Redaction et mise a jour des dossiers patients (DPI)",
    "Coordination pluridisciplinaire avec les equipes medicales et paramedicales",
    "Participation aux reunions de synthese et aux transmissions",
    "Gestion des plannings et des rendez-vous patients",
    "Actions de prevention et de sensibilisation aupres du public",
  ],
  informatique: [
    "Developpement de fonctionnalites front-end et back-end",
    "Participation aux sprints Agile (planning, daily stand-up, retrospective)",
    "Redaction et execution de tests unitaires et d'integration",
    "Correction de bugs et optimisation des performances applicatives",
    "Mise en place et maintenance de pipelines CI/CD",
    "Administration de bases de donnees relationnelles et NoSQL",
    "Revue de code et participation aux pull requests",
    "Contribution a la documentation technique du projet",
  ],
  hotellerie: [
    "Accueil et prise en charge des clients (check-in, check-out)",
    "Gestion des reservations et de la disponibilite via le PMS",
    "Service en salle et conseil sur la carte et les vins",
    "Encaissement et gestion de la caisse en fin de service",
    "Assurance de la satisfaction client et traitement des reclamations",
    "Participation a la mise en place des buffets et des espaces de reception",
    "Respect des normes d'hygiene et securite alimentaire (HACCP)",
  ],
  design: [
    "Creation de visuels pour les supports print et digitaux",
    "Conception d'interfaces utilisateur (UI) et experience utilisateur (UX)",
    "Realisation de maquettes et de prototypes interactifs sous Figma",
    "Participation aux briefs creatifs et aux sessions de brainstorming",
    "Application et evolution de la charte graphique de la marque",
    "Production de contenus video et animations (motion design)",
    "Collaboration etroite avec les equipes marketing et developpement",
  ],
  btp: [
    "Suivi et coordination des corps de metier sur le chantier",
    "Redaction des rapports d'avancement et comptes-rendus de chantier",
    "Lecture et interpretation des plans, CCTP et schemas techniques",
    "Participation aux reunions de chantier hebdomadaires",
    "Gestion des approvisionnements et relations avec les fournisseurs",
    "Controle qualite et veille au respect des normes de securite",
    "Participation a la redaction des devis et appels d'offres",
  ],
  education: [
    "Animation d'ateliers de formation en presentiel et en distanciel",
    "Conception et adaptation des supports pedagogiques",
    "Accompagnement individuel et tutorat des apprenants",
    "Evaluation des competences acquises et suivi de la progression",
    "Contribution a l'elaboration des programmes et referenciels",
    "Gestion administrative (convocations, feuilles d'emargement, certificats)",
  ],
  autre: [
    "Gestion et coordination des taches quotidiennes de l'equipe",
    "Contribution active aux projets transversaux de la structure",
    "Relation et communication avec les partenaires et parties prenantes",
    "Preparation de rapports, presentations et documents de synthese",
    "Participation aux reunions d'equipe et prise de notes",
    "Classement, archivage et gestion documentaire",
  ],
};

/* ─── COMPETENCES PAR SECTEUR ───────────────────────────────────────────────── */

export const SKILLS_BY_SECTOR: Record<SectorId, string[]> = {
  marketing: [
    "Community management", "Reseaux sociaux", "Content marketing",
    "SEO / SEM", "Google Analytics", "Canva", "Adobe Photoshop",
    "Emailing", "Copywriting", "Gestion de projet", "Meta Ads",
  ],
  commerce: [
    "Negociation commerciale", "Prospection", "CRM Salesforce",
    "HubSpot", "Gestion de la relation client", "Pack Office",
    "Techniques de vente", "Closing", "Gestion du stress",
  ],
  rh: [
    "Recrutement", "SIRH", "Onboarding",
    "Droit du travail", "Paie", "Formation professionnelle",
    "Entretiens RH", "ADP", "Pack Office",
  ],
  finance: [
    "Comptabilite generale", "Excel avance", "SAP",
    "Tresorerie", "Audit", "Normes IFRS",
    "Controle de gestion", "Sage Compta", "Tableaux de bord",
  ],
  droit: [
    "Droit des societes", "Droit du travail", "Redaction juridique",
    "Recherche juridique", "LexisNexis", "Doctrine",
    "Procedures judiciaires", "Actes notaries",
  ],
  sante: [
    "Soins infirmiers", "Protocoles medicaux", "Logiciels medicaux",
    "Secourisme PSC1", "Pharmacologie", "Dossier patient informatise",
    "Relation d'aide", "Ecoute active",
  ],
  informatique: [
    "JavaScript / TypeScript", "React", "Python",
    "SQL", "Git / GitHub", "Docker",
    "API REST", "Agile Scrum", "Node.js", "CI/CD",
  ],
  hotellerie: [
    "PMS Opera", "Service client", "Gestion des reservations",
    "HACCP", "Anglais courant", "Caisse",
    "Barista", "Accueil multilingue",
  ],
  design: [
    "Figma", "Adobe Photoshop", "Illustrator",
    "After Effects", "Premiere Pro", "UI / UX Design",
    "Prototypage", "Charte graphique", "Motion design",
  ],
  btp: [
    "AutoCAD", "Revit", "MS Project",
    "Gestion de chantier", "Normes securite", "Lecture de plans",
    "BIM", "Metreur", "Coordination",
  ],
  education: [
    "Pedagogie active", "Animation de groupes", "Conception de formations",
    "PowerPoint", "Tutorat", "Evaluation",
    "Distanciel / e-learning", "Ingenierie pedagogique",
  ],
  autre: [
    "Pack Office", "Travail en equipe", "Communication",
    "Organisation", "Autonomie", "Gestion du temps",
    "Adaptabilite", "Rigueur",
  ],
};

/* ─── SOFT SKILLS UNIVERSELS ─────────────────────────────────────────────────── */

export const SOFT_SKILLS = [
  "Travail en equipe", "Autonomie", "Rigueur", "Adaptabilite",
  "Sens des responsabilites", "Force de proposition", "Ecoute active",
  "Gestion du stress", "Ponctualite", "Curiosite intellectuelle",
  "Creativite", "Sens du detail", "Organisation", "Leadership",
];

/* ─── LANGUES ────────────────────────────────────────────────────────────────── */

export const LANGUAGES = [
  { lang: "Anglais", levels: ["Notions (A2)", "Scolaire (B1)", "Courant (B2)", "Bilingue (C1)", "Langue maternelle"] },
  { lang: "Espagnol", levels: ["Notions (A2)", "Scolaire (B1)", "Courant (B2)", "Bilingue (C1)"] },
  { lang: "Allemand", levels: ["Notions (A2)", "Scolaire (B1)", "Courant (B2)", "Bilingue (C1)"] },
  { lang: "Arabe", levels: ["Notions", "Courant", "Bilingue", "Langue maternelle"] },
  { lang: "Chinois", levels: ["Notions", "Courant", "Bilingue"] },
  { lang: "Portugais", levels: ["Notions", "Courant", "Bilingue", "Langue maternelle"] },
  { lang: "Italien", levels: ["Notions", "Courant", "Bilingue"] },
];

/* ─── TEMPLATES PROFIL CV ────────────────────────────────────────────────────── */

interface SummaryParams {
  firstName?: string;
  sector: SectorId;
  level: ExperienceLevel;
  type: CandidatureType;
  company?: string;
  jobTitle?: string;
}

const SUMMARY_BANK: Record<ExperienceLevel, Record<SectorId, string>> = {
  lyceen: {
    marketing:    "{prenom}Lyceen(ne) en terminale, passionne(e) par la communication digitale et les reseaux sociaux, je recherche un {type} pour developper mes premieres competences professionnelles en marketing. Habitue(e) a creer du contenu sur Instagram et TikTok dans un cadre personnel, j'ai developpe un sens aigu de l'audience et de l'engagement. Curieux(se), investi(e) et force(e) de proposition, je suis pret(e) a m'impliquer pleinement dans les projets de l'equipe et a apporter un regard neuf et motive.",
    commerce:     "{prenom}Lyceen(ne) dynamique avec un sens naturel du contact humain et de la relation client, je recherche un {type} pour decouvrir le monde du commerce professionnel. A l'aise dans les situations de communication et de negociation au quotidien, j'ai developpe une capacite d'ecoute et de conviction que je souhaite mettre au service d'une equipe commerciale. Serieux(se), ponctuel(le) et motive(e) par les objectifs, je m'engage a donner le meilleur de moi-meme.",
    rh:           "{prenom}Lyceen(ne) curieux(se) et naturellement attentif(ve) aux relations humaines, je recherche un {type} pour decouvrir le metier des ressources humaines et le fonctionnement interne d'une organisation. Concerne(e) par les questions de bien-etre et de communication au travail, je souhaite comprendre comment une equipe RH accompagne les collaborateurs. Rigoureux(se), discret(e) et a l'ecoute, je suis pret(e) a apporter mon enthousiasme et mon serieux.",
    finance:      "{prenom}Lyceen(ne) rigoureux(se), passionne(e) par les mathematiques et a l'aise avec les chiffres, je recherche un {type} pour decouvrir le monde de la finance et de la comptabilite en situation reelle. Habitue(e) a analyser des donnees de facon methodique dans le cadre scolaire, je souhaite confronter ces competences a des problematiques professionnelles concretes. Ponctuel(le), organise(e) et desireux(se) d'apprendre, je m'engage avec serieux.",
    droit:        "{prenom}Lyceen(ne) interesse(e) par les questions juridiques et la vie en societe, je recherche un {type} pour decouvrir le fonctionnement d'une structure juridique et developper mes competences en recherche documentaire et redaction. Lecteur(trice) assidu(e) de l'actualite legislative, j'ai developpe un esprit d'analyse et de synthese que je souhaite mettre en pratique. Rigoureux(se) et soucieux(se) du detail, je suis determine(e) a progresser.",
    sante:        "{prenom}Lyceen(ne) profondement motive(e) par les metiers du soin et de l'aide a la personne, je recherche un {type} pour m'initier au secteur de la sante et confirmer ma vocation. Empathique et a l'ecoute dans mes relations quotidiennes, je suis sensible aux besoins des autres et desire m'engager dans un environnement ou chaque action a un impact humain reel. Serieux(se), discret(e) et investi(e), je m'engage pleinement.",
    informatique: "{prenom}Lyceen(ne) passionne(e) d'informatique, de programmation et de nouvelles technologies depuis plusieurs annees, je recherche un {type} pour mettre en pratique mes premieres competences techniques dans un cadre professionnel. Autodidacte, j'ai appris les bases du developpement web et de la resolution de problemes algorithmiques en dehors du cadre scolaire. Curieux(se), rigoureux(se) et avide d'apprendre au contact d'une equipe technique, je suis pret(e) a m'impliquer pleinement.",
    hotellerie:   "{prenom}Lyceen(ne) passionne(e) par l'univers de l'accueil, de la gastronomie et du service, je recherche un {type} pour developper mon sens du service et m'immerger dans un environnement professionnel exigeant. Attentif(ve) aux details, a l'aise avec le public et naturellement souriant(e), je souhaite decouvrir les standards d'excellence du secteur. Ponctuel(le), rigoureux(se) et desireux(se) de bien faire, je m'engage avec enthousiasme.",
    design:       "{prenom}Lyceen(ne) passionne(e) par la creation visuelle, la photographie et le design graphique, je recherche un {type} pour mettre en pratique mes premiers projets dans un cadre professionnel. Habitue(e) a utiliser Canva et les outils Adobe dans un cadre personnel et scolaire, je suis sensible a l'esthetique et a l'impact des images. Curieux(se), creatif(ve) et ouvert(e) aux retours, je suis pret(e) a progresser rapidement.",
    btp:          "{prenom}Lyceen(ne) attire(e) par les metiers techniques du batiment et de la construction, je recherche un {type} pour decouvrir le terrain et m'initier aux exigences du secteur. A l'aise dans les activites techniques et manuelles, j'ai le sens du concret et l'envie de voir des projets prendre forme. Serieux(se), motive(e) et attentif(ve) aux consignes de securite, je suis pret(e) a apprendre sur le terrain.",
    education:    "{prenom}Lyceen(ne) a l'aise avec les enfants et les adolescents, passionne(e) par la transmission et l'accompagnement pedagogique, je recherche un {type} pour decouvrir le monde de l'education. Habitue(e) a aider mes camarades et a expliquer des notions complexes de facon accessible, j'ai developpe une reelle capacite de communication et de patience. Patient(e), bienveillant(e) et motive(e), je m'engage pleinement dans cette experience.",
    autre:        "{prenom}Lyceen(ne) serieux(se), motive(e) et desireux(se) de decouvrir le monde professionnel, je recherche un {type} pour contribuer activement a une equipe et developper mes premieres competences pratiques. Rigoureux(se), ponctuel(le) et curieux(se), j'apprends vite et je m'adapte facilement a de nouveaux contextes. Implique(e) dans ma scolarite et dans mes activites extra-scolaires, je suis pret(e) a m'investir pleinement dans cette experience et a en faire une etape marquante.",
  },
  etudiant: {
    marketing:    "{prenom}Etudiant(e) en {formation}, je recherche un {type} dans le domaine du marketing et de la communication digitale. Forme(e) aux fondamentaux du marketing mix, de la strategie de contenu et de l'analyse de donnees, je maitrise les principaux outils du secteur (Canva, Google Analytics, Meta Business Suite) et suis en veille permanente sur les nouvelles tendances. Force(e) de proposition, curieux(se) et oriente(e) resultats, mon objectif est de contribuer concretement a des projets ambitieux tout en progressant au contact d'une equipe experte.",
    commerce:     "{prenom}Etudiant(e) en {formation}, je recherche un {type} dans le secteur commercial. Dote(e) d'un excellent relationnel, d'une bonne capacite d'ecoute et d'un gout prononce pour la negociation, je m'investis pleinement dans les objectifs confies et j'apprecie les environnements ou la performance est recompensee. Habitue(e) a travailler en equipe et sous pression, je fais preuve de perseverance et de rigueur dans chaque opportunite commerciale.",
    rh:           "{prenom}Etudiant(e) en {formation}, je recherche un {type} dans le domaine des ressources humaines. Sensible aux dynamiques humaines et organisationnelles, j'ai developpe une bonne maitrise des processus RH (recrutement, onboarding, gestion administrative) dans le cadre de ma formation. Curieux(se), empathique et rigoureux(se), je souhaite me confronter aux realites du terrain et contribuer a des projets RH concrets au sein d'une equipe dynamique.",
    finance:      "{prenom}Etudiant(e) en {formation}, je recherche un {type} dans le domaine de la finance et de la comptabilite. Forme(e) aux fondamentaux de la comptabilite generale, de l'analyse financiere et du reporting, je suis a l'aise avec les outils de gestion (Excel, Sage) et j'ai developpe un esprit analytique et une grande rigueur dans le traitement des donnees. Determine(e) a progresser en situation professionnelle, je recherche un environnement stimulant pour approfondir mon expertise.",
    droit:        "{prenom}Etudiant(e) en {formation}, je recherche un {type} afin de consolider mes connaissances juridiques dans un cadre professionnel reel. Habitue(e) a la recherche documentaire, a la redaction d'analyses et a l'utilisation de bases de donnees specialisees (LexisNexis, Doctrine), je suis rigoureux(se), precis(e) et capable de travailler sur des dossiers varies. Mon objectif est de contribuer efficacement tout en developpant une expertise operationnelle solide.",
    sante:        "{prenom}Etudiant(e) en {formation}, je recherche un {type} dans le secteur de la sante ou du medico-social. Profondement motive(e) par le service aux autres et la prise en charge globale des patients, j'ai acquis dans le cadre de ma formation une bonne maitrise des protocoles de soins et des pratiques de communication avec les patients. Empathique, rigoureux(se) et capable de travailler en equipe pluridisciplinaire, je suis pret(e) a m'integrer pleinement dans votre structure.",
    informatique: "{prenom}Etudiant(e) en {formation}, je recherche un {type} pour mettre en pratique mes competences techniques dans un cadre professionnel stimulant. A l'aise en developpement web (HTML, CSS, JavaScript, Python), en gestion de bases de donnees et dans les methodologies Agile, j'ai realise plusieurs projets personnels et scolaires temoignant de ma capacite a produire du code propre et maintenable. Curieux(se), autonome et bon(ne) communiquant(e), je m'integre rapidement dans une equipe technique.",
    hotellerie:   "{prenom}Etudiant(e) en {formation}, je recherche un {type} dans le secteur de l'hotellerie-restauration. Forme(e) aux standards de service, a la gestion des reservations et aux normes HACCP, je suis attache(e) a la qualite de l'experience client et a l'excellence operationnelle. Rigoureux(se) en situation de forte activite, souriant(e) et capable de gerer plusieurs taches simultanement, je suis pret(e) a contribuer activement au bon fonctionnement de votre etablissement.",
    design:       "{prenom}Etudiant(e) en {formation}, je recherche un {type} pour confronter mes productions a des enjeux professionnels reels. A l'aise sous Figma, Adobe Photoshop et Illustrator, j'ai realise plusieurs projets de conception graphique et d'interface temoignant de mon sens de l'esthetique et de ma rigueur. Attentif(ve) aux details, sensible a l'experience utilisateur et ouvert(e) aux retours, je suis pret(e) a m'integrer dans une equipe creative exigeante.",
    btp:          "{prenom}Etudiant(e) en {formation}, je recherche un {type} dans le secteur du BTP pour appliquer mes connaissances techniques sur le terrain. Forme(e) a la lecture de plans, aux methodes de calcul de structures et aux normes de securite, j'ai developpe lors de projets en groupe mon sens de l'organisation et du travail en equipe. Rigoureux(se), reactif(ve) et a l'aise dans des environnements exigeants, je suis pret(e) a apporter ma contribution.",
    education:    "{prenom}Etudiant(e) en {formation}, je recherche un {type} dans le secteur de l'education et de la formation. Passionne(e) par la pedagogie, la transmission et l'accompagnement des apprenants, j'ai developpe des competences en animation de groupes, en conception de supports et en evaluation formative. Patient(e), adaptable et a l'ecoute, je suis capable d'ajuster ma posture et mes methodes en fonction du public et des objectifs.",
    autre:        "{prenom}Etudiant(e) en {formation}, je recherche un {type} pour confronter mes connaissances theoriques aux realites d'un environnement professionnel exigeant. Rigoureux(se), curieux(se) et force(e) de proposition, je m'adapte rapidement a de nouveaux contextes et m'investis pleinement dans les missions confiees. Habitue(e) a travailler en equipe et a gerer plusieurs projets en parallele, je suis determine(e) a faire de cette experience une etape structurante de mon parcours.",
  },
  junior: {
    marketing:    "{prenom}Jeune diplome(e) en marketing et communication avec une premiere experience significative, je maitrise la gestion des reseaux sociaux, la creation de contenu editorial et l'analyse de performances digitales. Habitue(e) a travailler avec Google Analytics, Meta Ads et Canva, j'ai contribue a des campagnes ayant genere des resultats mesurables. Reactif(ve), oriente(e) donnees et force(e) de proposition, je recherche {type} pour contribuer a des projets ambitieux au sein d'une equipe marketing dynamique.",
    commerce:     "{prenom}Jeune diplome(e) avec une premiere experience reussie en commerce et relation client, je maitrise les techniques de prospection, de qualification et de closing. Capable de gerer un portefeuille clients, de rediger des propositions commerciales et d'utiliser un CRM efficacement, j'ai contribue a l'atteinte des objectifs de mon equipe. Determine(e), perseverant(e) et guide(e) par le resultat, je recherche {type} pour relever de nouveaux challenges commerciaux.",
    rh:           "{prenom}Jeune diplome(e) en ressources humaines avec une experience en recrutement, onboarding et gestion administrative, je maitrise les outils SIRH et les fondamentaux du droit du travail. Habitue(e) a conduire des entretiens, a rediger des offres d'emploi et a accompagner les collaborateurs, j'ai developpe un sens aigu du service et de la confidentialite. Oriente(e) solution et relation humaine, je recherche {type} pour m'epanouir dans un role RH generaliste.",
    finance:      "{prenom}Jeune diplome(e) en finance et comptabilite, j'ai acquis de solides bases en comptabilite generale et analytique, gestion de tresorerie et reporting financier. A l'aise avec Excel avance, Sage et les outils de reporting, je produis des analyses fiables dans les delais. Analytique, rigoureux(se) et attache(e) a la precision, je recherche {type} pour approfondir mon expertise dans un environnement stimulant et exigeant.",
    droit:        "{prenom}Jeune diplome(e) en droit avec une premiere experience en cabinet ou en entreprise, j'ai developpe des competences operationnelles en redaction juridique, recherche documentaire et gestion de dossiers. Habitue(e) a traiter des sujets varies (contrats, droit du travail, contentieux) sous contrainte de temps, je suis rigoureux(se), methodique et capable de travailler en autonomie. Je recherche {type} pour consolider ma pratique et progresser rapidement.",
    sante:        "{prenom}Jeune diplome(e) dans le domaine de la sante, je dispose d'une premiere experience de terrain ayant consolide mes competences techniques et relationnelles. A l'aise avec les protocoles de soins, le DPI et la communication avec les patients et leurs familles, j'ai egalement developpe une bonne capacite a travailler en equipe pluridisciplinaire. Empathique, rigoureux(se) et serein(e) en situation difficile, je recherche {type} pour m'investir durablement.",
    informatique: "{prenom}Developpeur(se) junior avec une solide experience en developpement web full-stack, je maitrise React, Node.js, SQL et les environnements Agile. Habitue(e) a livrer des fonctionnalites en production, a rediger des tests et a participer aux revues de code, j'ai contribue a des projets reels generant de la valeur pour les utilisateurs. Passionne(e) par la qualite du code et la resolution de problemes complexes, je recherche {type} pour continuer a monter en competences.",
    hotellerie:   "{prenom}Diplome(e) en hotellerie avec une premiere experience significative en reception, service client et gestion des reservations dans un etablissement exigeant. Habitue(e) aux environnements a forte activite, je suis capable de gerer plusieurs demandes simultanement tout en maintenant un niveau de service eleve. Attache(e) a l'excellence, souriant(e) et rigoureux(se), je recherche {type} pour continuer a progresser dans un etablissement de qualite.",
    design:       "{prenom}Designer junior avec un portfolio diversifie et une premiere experience en agence ou en interne, je maitrise Figma, Adobe Photoshop, Illustrator et After Effects. Habitue(e) a travailler sur des briefs contraints, a presenter mes creations et a integrer les retours clients, j'ai developpe un sens aigu de la coherence visuelle et de l'experience utilisateur. Creatif(ve), rigoureux(se) et oriente(e) impact, je recherche {type} pour contribuer a des projets ambitieux.",
    btp:          "{prenom}Jeune diplome(e) en genie civil ou BTP, j'ai acquis lors de ma premiere experience une bonne maitrise du suivi de chantier, de la coordination des corps de metier et de la gestion documentaire. Habitue(e) a lire et interpreter des plans, a rediger des comptes-rendus et a faire respecter les delais et les normes de securite, je suis rigoureux(se), organise(e) et a l'aise sur le terrain. Je recherche {type} pour prendre davantage de responsabilites.",
    education:    "{prenom}Jeune diplome(e) dans le domaine de l'education ou de la formation, j'ai concu et anime des sessions en presentiel et en distanciel pour des publics varies. Habitue(e) a adapter mes contenus, a evaluer la progression des apprenants et a utiliser des outils numeriques pedagogiques, j'ai developpe une vraie posture de formateur(trice). Passionne(e) par la pedagogie active, je recherche {type} pour m'investir dans un projet educatif structurant.",
    autre:        "{prenom}Jeune diplome(e) avec une premiere experience professionnelle complete, je suis autonome, organise(e) et capable de m'adapter rapidement a de nouvelles missions. Habitue(e) a travailler en equipe, a prendre des initiatives et a rendre compte de mon activite, j'ai developpe une polyvalence et une rigueur que je mets au service de chaque projet. Determine(e) et force(e) de proposition, je recherche {type} pour contribuer activement a une organisation dynamique et ambitieuse.",
  },
  intermediaire: {
    marketing:    "{prenom}Professionnel(le) du marketing digital avec plusieurs annees d'experience en gestion de projets, strategie de contenu, SEO et analyse de performance, je maitrise l'ensemble du tunnel d'acquisition et les principaux outils du secteur (GA4, Semrush, HubSpot, Meta Ads). Habitue(e) a piloter des campagnes multicanal, a coordonner des equipes creatives et a rendre compte des resultats aux directions, je recherche {type} pour mettre mon expertise au service d'une marque ambitieuse et relever de nouveaux defis strategiques.",
    commerce:     "{prenom}Commercial(e) experimente(e), j'ai developpe au fil de mes experiences une maitrise avancee de la negociation complexe, de la fidelisation client et du pilotage d'un portefeuille B2B et B2C. Habitue(e) a construire des relations de confiance durables, a gerer des cycles de vente longs et a coacher des equipes juniors, j'ai constamment atteint et depasse mes objectifs. Je recherche {type} pour relever de nouveaux challenges et continuer a faire progresser les resultats.",
    rh:           "{prenom}Professionnel(le) RH experimente(e), je maitrise l'ensemble du cycle de recrutement, la gestion administrative, la paie, la formation et le dialogue social. Habitue(e) a conseiller les managers, a piloter des projets de transformation RH et a travailler dans des environnements en croissance rapide, je combine rigueur juridique et sens du service. Je recherche {type} pour contribuer a une fonction RH en evolution dans un contexte exigeant.",
    finance:      "{prenom}Professionnel(le) de la finance et du controle de gestion avec plusieurs annees d'experience, je maitrise la comptabilite analytique, la consolidation, le reporting et le pilotage budgetaire. Habitue(e) a produire des analyses fiables sous contrainte de temps et a presenter les resultats aux comites de direction, je recherche {type} pour apporter mon expertise dans un environnement exigeant et contribuer a la performance de l'organisation.",
    droit:        "{prenom}Juriste experimente(e) avec une solide maitrise du droit des societes, du droit du travail et de la conformite reglementaire, j'ai gere des dossiers complexes en autonomie et accompagne des operations de restructuration et de contentieux. Rigoureux(se), reactif(ve) et capable de vulgariser les enjeux juridiques pour les directions operationnelles, je recherche {type} pour mettre mon expertise au service d'une organisation en croissance.",
    sante:        "{prenom}Professionnel(le) de sante experimente(e), je maitrise les protocoles cliniques, la gestion des dossiers patients et la coordination d'equipes pluridisciplinaires dans des environnements a forte activite. Habitue(e) a travailler en autonomie, a prendre des decisions sous pression et a contribuer a l'amelioration continue des pratiques, je combine expertise technique et qualites humaines au service des patients. Je recherche {type} pour m'investir dans un projet de soin ambitieux.",
    informatique: "{prenom}Developpeur(se) full-stack avec plusieurs annees d'experience en production, je maitrise React, Node.js, Python, SQL et les architectures cloud (AWS, GCP). Habitue(e) a concevoir des architectures evolutives, a livrer dans des environnements CI/CD et a collaborer avec des equipes produit et design, j'ai contribue a des projets a fort impact utilisateur. Passionne(e) par la qualite et les bonnes pratiques, je recherche {type} pour rejoindre une equipe tech ambitieuse.",
    hotellerie:   "{prenom}Professionnel(le) de l'hotellerie et de la restauration avec une experience solide en direction de salle, en gestion operationnelle et en management d'equipe, je recherche {type} dans un etablissement de standing pour continuer a elever les standards de service. Habitue(e) a travailler dans des environnements exigeants, a fideliser une clientele internationale et a manager des equipes pluriculturelles, je combine expertise operationnelle et leadership bienveillant.",
    design:       "{prenom}Designer UI/UX experimente(e) avec un portfolio de projets web et mobile pour des marques reconnues, je maitrise Figma, la suite Adobe et les methodologies de design thinking et de recherche utilisateur. Habitue(e) a piloter des projets creatifs de A a Z, a collaborer avec les equipes produit et developpement et a defendre mes decisions design, je recherche {type} pour prendre en charge des projets a fort enjeu.",
    btp:          "{prenom}Ingenieur(e) ou technicien(ne) BTP experimente(e), j'ai pilote plusieurs chantiers en autonomie, coordonne des equipes pluridisciplinaires et gere des budgets significatifs dans le respect des delais et des normes qualite et securite. Habitue(e) a lire des CCTP complexes, a negocier avec les fournisseurs et a produire des reportings d'avancement, je recherche {type} pour relever de nouveaux defis et piloter des projets d'envergure.",
    education:    "{prenom}Formateur(trice) experimente(e), j'ai concu et anime de nombreuses formations en presentiel et en e-learning pour des publics varies (salaries, demandeurs d'emploi, etudiants). Maitrise de l'ingenierie pedagogique, des outils LMS et des techniques d'animation participative, je suis capable de concevoir des parcours complets et de mesurer leur impact. Je recherche {type} pour developper des programmes innovants et impactants.",
    autre:        "{prenom}Professionnel(le) experimente(e) avec une solide culture du resultat, du travail en equipe et de l'amelioration continue, je maitrise la gestion de projets transversaux, la coordination d'equipes et le reporting strategique. Habitue(e) a evoluer dans des environnements changeants et a resoudre des problemes complexes avec methode et creativite, je recherche {type} pour apporter mon expertise et contribuer activement a la croissance d'une organisation ambitieuse.",
  },
};

export function buildSummary(params: {
  firstName: string;
  sector: SectorId;
  level: ExperienceLevel;
  formation: string;
  type: CandidatureType;
  company: string;
}): string {
  const template = SUMMARY_BANK[params.level]?.[params.sector] || SUMMARY_BANK.etudiant.autre;
  const typeLabel: Record<CandidatureType, string> = {
    stage: "stage",
    alternance: "contrat en alternance",
    emploi: "un poste",
    parcoursup: "une formation",
  };
  return template
    .replace("{prenom}", params.firstName ? `${params.firstName}, ` : "")
    .replace("{formation}", params.formation || "ma formation actuelle")
    .replace("{type}", typeLabel[params.type] || "stage")
    .replace("{entreprise}", params.company || "votre entreprise");
}

/* ─── LETTRE DE MOTIVATION — BLOCS ──────────────────────────────────────────── */

type IntroKey = `${CandidatureType}_${LetterTone}`;

const INTRO_BLOCKS: Partial<Record<IntroKey, string>> = {
  stage_professionnel:
    "Actuellement etudiant(e) en {formation}, j'ai l'honneur de vous soumettre ma candidature pour un stage au sein de {entreprise} en tant que {poste}. Sensible aux valeurs et aux projets portes par votre structure, je suis convaincu(e) que cette experience me permettra de developper des competences solides tout en apportant une contribution utile a vos equipes.",
  stage_dynamique:
    "Passionne(e) par {secteur} et a la recherche d'une experience concrete, je candidate avec enthousiasme au stage de {poste} chez {entreprise}. Votre reputation dans le secteur et la dynamique de vos equipes m'ont immediatement convaincu(e) que c'est ici que je souhaitais donner vie a mes ambitions.",
  stage_formel:
    "J'ai l'honneur de vous presenter ma candidature pour le poste de stagiaire {poste} au sein de votre organisation. Etudiant(e) rigoureux(se) avec un parcours academique solide, je souhaite mettre mes connaissances theoriques au service de {entreprise} dans le cadre d'une mission valorisante.",
  stage_creatif:
    "Il y a des entreprises dont on lit les actualites, dont on suit les projets avec admiration — {entreprise} en fait partie. C'est donc avec une motivation sincere et un regard neuf que je vous soumets ma candidature pour le stage {poste}.",

  alternance_professionnel:
    "Etudiant(e) en {formation} et a la recherche d'un contrat en alternance pour approfondir ma formation, je me permets de vous adresser ma candidature pour le poste de {poste} au sein de {entreprise}. Convaincu(e) que l'alternance represente la voie la plus efficace pour developper de reelles competences professionnelles, je m'investirais pleinement dans cette mission.",
  alternance_dynamique:
    "Apprendre en faisant — c'est mon credo. C'est pourquoi je candidate avec conviction au poste {poste} en alternance chez {entreprise}. Votre secteur m'attire depuis longtemps, et votre entreprise incarne exactement l'environnement dans lequel je souhaite grandir professionnellement.",
  alternance_formel:
    "Je me permets de vous adresser ma candidature pour un contrat en alternance au sein de votre etablissement, pour le poste de {poste}. Mon cursus en {formation} m'a fourni des bases solides que je souhaite consolider par une experience pratique a vos cotes.",
  alternance_creatif:
    "Une alternance, ce n'est pas juste un contrat — c'est un pari sur l'avenir. Le mien, je voudrais le construire avec {entreprise}, sur le poste de {poste}. J'ai decouvert votre structure et je suis immediatement tombe(e) sous le charme de votre approche.",

  emploi_professionnel:
    "Fort(e) de mes experiences professionnelles et de ma formation en {formation}, je vous adresse ma candidature pour le poste de {poste} au sein de {entreprise}. Convaincu(e) de pouvoir apporter une reelle valeur ajoutee a vos equipes, je reste a votre disposition pour un entretien.",
  emploi_dynamique:
    "Votre offre pour le poste de {poste} a immediatement retenu mon attention. En tant que professionnel(le) de {secteur}, je suis convaincu(e) d'avoir le profil et la motivation pour relever les defis que vous proposez au sein de {entreprise}.",
  emploi_formel:
    "J'ai l'honneur de vous soumettre ma candidature pour le poste de {poste} que vous proposez. Mon parcours professionnel m'a permis d'acquerir des competences directement applicables aux missions decrites dans votre annonce.",
  emploi_creatif:
    "Certaines opportunites ne se refusent pas. Quand j'ai decouvert le poste de {poste} chez {entreprise}, j'ai immediatement su que ma place etait ici. Mon parcours, atypique mais coherent, m'a prepare a exactement ce type de defi.",

  parcoursup_professionnel:
    "Je me permets de vous adresser ma candidature pour rejoindre votre formation {poste}. Mon parcours scolaire et mes premieres experiences m'ont confirme que ce domaine est celui dans lequel je souhaite me specialiser et evoluer professionnellement.",
  parcoursup_dynamique:
    "Depuis plusieurs annees, le domaine de {secteur} me passionne. Votre formation {poste} represente pour moi l'opportunite ideale d'approfondir ces interets et de me construire un avenir professionnel solide et epanouissant.",
  parcoursup_formel:
    "J'ai l'honneur de vous presenter ma candidature pour integrer votre formation {poste}. Mon dossier scolaire et ma motivation sincere temoignent de mon serieux et de mon engagement a m'investir pleinement dans ce cursus.",
  parcoursup_creatif:
    "Entrer dans votre formation {poste}, c'est le projet que je construis depuis plusieurs mois. Ma curiosite, mes experiences et ma determination m'ont convaincu(e) que c'est exactement le chemin qu'il me faut emprunter.",
};

const BODY_BLOCKS: Record<SectorId, Record<LetterTone, string>> = {
  marketing: {
    professionnel: "Au cours de ma formation et de mes experiences, j'ai developpe des competences concretesen gestion des reseaux sociaux, en creation de contenu et en analyse des performances digitales. Je suis a l'aise avec les outils du marketing digital (Canva, Google Analytics, Meta Ads) et je suis en veille permanente sur les nouvelles tendances du secteur. {points_forts}",
    dynamique:     "Le marketing, c'est ma passion depuis toujours. J'ai cree des contenus qui engagent, analyse des campagnes pour les optimiser et appris a parler a des audiences tres differentes. Ce qui me distingue ? Je combine creativite et rigueur analytique, et je ne suis jamais a court d'idees. {points_forts}",
    formel:        "Mon parcours m'a permis d'acquerir une solide maitrise des fondamentaux du marketing et de la communication, tant sur le plan theorique qu'operationnel. Je suis en mesure de prendre en charge la gestion des reseaux sociaux, la redaction de contenus et le suivi des indicateurs de performance. {points_forts}",
    creatif:       "Chaque marque raconte une histoire. Mon role, c'est de l'aider a la raconter mieux. Que ce soit sur Instagram, dans une newsletter ou sur une affiche, je sais creer du contenu qui parle aux bonnes personnes au bon moment. {points_forts}",
  },
  commerce: {
    professionnel: "Mes experiences m'ont permis de developper de solides competences en relation client, en prospection et en negociation. Je suis a l'aise aussi bien en face-a-face qu'au telephone, et j'ai appris a gerer les objections et a conclure des ventes dans des contextes varies. {points_forts}",
    dynamique:     "La vente, c'est avant tout une histoire de confiance et d'ecoute. J'ai appris a identifier rapidement les besoins d'un client, a y repondre avec les bons arguments et a construire une relation durable. Mes chiffres parlent d'eux-memes : je ne lache rien jusqu'a l'objectif. {points_forts}",
    formel:        "Mon parcours commercial m'a permis de maitriser les etapes cles du cycle de vente, de la prospection a la fidelisation. Rigoureux(se) dans le suivi de mes indicateurs et oriente(e) satisfaction client, je m'integre efficacement dans des equipes commerciales exigeantes. {points_forts}",
    creatif:       "Je suis de ceux qui pensent que la vente n'est pas un art de convaincre, mais un art de comprendre. Comprendre ce dont l'autre a besoin, lui apporter une solution sur mesure, et le faire avec le sourire. C'est ma vision du commerce. {points_forts}",
  },
  rh: {
    professionnel: "J'ai acquis une solide experience dans les processus de recrutement, la gestion administrative du personnel et l'accompagnement des collaborateurs. Sensible aux questions de bien-etre au travail, je m'attache a creer un environnement de travail positif et inclusif. {points_forts}",
    dynamique:     "Les RH, c'est le coeur battant d'une entreprise. J'ai eu la chance de travailler sur des sujets varies — recrutement, onboarding, formation, QVT — et j'ai realise que ce que j'aime par-dessus tout, c'est mettre les bonnes personnes aux bons endroits. {points_forts}",
    formel:        "Mon parcours en ressources humaines m'a permis de me familiariser avec les principaux processus RH : recrutement, contrats, gestion des absences, paie et formation. Je suis en mesure d'assister une equipe RH dans ses missions quotidiennes avec rigueur et discretion. {points_forts}",
    creatif:       "Les ressources humaines, c'est d'abord une histoire de personnes. Et je crois fermement qu'une equipe qui se sent ecoutee et soutenue est une equipe performante. C'est cette conviction qui guide toutes mes actions RH. {points_forts}",
  },
  finance: {
    professionnel: "Au cours de ma formation, j'ai acquis des bases solides en comptabilite generale, en analyse financiere et en gestion de tresorerie. Rigoureux(se) et methodique, je suis a l'aise avec les outils de gestion (Excel, Sage) et attache(e) a la fiabilite et a la precision des donnees. {points_forts}",
    dynamique:     "Les chiffres, c'est mon terrain de jeu. J'aime comprendre ce qui se cache derriere un bilan, identifier les leviers de performance et proposer des analyses pertinentes. Ma rigueur analytique et ma rapidite d'execution me permettent de delivrer des resultats fiables dans les delais. {points_forts}",
    formel:        "Mon parcours academique et mes experiences pratiques m'ont permis d'acquerir des competences en comptabilite, tresorerie et controle de gestion. Je suis en mesure de prendre en charge les operations de saisie comptable, de preparation des etats financiers et de suivi budgetaire. {points_forts}",
    creatif:       "La finance, c'est bien plus que des chiffres — c'est la traduction chiffree des decisions strategiques d'une organisation. C'est cette dimension qui me passionne et qui me pousse a toujours aller au-dela des apparences pour comprendre ce qui se joue vraiment. {points_forts}",
  },
  droit: {
    professionnel: "Ma formation juridique m'a permis de developper de solides competences en recherche juridique, en redaction d'actes et en analyse de textes reglementaires. Rigoureux(se) et attentif(ve) au detail, je suis capable de travailler sur des dossiers varies tout en respectant les contraintes de confidentialite inherentes a la profession. {points_forts}",
    dynamique:     "Le droit m'a toujours fascine pour sa complexite et sa necessite. Chaque dossier est un puzzle unique, et j'adore mobiliser mes connaissances pour trouver la solution la plus juste et la plus protectrice pour mon client. {points_forts}",
    formel:        "Mon cursus en droit m'a fourni une connaissance solide des principales branches du droit applicables en entreprise. Je suis en mesure d'assister une equipe juridique dans la redaction d'actes, la realisation de recherches et le suivi des dossiers en cours. {points_forts}",
    creatif:       "Le droit, ce n'est pas juste des textes. C'est un systeme vivant, en perpetuelle evolution, au service des personnes et des organisations. C'est cette dimension humaine et sociale qui m'a convaincu(e) d'en faire ma vocation. {points_forts}",
  },
  sante: {
    professionnel: "Mon parcours dans le secteur de la sante m'a permis de developper des competences techniques et relationnelles indispensables : rigueur dans le respect des protocoles, empathie dans la relation aux patients et capacite a travailler efficacement en equipe pluridisciplinaire. {points_forts}",
    dynamique:     "Prendre soin des autres, c'est bien plus qu'un metier — c'est une vocation. Chaque interaction avec un patient est une opportunite de faire une vraie difference dans sa vie. C'est cette conviction qui me pousse a m'investir pleinement dans chaque mission. {points_forts}",
    formel:        "Ma formation dans le domaine de la sante m'a dote(e) des connaissances techniques et des pratiques professionnelles necessaires pour exercer dans un etablissement de soins. Je respecte scrupuleusement les protocoles en vigueur et m'integre facilement dans des equipes pluridisciplinaires. {points_forts}",
    creatif:       "Il y a des metiers qui vous choisissent autant que vous les choisissez. La sante est de ceux-la. Depuis toujours, je suis attire(e) par ce qui fait qu'un etre humain va mieux, par les petites et grandes victoires du soin. {points_forts}",
  },
  informatique: {
    professionnel: "Mon parcours en developpement m'a permis d'acquerir une bonne maitrise des technologies web modernes, des pratiques Agile et des fondamentaux du DevOps. J'ai l'habitude de travailler en equipe sur des projets complexes et je m'adapte rapidement aux nouvelles technologies et aux contraintes metier. {points_forts}",
    dynamique:     "Coder, c'est resoudre des problemes. Et c'est ce que j'aime par-dessus tout. Que ce soit un bug recalcitrant ou une architecture a repenser, j'aborde chaque defi avec methode et enthousiasme. Je suis a l'aise dans les environnements Agile et j'apprends tres vite. {points_forts}",
    formel:        "Ma formation en informatique m'a fourni de solides competences en developpement logiciel, en gestion de bases de donnees et en methodologies de projet. Je suis en mesure de contribuer efficacement a des projets de developpement dans le respect des standards de qualite. {points_forts}",
    creatif:       "Le code, c'est de la creation. Chaque application est un espace de solutions inventees. Ce qui me passionne, c'est de creer quelque chose qui n'existait pas, de faire en sorte que ca fonctionne et que ca soit utile pour de vrais utilisateurs. {points_forts}",
  },
  hotellerie: {
    professionnel: "Mes experiences dans le secteur de l'hotellerie et de la restauration m'ont permis de developper un sens aigu du service, une excellente gestion du stress en situation de forte affluence et une vraie culture de la satisfaction client. Je m'integre rapidement dans les equipes et suis attache(e) a l'excellence operationnelle. {points_forts}",
    dynamique:     "L'hotellerie, c'est l'art de faire se sentir les gens chez eux, loin de chez eux. J'ai appris a lire les attentes des clients avant meme qu'ils les formulent, a gerer plusieurs situations simultanement et a toujours garder le sourire. C'est un metier exigeant que j'adore. {points_forts}",
    formel:        "Mon parcours en hotellerie m'a permis de maitriser les fondamentaux du service client, de la gestion des reservations et des standards d'hygiene et de securite. Je suis en mesure de m'integrer efficacement dans votre etablissement et de repondre aux exigences de votre clientele. {points_forts}",
    creatif:       "Chaque client qui pousse la porte de votre etablissement merite une experience unique. C'est cette conviction qui guide mon approche du service et qui fait de moi un(e) professionnel(le) de l'hospitalite pleinement engage(e). {points_forts}",
  },
  design: {
    professionnel: "Ma formation et mes projets personnels m'ont permis de developper une solide maitrise des outils de creation (Figma, suite Adobe) et une sensibilite aux enjeux de l'experience utilisateur. Attentif(ve) a la coherence de l'identite visuelle, je suis capable de mener un projet creatif de la phase de concept a la livraison finale. {points_forts}",
    dynamique:     "Design, c'est observer le monde et proposer un point de vue. J'adore comprendre les besoins des utilisateurs et les traduire en interfaces intuitives et belles. Mon portfolio reflete cette double obsession pour l'esthetique et l'usage. {points_forts}",
    formel:        "Mon cursus en design m'a dote(e) d'une maitrise des principaux logiciels de creation graphique et d'une methodologie rigoureuse pour mener des projets visuels de bout en bout. Je suis en mesure de contribuer a la production de supports print, digitaux et de maquettes d'interfaces. {points_forts}",
    creatif:       "Je crois que le meilleur design est celui qu'on ne voit pas. Celui qui est tellement juste qu'il devient invisible, transparent, naturel. C'est cet ideal qui guide chacune de mes creations — les plus simples comme les plus ambitieuses. {points_forts}",
  },
  btp: {
    professionnel: "Ma formation et mes premieres experiences sur le terrain m'ont permis d'acquerir de solides bases en gestion de chantier, lecture de plans et coordination des corps de metier. Rigoureux(se) et oriente(e) resultats, je suis a l'aise dans les environnements exigeants du secteur du BTP. {points_forts}",
    dynamique:     "Le BTP, c'est voir les projets prendre forme jour apres jour. Ce qui me motive, c'est la concretude de ce secteur : a la fin, il reste quelque chose de tangible. Et le chemin pour y arriver — la coordination, la resolution de problemes, l'adaptation — c'est ce que j'aime par-dessus tout. {points_forts}",
    formel:        "Mon parcours m'a permis d'acquerir des competences techniques en suivi de chantier, en lecture de documents techniques et en gestion des approvisionnements. Je respecte scrupuleusement les normes de securite et de qualite en vigueur dans le secteur. {points_forts}",
    creatif:       "Construire, c'est transformer un projet sur papier en realite palpable. J'aime cette magie-la — et j'aime encore plus contribuer a ce qu'elle se passe dans les meilleures conditions, dans les delais et en respectant les specs. {points_forts}",
  },
  education: {
    professionnel: "Mon parcours dans le domaine de l'education et de la formation m'a permis de developper de reelles competences pedagogiques : conception de supports, animation de groupes et evaluation des apprenants. Passionne(e) par la transmission, je mets un point d'honneur a adapter ma posture et mes methodes a chaque public. {points_forts}",
    dynamique:     "Enseigner, c'est donner des cles. Des cles pour comprendre le monde, pour s'adapter, pour progresser. C'est la mission qui m'anime chaque jour et qui donne du sens a ce que je fais. J'aime voir les apprenants evoluer et je sais creer les conditions pour que ca arrive. {points_forts}",
    formel:        "Ma formation pedagogique et mes experiences d'animation m'ont dote(e) des competences necessaires pour concevoir et animer des sessions de formation de qualite. Je maitrise les techniques d'animation en presentiel et en distanciel et je suis attache(e) a la progression de chaque apprenant. {points_forts}",
    creatif:       "La pedagogie, c'est un design d'experience. Comment structurer l'apprentissage pour qu'il soit fluide, engageant, memorable ? C'est la question qui me fascine et qui guide toute ma pratique de formateur(trice). {points_forts}",
  },
  autre: {
    professionnel: "Mon parcours m'a permis de developper des competences transversales solides : organisation, rigueur, travail en equipe et capacite d'adaptation. Je suis capable de m'integrer rapidement dans une equipe et de prendre en charge des missions variees avec efficacite. {points_forts}",
    dynamique:     "Ce que j'apporte dans une equipe, c'est de l'energie, de la methode et une envie reelle de contribuer. J'apprends vite, je m'adapte encore plus vite, et je ne compte pas mes efforts quand le projet en vaut la peine. {points_forts}",
    formel:        "Mon parcours m'a permis d'acquerir les competences fondamentales d'un(e) collaborateur(trice) efficace : maitrise des outils bureautiques, sens de l'organisation et bonne communication ecrite et orale. {points_forts}",
    creatif:       "Je suis convaincu(e) qu'un bon collaborateur n'est pas juste quelqu'un qui fait ce qu'on lui dit — c'est quelqu'un qui comprend le contexte, s'investit dans les objectifs et propose des solutions meme quand ce n'est pas son role. C'est ce que je veux etre pour vous. {points_forts}",
  },
};

const CONCLUSION_BLOCKS: Record<LetterTone, string> = {
  professionnel:
    "Convaincu(e) que mon profil correspond aux attentes du poste, je reste a votre entiere disposition pour un entretien au moment qui vous conviendra. Dans l'attente de vous lire, veuillez agreer, Madame, Monsieur, l'expression de mes salutations distinguees.",
  dynamique:
    "Je serais ravi(e) de vous presenter de vive voix ce que je peux apporter a votre equipe. Disponible des que vous le souhaitez, je reste joignable par email ou par telephone. A tres bientot, j'espere !",
  formel:
    "Je vous prie de bien vouloir trouver ci-joint mon curriculum vitae et me tiens a votre disposition pour tout entretien ou complement d'information. Veuillez agreer, Madame, Monsieur, l'expression de mes respectueuses salutations.",
  creatif:
    "Je n'ai qu'une hate : vous rencontrer pour vous montrer de quoi je suis capable. Si vous pensez que mon profil peut vous apporter quelque chose, je suis disponible pour en parler — de preference autour d'un cafe. En attendant, mes meilleurs messages.",
};

export function buildCoverLetter(params: {
  firstName: string;
  companyName: string;
  jobTitle: string;
  sector: SectorId;
  formation: string;
  type: CandidatureType;
  tone: LetterTone;
  strengths: string;
  motivation: string;
  city: string;
}): string {
  const key = `${params.type}_${params.tone}` as IntroKey;
  const introTpl = INTRO_BLOCKS[key] || INTRO_BLOCKS[`stage_professionnel`]!;

  const sectorLabel = SECTORS.find((s) => s.id === params.sector)?.label || params.sector;

  const intro = introTpl
    .replace(/{entreprise}/g, params.companyName || "votre entreprise")
    .replace(/{poste}/g, params.jobTitle || "ce poste")
    .replace(/{formation}/g, params.formation || "ma formation actuelle")
    .replace(/{secteur}/g, sectorLabel);

  const bodyTpl = BODY_BLOCKS[params.sector]?.[params.tone] || BODY_BLOCKS.autre.professionnel;
  const strengthsLine = params.strengths
    ? `Parmi mes atouts : ${params.strengths}.`
    : "";
  const body = bodyTpl.replace("{points_forts}", strengthsLine);

  const motivationPara = params.motivation
    ? `Ce qui m'attire particulierement chez ${params.companyName || "vous"} : ${params.motivation}.`
    : "";

  const conclusion = CONCLUSION_BLOCKS[params.tone];

  const today = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const header = `${params.firstName ? params.firstName + "\n" : ""}${params.city || "Paris"}, le ${today}\n\nObjet : Candidature — ${params.jobTitle || "Poste propose"} chez ${params.companyName || "votre entreprise"}`;
  const opening = "Madame, Monsieur,";
  const closing = params.firstName ? `\n${params.firstName}` : "";

  return [header, "", opening, "", intro, "", body, motivationPara ? motivationPara : "", "", conclusion, closing]
    .filter((l) => l !== undefined && l !== null)
    .join("\n");
}

/* ─── ATS — ANALYSE SANS IA ─────────────────────────────────────────────────── */

const STOP_WORDS_FR = new Set([
  "le","la","les","de","du","des","un","une","et","est","en","au","aux",
  "par","pour","sur","avec","dans","ce","qui","que","vous","nous","votre",
  "notre","se","son","sa","ses","ou","si","mais","donc","or","ni","car",
  "il","elle","ils","elles","je","tu","on","tres","plus","moins","bien",
  "tout","tous","toute","toutes","cette","ces","leur","leurs","me","te",
  "lui","meme","ainsi","aussi","comme","dont","quand","alors","apres",
  "avant","etre","avoir","faire","aller","vouloir","pouvoir","devoir",
  "savoir","voir","venir","prendre","donner","trouver","mettre","passer",
  "entre","vers","sous","sans","lors","selon","afin","tant","peu","tres",
  "non","oui","pas","ne","nous","ont","sont","sera","serait","ete","etes",
  "quil","quon","cest","cela","ceci","deja","chez","lors","toujours",
  "notamment","permettre","permettra","permet",
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS_FR.has(w));
}

export type ATSMode = "pro" | "stage" | "observation";

export const ATS_MODES: { value: ATSMode; label: string; icon: LucideIcon; desc: string }[] = [
  {
    value: "observation",
    label: "Stage d'observation",
    icon: School,
    desc: "3eme / Seconde — premier contact avec le monde professionnel",
  },
  {
    value: "stage",
    label: "Stage / Alternance",
    icon: GraduationCap,
    desc: "Lycee, BTS, Licence, Master — recherche de stage ou alternance",
  },
  {
    value: "pro",
    label: "Emploi / CDI",
    icon: Briefcase,
    desc: "Jeune diplome ou experience — recherche d'un poste",
  },
];

export interface ATSResult {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
  sections: {
    name: string;
    score: number;
    status: "good" | "warning" | "bad";
    feedback: string;
  }[];
  topJobKeywords: { word: string; freq: number; found: boolean }[];
  mode: ATSMode;
  hasJobDesc: boolean;
}

/* ── Pondérations par mode pour le score structure ── */
const WEIGHTS: Record<ATSMode, Record<string, number>> = {
  pro:         { coordonnees: 0.15, formation: 0.15, experience: 0.20, competences: 0.20, chiffres: 0.15, linkedin: 0.10, longueur: 0.05 },
  stage:       { coordonnees: 0.20, formation: 0.20, experience: 0.20, competences: 0.15, chiffres: 0.08, linkedin: 0.05, longueur: 0.12 },
  observation: { coordonnees: 0.25, formation: 0.30, experience: 0.15, competences: 0.10, chiffres: 0.00, linkedin: 0.00, longueur: 0.20 },
};

export function runATSAnalysis(
  cvText: string,
  jobDesc: string,
  mode: ATSMode = "stage"
): ATSResult {
  const cvNorm = normalize(cvText);
  const hasJobDesc = jobDesc.trim().length > 30;

  /* ── Analyse mots-clés (seulement si offre fournie) ── */
  const jobTokens = hasJobDesc ? tokenize(jobDesc) : [];
  const cvTokens = new Set(tokenize(cvText));

  const freq = new Map<string, number>();
  for (const w of jobTokens) freq.set(w, (freq.get(w) || 0) + 1);

  const importantWords = Array.from(new Set(jobTokens))
    .filter((w) => w.length > 4)
    .sort((a, b) => (freq.get(b) || 0) - (freq.get(a) || 0));

  const matched = importantWords.filter((w) => cvTokens.has(w));
  const missing = importantWords.filter((w) => !cvTokens.has(w)).slice(0, 12);

  const topJobKeywords = importantWords.slice(0, 20).map((word) => ({
    word,
    freq: freq.get(word) || 1,
    found: cvTokens.has(word),
  }));

  /* ── Détection des éléments du CV ── */
  const hasEmail    = cvNorm.includes("@") || cvNorm.includes("email") || cvNorm.includes("mail");
  const hasPhone    = /06|07|01|02|03|04|05|\+33/.test(cvText);
  const hasLinkedIn = cvNorm.includes("linkedin");
  const hasMetrics  = /\d+%|\d+\s?k|\d+\s?clients|\d+\s?projets|\+\d/.test(cvText);
  const wordCount   = cvText.trim() ? cvText.trim().split(/\s+/).length : 0;

  // Formation — détection élargie selon mode
  const hasFormation = mode === "observation"
    ? ["college", "lycee", "troisieme", "3eme", "seconde", "premiere", "terminale",
       "classe", "ecole", "sixieme", "cinquieme", "quatrieme", "bac", "brevet", "section"].some((k) => cvNorm.includes(k))
    : ["licence", "master", "bts", "dut", "bac", "diplome", "universite", "ecole",
       "iut", "bep", "cap", "lycee", "terminale", "seconde", "premiere", "mba"].some((k) => cvNorm.includes(k));

  // Expérience / contenu adapté selon mode
  const hasExperience = mode === "observation"
    ? ["interet", "loisir", "passion", "hobby", "club", "sport", "musique",
       "benevolat", "association", "projet", "aide", "babysitting", "cuisine",
       "voyage", "lecture", "informatique", "creation"].some((k) => cvNorm.includes(k))
    : ["stage", "mission", "poste", "assistant", "charge", "cdi", "cdd",
       "interim", "benevolat", "association", "emploi", "experience",
       "apprenti", "alternance"].some((k) => cvNorm.includes(k));

  // Compétences
  const hasSkills = mode === "observation"
    ? ["competence", "maitrise", "informatique", "bureautique", "langue",
       "anglais", "espagnol", "sport", "musique", "art", "creation"].some((k) => cvNorm.includes(k))
    : ["competence", "maitrise", "connaissance", "logiciel", "outil",
       "microsoft", "excel", "word", "canva", "photoshop", "javascript",
       "python", "pack office"].some((k) => cvNorm.includes(k));

  // Longueur cible par mode (en mots)
  const targetWords = { observation: 120, stage: 250, pro: 380 }[mode];
  const longueurScore = wordCount >= targetWords
    ? 90
    : wordCount >= targetWords * 0.65
    ? 65
    : wordCount >= targetWords * 0.35
    ? 40
    : 20;

  /* ── Score de chaque critère ── */
  const sCoord   = hasEmail && hasPhone ? 95 : hasEmail ? 65 : hasPhone ? 50 : 20;
  const sFormation  = hasFormation ? 90 : 30;
  const sExperience = hasExperience ? 85 : (mode === "observation" ? 45 : 30);
  const sCompetences= hasSkills ? 82 : (mode === "observation" ? 55 : 32);
  // Pour les critères non exigés selon mode : score neutre
  const sChiffres   = hasMetrics ? 90 : (mode === "pro" ? 30 : mode === "stage" ? 55 : 85);
  const sLinkedIn   = hasLinkedIn ? 90 : (mode === "pro" ? 35 : mode === "stage" ? 65 : 85);

  /* ── Score structure pondéré ── */
  const w = WEIGHTS[mode];
  const structureScore = Math.round(
    sCoord       * w.coordonnees +
    sFormation   * w.formation   +
    sExperience  * w.experience  +
    sCompetences * w.competences +
    sChiffres    * w.chiffres    +
    sLinkedIn    * w.linkedin    +
    longueurScore * w.longueur
  );

  /* ── Score final : structure seule ou structure + compatibilité offre ── */
  let score: number;
  if (hasJobDesc && importantWords.length > 0) {
    const keywordScore = Math.round((matched.length / importantWords.length) * 100);
    // 40% structure + 60% compatibilité mots-clés
    score = Math.round(structureScore * 0.4 + keywordScore * 0.6);
  } else {
    score = structureScore;
  }
  score = Math.min(Math.max(score, 0), 98);

  /* ── Sections affichées (adaptées au mode) ── */
  const sections: ATSResult["sections"] = [];

  sections.push({
    name: "Coordonnees",
    score: sCoord,
    status: sCoord >= 80 ? "good" : sCoord >= 50 ? "warning" : "bad",
    feedback: hasEmail && hasPhone
      ? "Email et telephone detectes — coordonnees completes."
      : hasEmail
      ? "Email present mais telephone manquant."
      : "Ajoute au minimum un email et un telephone pour etre contactable.",
  });

  sections.push({
    name: mode === "observation" ? "Etablissement scolaire" : "Formation",
    score: sFormation,
    status: sFormation >= 80 ? "good" : sFormation >= 50 ? "warning" : "bad",
    feedback: hasFormation
      ? mode === "observation"
        ? "Classe et etablissement detectes — bonne base."
        : "Formation bien renseignee. Verifie les dates et l'etablissement."
      : mode === "observation"
      ? "Ajoute ta classe (3eme, Seconde...) et le nom de ton college/lycee."
      : "Section formation non detectee. Ajoute ton niveau et ton etablissement.",
  });

  sections.push({
    name: mode === "observation" ? "Centres d'interet & Motivations" : "Experience",
    score: sExperience,
    status: sExperience >= 70 ? "good" : sExperience >= 45 ? "warning" : "bad",
    feedback: hasExperience
      ? mode === "observation"
        ? "Activites et centres d'interet detectes — ca donne de la personnalite a ton dossier !"
        : "Section experience identifiee. Verifie que chaque poste inclut des missions concretes."
      : mode === "observation"
      ? "Ajoute tes loisirs et activites : sport, musique, benevolat, projets personnels..."
      : "Peu d'experience detectee. Mentionne tes projets, associations ou missions benevoles.",
  });

  sections.push({
    name: mode === "observation" ? "Savoir-faire & Competences" : "Competences cles",
    score: sCompetences,
    status: sCompetences >= 70 ? "good" : sCompetences >= 45 ? "warning" : "bad",
    feedback: hasSkills
      ? mode === "observation"
        ? "Quelques competences mentionnees. Tu peux ajouter bureautique, langues, activites manuelles..."
        : "Competences presentes. Verifie qu'elles correspondent aux mots-cles de l'offre."
      : mode === "observation"
      ? "Ajoute tes savoir-faire : langues, informatique, activites sportives ou artistiques..."
      : "Section competences peu visible. Cree une section dediee avec tes outils et savoir-faire.",
  });

  if (mode !== "observation") {
    sections.push({
      name: "Impact & Chiffres",
      score: sChiffres,
      status: sChiffres >= 70 ? "good" : sChiffres >= 48 ? "warning" : "bad",
      feedback: hasMetrics
        ? "Des chiffres detectes — ton CV est plus credible et impactant."
        : mode === "pro"
        ? "Aucun chiffre. Quantifie tes realisations : %, CA, nombre de clients, budget, delais..."
        : "Essaie d'ajouter un chiffre : duree d'un projet, nombre de personnes impliquees...",
    });
  }

  if (mode === "pro") {
    sections.push({
      name: "Profil LinkedIn",
      score: sLinkedIn,
      status: sLinkedIn >= 70 ? "good" : "warning",
      feedback: hasLinkedIn
        ? "Profil LinkedIn mentionne — les recruteurs pourront verifier ton parcours."
        : "Ajoute ton URL LinkedIn. 87% des recruteurs le consultent avant de donner suite.",
    });
  }

  sections.push({
    name: "Longueur & Densite",
    score: longueurScore,
    status: longueurScore >= 80 ? "good" : longueurScore >= 50 ? "warning" : "bad",
    feedback: wordCount >= targetWords
      ? `Bonne longueur (${wordCount} mots) — le recruteur a assez d'elements pour te juger.`
      : `Dossier un peu court (${wordCount} mots). Vise ${targetWords}+ mots pour un contenu complet.`,
  });

  /* ── Suggestions adaptées au mode ── */
  const suggestions: string[] = [];

  if (mode === "observation") {
    if (!hasExperience)
      suggestions.push("Ajoute une section 'Centres d'interet' avec tes activites : sport, musique, benevolat, creation... ca humanise ton dossier.");
    if (!hasFormation)
      suggestions.push("Precise ta classe exacte (3eme A, Seconde 5...) et le nom de ton college ou lycee.");
    if (!hasEmail && !hasPhone)
      suggestions.push("Ajoute tes coordonnees — email et telephone — indispensables pour que l'entreprise te rappelle.");
    suggestions.push("Pour un stage d'observation, un paragraphe de motivation de 3-4 lignes suffit : explique pourquoi CE secteur t'interesse.");
    if (wordCount < 80)
      suggestions.push("Ton dossier est tres court. Ajoute quelques phrases sur qui tu es et ce que tu esperes decouvrir lors de ce stage.");
    suggestions.push("Pas besoin d'experience pro : parle de tes projets scolaires, des matieres que tu aimes, et de ce qui t'a attire vers ce domaine.");
  } else if (mode === "stage") {
    if (!hasExperience)
      suggestions.push("Pas encore d'experience ? C'est normal. Mets en avant projets scolaires, associations, babysitting, aide en famille...");
    if (!hasFormation)
      suggestions.push("Precise ton niveau (BTS, Licence...), ta specialite et ton etablissement avec les annees.");
    if (!hasMetrics)
      suggestions.push("Ajoute au moins 1 chiffre : duree d'un projet, taille d'equipe, nombre de publications gerees...");
    if (hasJobDesc && missing.length > 4)
      suggestions.push(`Il manque ${missing.length} mots-cles de l'offre. Integre-les naturellement si tu possedes ces competences.`);
    suggestions.push("Utilise des verbes d'action au debut de chaque mission : gere, cree, participe, analyse, redige, coordonne...");
    if (wordCount < 180)
      suggestions.push("Ton CV semble court. Developpe tes missions et ajoute tes projets personnels ou scolaires.");
  } else {
    if (!hasLinkedIn)
      suggestions.push("Ajoute ton URL LinkedIn complete. Les recruteurs le consultent systematiquement avant de donner suite.");
    if (!hasMetrics)
      suggestions.push("Quantifie chaque realisation : +20% de ventes, gestion de 5 clients, budget 10k€, livraison en 3 semaines...");
    if (hasJobDesc && missing.length > 4)
      suggestions.push(`Tes ${missing.length} mots-cles manquants sont importants. Integre-les dans tes descriptions si c'est legitime.`);
    if (!hasExperience)
      suggestions.push("Section experience peu lisible pour un ATS. Utilise un titre clair : 'Experiences professionnelles' ou 'Parcours'.");
    suggestions.push("Chaque mission : Verbe d'action + Contexte + Resultat mesurable. Ex : 'Gere 3 reseaux sociaux, +40% d'engagement en 2 mois'.");
    if (wordCount > 600)
      suggestions.push("CV trop long. Un recruteur scanne en 7 secondes. Vise 400-550 mots, supprime ce qui n'est pas pertinent pour ce poste.");
  }

  return {
    score,
    matchedKeywords: matched.slice(0, 20),
    missingKeywords: missing,
    suggestions: suggestions.slice(0, 5),
    sections,
    topJobKeywords,
    mode,
    hasJobDesc,
  };
}
