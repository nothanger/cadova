// Local Storage Management for Cadova
// Remplace Supabase pour la compatibilité avec Figma Make

const STORAGE_KEYS = {
  CURRENT_USER: "cadova_current_user",
  USERS: "cadova_users",
  CVS: "cadova_cvs",
  COVER_LETTERS: "cadova_cover_letters",
  ATS_ANALYSES: "cadova_ats_analyses",
  INTERVIEWS: "cadova_interviews",
  APPLICATIONS: "cadova_applications",
  LINKEDIN_ANALYSES: "cadova_linkedin_analyses",
};

// ===============================================
// 🔐 AUTHENTICATION
// ===============================================

export interface User {
  id: string;
  email: string;
  name: string;
  password: string; // En production réelle, ne JAMAIS stocker en clair !
  createdAt: string;
  subscription: "free" | "premium";
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

// Get all users
const getUsers = (): User[] => {
  const usersJson = localStorage.getItem(STORAGE_KEYS.USERS);
  return usersJson ? JSON.parse(usersJson) : [];
};

// Save all users
const saveUsers = (users: User[]) => {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
};

// Sign up
export const signup = async (
  email: string,
  password: string,
  name: string
): Promise<{ success: boolean; user?: User; error?: string }> => {
  try {
    const users = getUsers();

    // Check if user already exists
    if (users.some((u) => u.email === email)) {
      return { success: false, error: "Un compte existe déjà avec cet email" };
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      name,
      password, // NOTE: Ne jamais faire ça en production !
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

// Sign in
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

    // Create session
    const session: Session = {
      user,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    };

    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(session));

    return { success: true, user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Sign out
export const signout = () => {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
};

// Get current session
export const getSession = (): Session | null => {
  const sessionJson = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (!sessionJson) return null;

  const session: Session = JSON.parse(sessionJson);

  // Check if session expired
  if (new Date(session.expiresAt) < new Date()) {
    signout();
    return null;
  }

  return session;
};

// Get current user
export const getCurrentUser = (): User | null => {
  const session = getSession();
  return session?.user || null;
};

// Update user profile
export const updateProfile = (updates: Partial<User>): boolean => {
  try {
    const session = getSession();
    if (!session) return false;

    const users = getUsers();
    const userIndex = users.findIndex((u) => u.id === session.user.id);

    if (userIndex === -1) return false;

    users[userIndex] = { ...users[userIndex], ...updates };
    saveUsers(users);

    // Update session
    session.user = users[userIndex];
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(session));

    return true;
  } catch {
    return false;
  }
};

// ===============================================
// 💾 DATA STORAGE HELPERS
// ===============================================

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

export interface Application {
  id: string;
  userId: string;
  company: string;
  position: string;
  status: "sent" | "interview" | "offer" | "rejected";
  appliedAt: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
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

// Generic storage functions
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

// ===============================================
// 📄 CVS
// ===============================================

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

// ===============================================
// ✉️ COVER LETTERS
// ===============================================

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

// ===============================================
// 🔍 ATS ANALYSES
// ===============================================

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

// ===============================================
// 📊 APPLICATIONS
// ===============================================

export const getApplications = (userId: string): Application[] => {
  return getItems<Application>(STORAGE_KEYS.APPLICATIONS, userId);
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

// ===============================================
// 🧠 LINKEDIN ANALYSES
// ===============================================

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

// ===============================================
// 🧪 MOCK DATA GENERATOR (for demo)
// ===============================================

export const generateMockData = () => {
  // Only generate if no users exist
  if (getUsers().length === 0) {
    signup("demo@cadova.fr", "demo123", "Utilisateur Demo");
  }
};