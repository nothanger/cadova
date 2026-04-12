/**
 * oralia-data.ts — Logique et données pour OralIA (simulation d'entretien)
 * Entièrement basé sur des templates, règles et analyse textuelle locale.
 * Aucune IA externe.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type InterviewType = "stage" | "alternance" | "emploi" | "parcoursup" | "ecole";
export type QuestionCategory = "presentation" | "motivation" | "situation" | "competence" | "finale";

export interface InterviewQuestion {
  id: string;
  category: QuestionCategory;
  text: string;
  tip: string;          // Conseil affiché avant de répondre
  keywords: string[];   // Mots-clés attendus pour le scoring
  starRequired: boolean; // True = on attend une structure STAR
}

export interface AnswerFeedback {
  score: number;              // 0-100
  scoreLabel: string;         // "Excellent" | "Bon" | "A améliorer" | "Insuffisant"
  scoreColor: string;
  strengths: string[];
  improvements: string[];
  tip: string;                // Conseil personnalisé
  wordCount: number;
  starDetected: { situation: boolean; task: boolean; action: boolean; result: boolean };
}

// ─────────────────────────────────────────────────────────────────────────────
// BANQUE DE QUESTIONS — organisée par type d'entretien
// ─────────────────────────────────────────────────────────────────────────────

const PRESENTATION_QUESTIONS: InterviewQuestion[] = [
  {
    id: "p1",
    category: "presentation",
    text: "Bonjour, merci d'être là. Pouvez-vous commencer par vous présenter en 2 à 3 minutes ?",
    tip: "Structurez votre présentation : qui vous êtes → votre formation → vos expériences → vos motivations. Restez concis mais précis.",
    keywords: ["formation", "etude", "ecole", "universite", "bac", "master", "licence", "stage", "experience", "projet"],
    starRequired: false,
  },
  {
    id: "p2",
    category: "presentation",
    text: "Dites-moi, en quelques mots, quel est votre parcours et ce qui vous a conduit à postuler ici ?",
    tip: "Racontez votre histoire de façon chronologique et montrez que votre candidature est cohérente avec votre parcours.",
    keywords: ["parcours", "choix", "poste", "entreprise", "formation", "objectif", "projet"],
    starRequired: false,
  },
];

const MOTIVATION_QUESTIONS: Record<InterviewType, InterviewQuestion[]> = {
  stage: [
    {
      id: "m_stage_1",
      category: "motivation",
      text: "Pourquoi avez-vous choisi cette entreprise pour votre stage ?",
      tip: "Montrez que vous avez fait des recherches sur l'entreprise. Citez des éléments concrets : leurs valeurs, un projet récent, leur secteur.",
      keywords: ["entreprise", "valeur", "secteur", "produit", "service", "mission", "equipe", "culture"],
      starRequired: false,
    },
    {
      id: "m_stage_2",
      category: "motivation",
      text: "Qu'est-ce que vous espérez apprendre ou développer lors de ce stage ?",
      tip: "Soyez précis sur les compétences que vous voulez acquérir. Montrez que vous avez réfléchi à votre développement professionnel.",
      keywords: ["apprendre", "developper", "competence", "objectif", "progresser", "decouvrir", "maitriser"],
      starRequired: false,
    },
    {
      id: "m_stage_3",
      category: "motivation",
      text: "Comment ce stage s'inscrit-il dans votre projet professionnel ?",
      tip: "Montrez la cohérence entre ce stage et vos ambitions futures. Les recruteurs apprécient les candidats qui ont une vision.",
      keywords: ["projet", "avenir", "futur", "carriere", "objectif", "ambition", "metier", "secteur"],
      starRequired: false,
    },
  ],
  alternance: [
    {
      id: "m_alt_1",
      category: "motivation",
      text: "Pourquoi avez-vous choisi l'alternance plutôt qu'une formation classique ?",
      tip: "Valorisez la dimension professionnelle et la double apprentissage. Montrez votre maturité dans ce choix.",
      keywords: ["pratique", "terrain", "experience", "entreprise", "ecole", "equiliibrer", "competence", "professionnel"],
      starRequired: false,
    },
    {
      id: "m_alt_2",
      category: "motivation",
      text: "Comment envisagez-vous de gérer le rythme entreprise / école ?",
      tip: "Montrez votre organisation, votre capacité à prioriser et votre sérieux face à cette double exigence.",
      keywords: ["organisation", "planning", "agenda", "priorite", "gestion", "rythme", "equilibre"],
      starRequired: false,
    },
    {
      id: "m_alt_3",
      category: "motivation",
      text: "Pourquoi notre entreprise pour votre alternance ?",
      tip: "Citez des éléments précis de l'entreprise. Les entreprises apprécient que vous ayez fait vos devoirs avant l'entretien.",
      keywords: ["entreprise", "secteur", "valeur", "mission", "equipe", "projet", "culture", "opportunite"],
      starRequired: false,
    },
  ],
  emploi: [
    {
      id: "m_emp_1",
      category: "motivation",
      text: "Qu'est-ce qui vous a attiré dans cette offre d'emploi en particulier ?",
      tip: "Soyez précis. Citez 2 ou 3 éléments de l'offre qui vous ont motivé, et expliquez pourquoi ils correspondent à votre profil.",
      keywords: ["offre", "poste", "mission", "competence", "defi", "responsabilite", "equipe", "projet"],
      starRequired: false,
    },
    {
      id: "m_emp_2",
      category: "motivation",
      text: "Où vous voyez-vous dans 3 à 5 ans ?",
      tip: "Montrez de l'ambition réaliste. Vous pouvez exprimer une évolution en lien avec l'entreprise, sans paraître trop calculateur.",
      keywords: ["evolution", "responsabilite", "expertise", "management", "projet", "secteur", "objectif"],
      starRequired: false,
    },
    {
      id: "m_emp_3",
      category: "motivation",
      text: "Pourquoi souhaitez-vous quitter votre poste actuel / votre formation ?",
      tip: "Restez positif. Ne critiquez jamais votre employeur précédent. Parlez de vos aspirations plutôt que de ce que vous fuyez.",
      keywords: ["evolution", "nouveau", "defi", "opportunite", "progression", "apprentissage", "envie"],
      starRequired: false,
    },
  ],
  parcoursup: [
    {
      id: "m_ps_1",
      category: "motivation",
      text: "Pourquoi cette formation est-elle faite pour vous ?",
      tip: "Montrez que vous avez compris le contenu et les débouchés de la formation. Faites le lien avec votre profil scolaire et extra-scolaire.",
      keywords: ["formation", "programme", "contenu", "debouche", "metier", "passion", "interet", "matiere"],
      starRequired: false,
    },
    {
      id: "m_ps_2",
      category: "motivation",
      text: "Quel est votre projet professionnel à l'issue de cette formation ?",
      tip: "Ayez une vision claire. Même si elle est amenée à évoluer, montrez que vous avez réfléchi à votre avenir.",
      keywords: ["projet", "metier", "futur", "apres", "diplome", "carriere", "objectif", "ambition"],
      starRequired: false,
    },
    {
      id: "m_ps_3",
      category: "motivation",
      text: "Qu'est-ce qui vous différencie des autres candidats à cette formation ?",
      tip: "C'est le moment de valoriser vos singularités : activités extra-scolaires, projets personnels, expériences atypiques.",
      keywords: ["passion", "projet", "experience", "activite", "different", "unique", "atout", "qualite"],
      starRequired: false,
    },
  ],
  ecole: [
    {
      id: "m_ec_1",
      category: "motivation",
      text: "Pourquoi avez-vous choisi de candidater dans notre école ?",
      tip: "Montrez que vous connaissez l'école : son classement, ses spécialités, ses partenariats, son réseau alumni.",
      keywords: ["ecole", "programme", "reputation", "specialite", "reseau", "alumni", "partenaire", "valeur"],
      starRequired: false,
    },
    {
      id: "m_ec_2",
      category: "motivation",
      text: "Comment comptez-vous réussir dans notre programme ?",
      tip: "Parlez de votre méthode de travail, votre organisation, et des ressources que vous comptez utiliser.",
      keywords: ["methode", "travail", "organisation", "rigueur", "investissement", "ressource", "engagement"],
      starRequired: false,
    },
    {
      id: "m_ec_3",
      category: "motivation",
      text: "Quelles activités ou projets extra-scolaires souhaitez-vous développer au sein de notre école ?",
      tip: "Les écoles valorisent l'implication dans la vie associative et les projets collectifs. Montrez que vous êtes actif.",
      keywords: ["association", "projet", "club", "sport", "humanitaire", "entreprendre", "initier", "animer"],
      starRequired: false,
    },
  ],
};

const SITUATION_QUESTIONS: InterviewQuestion[] = [
  {
    id: "s1",
    category: "situation",
    text: "Parlez-moi d'une situation où vous avez dû résoudre un problème difficile. Comment avez-vous procédé ?",
    tip: "Utilisez la méthode STAR : Situation → Tâche → Action → Résultat. Soyez concret et donnez des chiffres si possible.",
    keywords: ["situation", "probleme", "difficulte", "solution", "action", "resultat", "resolu", "reussi"],
    starRequired: true,
  },
  {
    id: "s2",
    category: "situation",
    text: "Décrivez une expérience où vous avez dû travailler en équipe sur un projet. Quel était votre rôle ?",
    tip: "Valorisez autant votre contribution individuelle que votre capacité à collaborer et à soutenir l'équipe.",
    keywords: ["equipe", "collaboration", "role", "contribution", "projet", "ensemble", "groupe", "coequipier"],
    starRequired: true,
  },
  {
    id: "s3",
    category: "situation",
    text: "Racontez-moi une fois où vous avez échoué ou commis une erreur. Qu'avez-vous appris de cette expérience ?",
    tip: "L'honnêteté est valorisée. Montrez que vous avez tiré des leçons concrètes et que vous avez su rebondir.",
    keywords: ["echec", "erreur", "lecon", "apris", "ameliore", "rebondi", "consequence", "retenir"],
    starRequired: true,
  },
  {
    id: "s4",
    category: "situation",
    text: "Donnez-moi un exemple d'une situation où vous avez dû gérer plusieurs tâches simultanément sous pression.",
    tip: "Montrez votre capacité à prioriser, à rester calme et à maintenir la qualité même sous contrainte.",
    keywords: ["priorite", "organisation", "planning", "stress", "pression", "gere", "delai", "urgence"],
    starRequired: true,
  },
  {
    id: "s5",
    category: "situation",
    text: "Parlez-moi d'un projet dont vous êtes particulièrement fier(e). Pourquoi ce projet vous tient-il à cœur ?",
    tip: "Choisissez un exemple qui met en avant vos compétences clés et qui montre votre engagement personnel.",
    keywords: ["fier", "projet", "reussite", "accomplissement", "impact", "objectif", "atteint", "resultat"],
    starRequired: true,
  },
  {
    id: "s6",
    category: "situation",
    text: "Comment gérez-vous une situation de désaccord avec un collègue, un supérieur ou un professeur ?",
    tip: "Montrez votre intelligence émotionnelle. Les recruteurs cherchent quelqu'un qui sait écouter et trouver des compromis.",
    keywords: ["ecoute", "dialogue", "compromis", "respect", "opinion", "explication", "accord", "solution"],
    starRequired: false,
  },
];

const COMPETENCE_QUESTIONS: Record<InterviewType, InterviewQuestion[]> = {
  stage: [
    {
      id: "c_stage_1",
      category: "competence",
      text: "Quelles compétences techniques pensez-vous pouvoir apporter dès le premier jour ?",
      tip: "Soyez honnête sur votre niveau. Mieux vaut sous-promettre et sur-délivrer que l'inverse.",
      keywords: ["competence", "maitrise", "connaissance", "outil", "logiciel", "technique", "savoir-faire"],
      starRequired: false,
    },
    {
      id: "c_stage_2",
      category: "competence",
      text: "Comment vous organisez-vous pour apprendre rapidement dans un nouveau contexte ?",
      tip: "Montrez votre autonomie, votre curiosité et vos méthodes d'apprentissage.",
      keywords: ["apprendre", "methode", "organisation", "curiosite", "autonome", "initiative", "documentation"],
      starRequired: false,
    },
  ],
  alternance: [
    {
      id: "c_alt_1",
      category: "competence",
      text: "Quels outils ou logiciels maîtrisez-vous et qui pourraient être utiles dans ce poste ?",
      tip: "Citez des outils précis avec votre niveau réel. Ne mentez jamais sur vos compétences techniques.",
      keywords: ["outil", "logiciel", "maitrise", "utilise", "competence", "technique", "pratique"],
      starRequired: false,
    },
    {
      id: "c_alt_2",
      category: "competence",
      text: "Comment gérez-vous votre temps entre les cours et vos obligations professionnelles ?",
      tip: "Parlez de méthodes concrètes : agenda, to-do list, time-blocking. Montrez votre sérieux.",
      keywords: ["agenda", "organisation", "planning", "priorite", "gestion", "temps", "equilibre"],
      starRequired: false,
    },
  ],
  emploi: [
    {
      id: "c_emp_1",
      category: "competence",
      text: "Quels sont vos principaux points forts qui vous rendent légitime pour ce poste ?",
      tip: "Citez 3 forces concrètes avec des exemples. Évitez les qualités génériques sans illustration.",
      keywords: ["force", "competence", "experience", "qualite", "maitrise", "resultat", "exemple", "concret"],
      starRequired: false,
    },
    {
      id: "c_emp_2",
      category: "competence",
      text: "Comment restez-vous à jour dans votre domaine d'expertise ?",
      tip: "Montrez votre veille professionnelle : newsletters, podcasts, formations, conférences, réseau...",
      keywords: ["veille", "formation", "actualite", "reseau", "apprendre", "evoluer", "newsletter", "podcast"],
      starRequired: false,
    },
  ],
  parcoursup: [
    {
      id: "c_ps_1",
      category: "competence",
      text: "Quelles matières vous ont le plus intéressé(e) jusqu'ici et pourquoi ?",
      tip: "Choisissez des matières en lien avec la formation visée. Expliquez ce qui vous passionne vraiment.",
      keywords: ["matiere", "interesse", "passion", "cours", "discipline", "apprendre", "comprendre"],
      starRequired: false,
    },
    {
      id: "c_ps_2",
      category: "competence",
      text: "Décrivez une activité extra-scolaire qui vous a appris quelque chose d'important.",
      tip: "Valorisez le sport, le bénévolat, les projets personnels, la musique... Montrez ce que vous en avez retiré.",
      keywords: ["activite", "sport", "association", "projet", "benevole", "appris", "competence", "experience"],
      starRequired: false,
    },
  ],
  ecole: [
    {
      id: "c_ec_1",
      category: "competence",
      text: "Quelles compétences pensez-vous devoir développer prioritairement dans notre école ?",
      tip: "Montrez votre conscience de vos lacunes. Les écoles valorisent les candidats qui ont une vision réaliste d'eux-mêmes.",
      keywords: ["developper", "progresser", "ameliorer", "competence", "axe", "priorite", "besoin"],
      starRequired: false,
    },
    {
      id: "c_ec_2",
      category: "competence",
      text: "Comment décririez-vous votre méthode de travail et comment vous adaptez-vous à différents types de cours ?",
      tip: "Parlez de flexibilité, d'adaptation, de méthodes d'apprentissage différentes selon le contexte.",
      keywords: ["methode", "adaptation", "flexible", "organisation", "apprentissage", "rigoureux", "rigueur"],
      starRequired: false,
    },
  ],
};

const FINALE_QUESTIONS: InterviewQuestion[] = [
  {
    id: "f1",
    category: "finale",
    text: "Quels sont vos principaux axes d'amélioration ? Qu'est-ce que vous travaillez activement pour progresser ?",
    tip: "Soyez honnête mais stratégique. Choisissez une vraie faiblesse que vous êtes en train de corriger activement.",
    keywords: ["ameliorer", "progresser", "travailler", "axe", "faiblesse", "developper", "effort", "conscience"],
    starRequired: false,
  },
  {
    id: "f2",
    category: "finale",
    text: "Avez-vous des questions à nous poser sur le poste ou sur l'entreprise ?",
    tip: "TOUJOURS poser des questions ! Préparez au moins 3 questions : sur les missions, l'équipe, les perspectives, la culture.",
    keywords: ["question", "equipe", "mission", "perspective", "culture", "journee", "objectif", "attente"],
    starRequired: false,
  },
  {
    id: "f3",
    category: "finale",
    text: "Si vous étiez retenu(e), quelle serait votre priorité dans les premières semaines ?",
    tip: "Montrez votre sens de l'adaptation : écouter, observer, comprendre l'équipe et les processus avant d'agir.",
    keywords: ["ecouter", "observer", "comprendre", "equipe", "processus", "priorite", "adapter", "integration"],
    starRequired: false,
  },
  {
    id: "f4",
    category: "finale",
    text: "Comment décrieriez-vous le candidat idéal pour ce poste ? Et en quoi vous en rapprochez-vous ?",
    tip: "C'est l'occasion de résumer vos atouts de façon synthétique. Soyez confiant sans être arrogant.",
    keywords: ["competence", "qualite", "profil", "atout", "correspond", "maitrise", "experience", "valeur"],
    starRequired: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SÉLECTION DES QUESTIONS POUR UNE SESSION
// ─────────────────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export function buildInterviewSession(
  type: InterviewType,
  _sector?: string
): InterviewQuestion[] {
  const session: InterviewQuestion[] = [];

  // 1. Question de présentation (1)
  session.push(pickRandom(PRESENTATION_QUESTIONS, 1)[0]);

  // 2. Questions de motivation spécifiques au type (2)
  const motivations = MOTIVATION_QUESTIONS[type] || MOTIVATION_QUESTIONS.stage;
  session.push(...pickRandom(motivations, 2));

  // 3. Questions de situation (2)
  session.push(...pickRandom(SITUATION_QUESTIONS, 2));

  // 4. Question de compétence spécifique au type (1)
  const competences = COMPETENCE_QUESTIONS[type] || COMPETENCE_QUESTIONS.stage;
  session.push(pickRandom(competences, 1)[0]);

  // 5. Question finale (1)
  session.push(pickRandom(FINALE_QUESTIONS, 1)[0]);

  return session;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTEUR D'ANALYSE DES RÉPONSES — 100% logique locale
// ─────────────────────────────────────────────────────────────────────────────

const STAR_KEYWORDS = {
  situation: ["situation", "contexte", "lors", "quand", "lorsque", "pendant", "etais", "travaillais", "j'etudiais", "face a"],
  task: ["tache", "mission", "objectif", "defi", "role", "responsable", "charge", "devais", "fallait", "attendait"],
  action: ["j'ai", "j'ai fait", "j'ai decide", "j'ai mis", "j'ai propose", "j'ai contacte", "j'ai cree", "j'ai organise", "j'ai pris", "j'ai commence", "j'ai demande", "j'ai choisi", "j'ai analyse", "j'ai identifie"],
  result: ["resultat", "j'ai obtenu", "grace a", "ce qui a permis", "j'ai reussi", "finalement", "au final", "en conclusion", "on a atteint", "cela a", "impact", "ameliore", "augmente", "reduit", "gagne"],
};

const POSITIVE_CONNECTORS = [
  "par exemple", "notamment", "concretement", "en particulier", "precisement",
  "pour illustrer", "c'est pourquoi", "c'est ainsi", "de cette facon",
];

function detectSTAR(text: string): { situation: boolean; task: boolean; action: boolean; result: boolean } {
  const lower = text.toLowerCase();
  return {
    situation: STAR_KEYWORDS.situation.some((k) => lower.includes(k)),
    task: STAR_KEYWORDS.task.some((k) => lower.includes(k)),
    action: STAR_KEYWORDS.action.some((k) => lower.includes(k)),
    result: STAR_KEYWORDS.result.some((k) => lower.includes(k)),
  };
}

function getWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function detectNumbers(text: string): boolean {
  return /\d+/.test(text);
}

function detectExamples(text: string): boolean {
  const lower = text.toLowerCase();
  return POSITIVE_CONNECTORS.some((c) => lower.includes(c));
}

function detectKeywords(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter((k) => lower.includes(k.toLowerCase())).length;
}

function firstPersonVerbs(text: string): boolean {
  const lower = text.toLowerCase();
  return ["j'ai", "je suis", "j'etais", "je pense", "je me", "j'ai appris", "j'aime", "je crois"].some((v) =>
    lower.includes(v)
  );
}

export function analyzeAnswer(
  answer: string,
  question: InterviewQuestion
): AnswerFeedback {
  const wordCount = getWordCount(answer);
  const star = detectSTAR(answer);
  const hasNumbers = detectNumbers(answer);
  const hasExamples = detectExamples(answer);
  const keywordMatches = detectKeywords(answer, question.keywords);
  const hasFirstPerson = firstPersonVerbs(answer);

  // ── Scoring par composantes ──────────────────────────────────────────

  // 1. Longueur (40 pts max)
  let lengthScore = 0;
  if (wordCount < 15) lengthScore = 5;
  else if (wordCount < 40) lengthScore = 18;
  else if (wordCount < 80) lengthScore = 28;
  else if (wordCount < 180) lengthScore = 40;
  else if (wordCount < 280) lengthScore = 35;
  else lengthScore = 22; // trop long

  // 2. Structure STAR (30 pts max — seulement si starRequired)
  let starScore = 0;
  if (question.starRequired) {
    const starParts = [star.situation, star.task, star.action, star.result];
    const starCount = starParts.filter(Boolean).length;
    starScore = starCount * 7.5; // 7.5 pts par élément STAR
  } else {
    // Question non-STAR : récompense quand même la structure
    const starCount = [star.situation, star.task, star.action, star.result].filter(Boolean).length;
    starScore = Math.min(starCount * 5, 20);
  }

  // 3. Richesse du contenu (30 pts max)
  let contentScore = 0;
  contentScore += hasNumbers ? 10 : 0;
  contentScore += hasExamples ? 8 : 0;
  contentScore += hasFirstPerson ? 4 : 0;
  contentScore += Math.min(keywordMatches * 4, 8); // max 8 pts pour les keywords

  const rawScore = lengthScore + starScore + contentScore;
  const score = Math.min(100, Math.max(10, Math.round(rawScore)));

  // ── Génération du feedback ───────────────────────────────────────────

  const strengths: string[] = [];
  const improvements: string[] = [];

  // Longueur
  if (wordCount >= 80 && wordCount <= 250) {
    strengths.push("Bonne longueur de réponse — ni trop courte, ni trop longue");
  } else if (wordCount < 40) {
    improvements.push(`Réponse trop courte (${wordCount} mots) — développez davantage avec des exemples concrets`);
  } else if (wordCount > 280) {
    improvements.push("Réponse trop longue — entraînez-vous à être plus concis et percutant");
  }

  // STAR
  if (question.starRequired) {
    if (star.situation) strengths.push("Contexte / situation bien posé(e)");
    else improvements.push("Manque le contexte initial (Situation) — posez la scène en 1-2 phrases");
    if (star.action) strengths.push("Les actions entreprises sont bien décrites");
    else improvements.push("Précisez les actions concrètes que vous avez prises (verbes d'action à la 1ère personne)");
    if (star.result) strengths.push("Résultat mentionné — très bien !");
    else improvements.push("Concluez avec le résultat obtenu — les recruteurs adorent les exemples chiffrés");
    if (!star.task && !star.situation) {
      improvements.push("Appliquez la méthode STAR : Situation → Tâche → Action → Résultat");
    }
  } else {
    if (star.action && star.result) {
      strengths.push("Bonne articulation des actions et résultats");
    }
  }

  // Chiffres
  if (hasNumbers) {
    strengths.push("Excellente utilisation de chiffres — ça crédibilise votre discours");
  } else if (question.starRequired) {
    improvements.push("Ajoutez des chiffres ou métriques pour illustrer l'impact (%, délais, volumes...)");
  }

  // Exemples concrets
  if (hasExamples) {
    strengths.push("Bons exemples concrets utilisés");
  } else if (wordCount > 40 && improvements.length < 3) {
    improvements.push("Utilisez 'par exemple', 'notamment', 'concrètement' pour ancrer votre discours dans le réel");
  }

  // Keywords
  if (keywordMatches >= 3) {
    strengths.push("Vous utilisez les bons mots-clés pour ce type de question");
  } else if (keywordMatches === 0 && improvements.length < 3) {
    improvements.push("Essayez d'utiliser des mots directement liés à la question posée");
  }

  // Tip personnalisé selon le score
  let tip: string;
  if (score >= 85) {
    tip = "Excellent ! Cette réponse est de niveau professionnel. Gardez ce niveau tout au long de l'entretien.";
  } else if (score >= 70) {
    tip = "Bonne réponse. Un peu plus de concret (chiffres, exemples précis) et vous serez imbattable.";
  } else if (score >= 50) {
    tip = "Réponse correcte mais à enrichir. Structurez davantage et ajoutez des exemples issus de vos expériences réelles.";
  } else {
    tip = "Prenez le temps de bien structurer votre réponse avec la méthode STAR. Pratiquez à voix haute plusieurs fois.";
  }

  // Score label
  let scoreLabel: string;
  let scoreColor: string;
  if (score >= 85) { scoreLabel = "Excellent"; scoreColor = "#10B981"; }
  else if (score >= 70) { scoreLabel = "Bon"; scoreColor = "#5548F5"; }
  else if (score >= 50) { scoreLabel = "Moyen"; scoreColor = "#F59E0B"; }
  else { scoreLabel = "À améliorer"; scoreColor = "#EF4444"; }

  // Garantir au moins 1 force et 1 amélioration
  if (strengths.length === 0) {
    strengths.push(wordCount > 15 ? "Vous avez répondu à la question" : "Vous avez tenté une réponse");
  }
  if (improvements.length === 0) {
    improvements.push("Entraînez-vous à répondre à voix haute pour gagner en fluidité et en confiance");
  }

  return {
    score,
    scoreLabel,
    scoreColor,
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
    tip,
    wordCount,
    starDetected: star,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RAPPORT FINAL DE SESSION
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionReport {
  averageScore: number;
  scoreLabel: string;
  scoreColor: string;
  topStrengths: string[];
  topImprovements: string[];
  categoryScores: { label: string; score: number; color: string }[];
  globalTip: string;
}

export function buildSessionReport(
  feedbacks: AnswerFeedback[]
): SessionReport {
  if (feedbacks.length === 0) {
    return {
      averageScore: 0,
      scoreLabel: "—",
      scoreColor: "#9CA3AF",
      topStrengths: [],
      topImprovements: [],
      categoryScores: [],
      globalTip: "Commencez une session pour obtenir votre rapport.",
    };
  }

  const avg = Math.round(feedbacks.reduce((s, f) => s + f.score, 0) / feedbacks.length);

  const allStrengths = feedbacks.flatMap((f) => f.strengths);
  const allImprovements = feedbacks.flatMap((f) => f.improvements);

  // Déduplique en gardant les plus fréquentes
  const countMap = (arr: string[]) => {
    const map = new Map<string, number>();
    arr.forEach((s) => map.set(s, (map.get(s) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  };

  const starDetected = feedbacks.map((f) => f.starDetected);
  const starScores = {
    Contexte: Math.round((starDetected.filter((s) => s.situation).length / feedbacks.length) * 100),
    Action: Math.round((starDetected.filter((s) => s.action).length / feedbacks.length) * 100),
    Résultat: Math.round((starDetected.filter((s) => s.result).length / feedbacks.length) * 100),
    Structure: Math.min(100, avg + 5),
  };

  const categoryScores = [
    { label: "Score global", score: avg, color: avg >= 70 ? "#5548F5" : "#F59E0B" },
    { label: "Méthode STAR", score: starScores.Action, color: "#EC4899" },
    { label: "Exemples concrets", score: starScores.Résultat, color: "#10B981" },
    { label: "Richesse du contenu", score: starScores.Structure, color: "#8B5CF6" },
  ];

  let scoreLabel: string;
  let scoreColor: string;
  if (avg >= 85) { scoreLabel = "Excellent"; scoreColor = "#10B981"; }
  else if (avg >= 70) { scoreLabel = "Bon niveau"; scoreColor = "#5548F5"; }
  else if (avg >= 50) { scoreLabel = "Moyen"; scoreColor = "#F59E0B"; }
  else { scoreLabel = "À travailler"; scoreColor = "#EF4444"; }

  let globalTip: string;
  if (avg >= 85) {
    globalTip = "Vous êtes prêt(e) pour un vrai entretien ! Relisez vos meilleures réponses et gardez ce niveau de précision et de structure.";
  } else if (avg >= 70) {
    globalTip = "Bon niveau général. Pour progresser, concentrez-vous sur l'ajout de chiffres et de résultats mesurables dans vos exemples.";
  } else if (avg >= 50) {
    globalTip = "Des bases solides mais à consolider. Pratiquez la méthode STAR quotidiennement et notez 5 situations clés de votre parcours à réutiliser.";
  } else {
    globalTip = "N'abandonnez pas ! L'entretien s'apprend. Préparez 3 histoires STAR de votre parcours et entraînez-vous à les raconter à voix haute.";
  }

  return {
    averageScore: avg,
    scoreLabel,
    scoreColor,
    topStrengths: countMap(allStrengths).slice(0, 3),
    topImprovements: countMap(allImprovements).slice(0, 3),
    categoryScores,
    globalTip,
  };
}
