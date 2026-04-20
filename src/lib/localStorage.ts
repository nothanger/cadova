
const STORAGE_KEYS = {
  CURRENT_USER: "cadova_current_user",
  USERS: "cadova_users",
  CVS: "cadova_cvs",
  COVER_LETTERS: "cadova_cover_letters",
  ATS_ANALYSES: "cadova_ats_analyses",
  INTERVIEWS: "cadova_interviews",
  APPLICATIONS: "cadova_applications",
  EMAIL_TEMPLATES: "cadova_email_templates",
  EMAILS_SENT: "cadova_emails_sent",
  LINKEDIN_ANALYSES: "cadova_linkedin_analyses",
};


export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  createdAt: string;
  subscription: "free" | "pro" | "premium";
  credits: {
    cv: number;
    coverLetter: number;
    atsAnalysis: number;
    interview: number;
  };
}

export interface Session {
  user: User;
  expiresAt: string;
}

const getUsers = (): User[] => {
  const usersJson = localStorage.getItem(STORAGE_KEYS.USERS);
  return usersJson ? JSON.parse(usersJson) : [];
};

const saveUsers = (users: User[]) => {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
};


export const signup = async (
  email: string,
  password: string,
  name: string
): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    const users = getUsers();

    
    if (users.some((u) => u.email === email)) {
      return { success: false, error: "Un compte existe déjà avec cet email" };
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      name,
      password, 
      createdAt: new Date().toISOString(),
      subscription: "free",
      credits: {
        cv: 3,
        coverLetter: 2,
        atsAnalysis: 1,
        interview: 1,
      },
    };

    users.push(newUser);
    saveUsers(users);

    return { success: true, user: newUser };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};


export const signin = async (
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    const users = getUsers();
    const user = users.find((u) => u.email === email && u.password === password);

    if (!user) {
      return { success: false, error: "Email ou mot de passe incorrect" };
    }

    
    const session: Session = {
      user,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), 
    };

    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(session));

    return { success: true, user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const signout = () => {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
};


export const getSession = (): Session | null => {
  const sessionJson = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (!sessionJson) return null;

  const session: Session = JSON.parse(sessionJson);

 
  if (new Date(session.expiresAt) < new Date()) {
    signout();
    return null;
  }

  return session;
};


export const getCurrentUser = (): User | null => {
  const session = getSession();
  return session?.user || null;
};


export const updateProfile = (updates: Partial<User>): boolean => {
  try {
    const session = getSession();
    if (!session) return false;

    const users = getUsers();
    const userIndex = users.findIndex((u) => u.id === session.user.id);

    if (userIndex === -1) return false;

    users[userIndex] = { ...users[userIndex], ...updates };
    saveUsers(users);

  
    session.user = users[userIndex];
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(session));

    return true;
  } catch {
    return false;
  }
};



export interface CV {
  id: string;
  userId: string;
  title: string;
  content: any;
  createdAt: string;
  updatedAt: string;
}

