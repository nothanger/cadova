import { apiCall } from "@/lib/supabase";
import {
  getATSAnalyses,
  getCVs,
  getCoverLetters,
  getInterviewSessions,
  saveCV as saveLocalCV,
  saveCoverLetter as saveLocalCoverLetter,
  saveInterviewSession as saveLocalInterviewSession,
  type ATSAnalysis,
  type CV,
  type CoverLetter,
  type InterviewSession,
} from "@/lib/localStorage";

export interface AccountWorkspace {
  cvs: CV[];
  coverLetters: CoverLetter[];
  atsAnalyses: ATSAnalysis[];
  interviewSessions: InterviewSession[];
}

async function safeJson<T>(response: Response, key: string, fallback: T): Promise<T> {
  if (!response.ok) return fallback;
  const data = await response.json();
  return (data?.[key] as T) ?? fallback;
}

export async function loadAccountWorkspace(userId: string): Promise<AccountWorkspace> {
  const localFallback: AccountWorkspace = {
    cvs: getCVs(userId),
    coverLetters: getCoverLetters(userId),
    atsAnalyses: getATSAnalyses(userId),
    interviewSessions: getInterviewSessions(userId),
  };

  try {
    const [cvsRes, lettersRes, atsRes, interviewsRes] = await Promise.all([
      apiCall("/reussia/cvs"),
      apiCall("/reussia/cover-letters"),
      apiCall("/reussia/ats-analyses"),
      apiCall("/oralia/sessions"),
    ]);

    return {
      cvs: await safeJson<CV[]>(cvsRes, "cvs", localFallback.cvs),
      coverLetters: await safeJson<CoverLetter[]>(lettersRes, "letters", localFallback.coverLetters),
      atsAnalyses: await safeJson<ATSAnalysis[]>(atsRes, "analyses", localFallback.atsAnalyses),
      interviewSessions: await safeJson<InterviewSession[]>(interviewsRes, "sessions", localFallback.interviewSessions),
    };
  } catch {
    return localFallback;
  }
}

export async function saveAccountCV(cv: Omit<CV, "id" | "createdAt" | "updatedAt">): Promise<CV> {
  try {
    const response = await apiCall("/reussia/cvs", {
      method: "POST",
      body: JSON.stringify(cv),
    });
    if (response.ok) {
      const data = await response.json();
      return data.cv as CV;
    }
  } catch {}
  return saveLocalCV(cv);
}

export async function saveAccountCoverLetter(letter: Omit<CoverLetter, "id" | "createdAt" | "updatedAt">): Promise<CoverLetter> {
  try {
    const response = await apiCall("/reussia/cover-letters", {
      method: "POST",
      body: JSON.stringify(letter),
    });
    if (response.ok) {
      const data = await response.json();
      return data.letter as CoverLetter;
    }
  } catch {}
  return saveLocalCoverLetter(letter);
}

export async function saveAccountInterviewSession(
  session: Omit<InterviewSession, "id" | "completedAt">
): Promise<InterviewSession> {
  try {
    const response = await apiCall("/oralia/sessions", {
      method: "POST",
      body: JSON.stringify(session),
    });
    if (response.ok) {
      const data = await response.json();
      return data.session as InterviewSession;
    }
  } catch {}
  return saveLocalInterviewSession(session);
}