export interface CoverLetter {
  id: string;
  userId: string;
  title: string;
  company: string;
  position: string;
  content: string;
  templateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ATSAnalysis {
  id: string;
  userId: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  missingKeywords: string[];
  matchedKeywords: string[];
  suggestions: string[];
  analyzedAt: string;
}

export type ApplicationStatus =
  | "À envoyer"
  | "Envoyé"
  | "Relance à faire"
  | "Relancé"
  | "Entretien"
  | "Refusé"
  | "Accepté";

export type ApplicationType = "stage" | "alternance" | "job";

export interface Application {
  id: string;
  userId: string;
  company: string;
  position: string;
  type: ApplicationType;
  status: ApplicationStatus;
  appliedAt: string;
  followUpDate: string;
  email: string;
  link: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  userId: string;
  name: string;
  subject: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailSent {
  id: string;
  userId: string;
  candidatureId: string;
  recipient: string;
  subject: string;
  content: string;
  status: "sent" | "queued";
  sentAt: string;
}

export interface LinkedInAnalysis {
  id: string;
  userId: string;
  score: number;
  strengths: string[];
  improvements: string[];
  suggestedSummary: string;
  suggestedSkills: string[];
  analyzedAt: string;
}

export interface InterviewSession {
  id: string;
  userId: string;
  type: string;
  sector?: string;
  score: number;
  questionsCount: number;
  completedAt: string;
}

export const getInterviewSessions = (userId: string): InterviewSession[] => {
  return getItems<InterviewSession>(STORAGE_KEYS.INTERVIEWS, userId);
};

export const saveInterviewSession = (
  sessionData: Omit<InterviewSession, "id" | "completedAt">
): InterviewSession => {
  const session: InterviewSession = {
    ...sessionData,
    id: crypto.randomUUID(),
    completedAt: new Date().toISOString(),
  };
  return addItem(STORAGE_KEYS.INTERVIEWS, session);
};


const getItems = <T>(key: string, userId?: string): T[] => {
  const itemsJson = localStorage.getItem(key);
  const items = itemsJson ? JSON.parse(itemsJson) : [];

  if (userId) {
    return items.filter((item: any) => item.userId === userId);
  }

  return items;
};

const saveItems = <T>(key: string, items: T[]) => {
  localStorage.setItem(key, JSON.stringify(items));
};

const addItem = <T extends { id: string; userId: string }>(key: string, item: T): T => {
  const items = getItems<T>(key);
  items.push(item);
  saveItems(key, items);
  return item;
};

const updateItem = <T extends { id: string; userId: string }>(
  key: string,
  id: string,
  updates: Partial<T>
): T | null => {
  const items = getItems<T>(key);
  const index = items.findIndex((item: any) => item.id === id);

  if (index === -1) return null;

  items[index] = { ...items[index], ...updates };
  saveItems(key, items);
  return items[index];
};

const deleteItem = <T extends { id: string }>(key: string, id: string): boolean => {
  const items = getItems<T>(key);
  const filtered = items.filter((item) => item.id !== id);

  if (filtered.length === items.length) return false;

  saveItems(key, filtered);
  return true;
};



export const getCVs = (userId: string): CV[] => {
  return getItems<CV>(STORAGE_KEYS.CVS, userId);
};

export const saveCV = (cvData: Omit<CV, "id" | "createdAt" | "updatedAt">): CV => {
  const cv: CV = {
    ...cvData,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return addItem(STORAGE_KEYS.CVS, cv);
};

export const deleteCV = (id: string): boolean => {
  return deleteItem(STORAGE_KEYS.CVS, id);
};



export const getCoverLetters = (userId: string): CoverLetter[] => {
  return getItems<CoverLetter>(STORAGE_KEYS.COVER_LETTERS, userId);
};

export const saveCoverLetter = (
  letterData: Omit<CoverLetter, "id" | "createdAt" | "updatedAt">
): CoverLetter => {
  const letter: CoverLetter = {
    ...letterData,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return addItem(STORAGE_KEYS.COVER_LETTERS, letter);
};

export const deleteCoverLetter = (id: string): boolean => {
  return deleteItem(STORAGE_KEYS.COVER_LETTERS, id);
};


export const getATSAnalyses = (userId: string): ATSAnalysis[] => {
  return getItems<ATSAnalysis>(STORAGE_KEYS.ATS_ANALYSES, userId);
};

export const saveATSAnalysis = (
  analysisData: Omit<ATSAnalysis, "id" | "analyzedAt">
): ATSAnalysis => {
  const analysis: ATSAnalysis = {
    ...analysisData,
    id: crypto.randomUUID(),
    analyzedAt: new Date().toISOString(),
  };
  return addItem(STORAGE_KEYS.ATS_ANALYSES, analysis);
};



export const getApplications = (userId: string): Application[] => {
  const statusMap: Record<string, ApplicationStatus> = {
    sent: "Envoyé",
    interview: "Entretien",
    offer: "Accepté",
    rejected: "Refusé",
  };
  return getItems<Application>(STORAGE_KEYS.APPLICATIONS, userId).map((item: any) => ({
    ...item,
    type: item.type || "stage",
    status: statusMap[item.status] || item.status || "À envoyer",
    appliedAt: item.appliedAt || item.applied_at || "",
    followUpDate: item.followUpDate || item.follow_up_date || "",
    email: item.email || "",
    link: item.link || "",
  }));
};

export const saveApplication = (
  appData: Omit<Application, "id" | "createdAt" | "updatedAt">
): Application => {
  const application: Application = {
    ...appData,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return addItem(STORAGE_KEYS.APPLICATIONS, application);
};

export const updateApplication = (
  id: string,
  updates: Partial<Application>
): Application | null => {
  return updateItem(STORAGE_KEYS.APPLICATIONS, id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
};

export const deleteApplication = (id: string): boolean => {
  return deleteItem(STORAGE_KEYS.APPLICATIONS, id);
};

export const getEmailTemplates = (userId: string): EmailTemplate[] => {
  return getItems<EmailTemplate>(STORAGE_KEYS.EMAIL_TEMPLATES, userId);
};

export const saveEmailTemplate = (
  templateData: Omit<EmailTemplate, "id" | "createdAt" | "updatedAt">
): EmailTemplate => {
  const template: EmailTemplate = {
    ...templateData,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return addItem(STORAGE_KEYS.EMAIL_TEMPLATES, template);
};

export const updateEmailTemplate = (
  id: string,
  updates: Partial<EmailTemplate>
): EmailTemplate | null => {
  return updateItem(STORAGE_KEYS.EMAIL_TEMPLATES, id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
};

export const getEmailsSent = (userId: string): EmailSent[] => {
  return getItems<EmailSent>(STORAGE_KEYS.EMAILS_SENT, userId);
};

export const getEmailsForApplication = (userId: string, candidatureId: string): EmailSent[] => {
  return getEmailsSent(userId).filter((email) => email.candidatureId === candidatureId);
};

export const saveEmailSent = (emailData: Omit<EmailSent, "id" | "sentAt">): EmailSent => {
  const email: EmailSent = {
    ...emailData,
    id: crypto.randomUUID(),
    sentAt: new Date().toISOString(),
  };
  return addItem(STORAGE_KEYS.EMAILS_SENT, email);
};



export const getLinkedInAnalyses = (userId: string): LinkedInAnalysis[] => {
  return getItems<LinkedInAnalysis>(STORAGE_KEYS.LINKEDIN_ANALYSES, userId);
};

export const saveLinkedInAnalysis = (
  analysisData: Omit<LinkedInAnalysis, "id" | "analyzedAt">
): LinkedInAnalysis => {
  const analysis: LinkedInAnalysis = {
    ...analysisData,
    id: crypto.randomUUID(),
    analyzedAt: new Date().toISOString(),
  };
  return addItem(STORAGE_KEYS.LINKEDIN_ANALYSES, analysis);
};



export const generateMockData = () => {
  if (getUsers().length === 0) {
    signup("demo@cadova.fr", "demo123", "Utilisateur Demo");
  }
};
