import { apiCall } from "@/lib/supabase";
import {
  getATSAnalyses,
  getCVs,
  getCoverLetters,
  getApplications,
  getEmailTemplates,
  getEmailsForApplication,
  getInterviewSessions,
  saveCV as saveLocalCV,
  saveCoverLetter as saveLocalCoverLetter,
  saveApplication as saveLocalApplication,
  updateApplication as updateLocalApplication,
  deleteApplication as deleteLocalApplication,
  saveEmailSent as saveLocalEmailSent,
  saveEmailTemplate as saveLocalEmailTemplate,
  saveInterviewSession as saveLocalInterviewSession,
  type Application,
  type ATSAnalysis,
  type CV,
  type CoverLetter,
  type EmailSent,
  type EmailTemplate,
  type InterviewSession,
} from "@/lib/localStorage";

export interface AccountWorkspace {
  cvs: CV[];
  coverLetters: CoverLetter[];
  atsAnalyses: ATSAnalysis[];
  interviewSessions: InterviewSession[];
  applications: Application[];
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
    applications: getApplications(userId),
  };

  try {
    const [cvsRes, lettersRes, atsRes, interviewsRes, applicationsRes] = await Promise.all([
      apiCall("/reussia/cvs"),
      apiCall("/reussia/cover-letters"),
      apiCall("/reussia/ats-analyses"),
      apiCall("/oralia/sessions"),
      apiCall("/trackia/applications"),
    ]);

    return {
      cvs: await safeJson<CV[]>(cvsRes, "cvs", localFallback.cvs),
      coverLetters: await safeJson<CoverLetter[]>(lettersRes, "letters", localFallback.coverLetters),
      atsAnalyses: await safeJson<ATSAnalysis[]>(atsRes, "analyses", localFallback.atsAnalyses),
      interviewSessions: await safeJson<InterviewSession[]>(interviewsRes, "sessions", localFallback.interviewSessions),
      applications: await safeJson<Application[]>(applicationsRes, "applications", localFallback.applications),
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

export async function loadAccountApplications(userId: string): Promise<Application[]> {
  const localFallback = getApplications(userId);
  try {
    const response = await apiCall("/trackia/applications");
    return safeJson<Application[]>(response, "applications", localFallback);
  } catch {
    return localFallback;
  }
}

export async function saveAccountApplication(
  application: Omit<Application, "id" | "createdAt" | "updatedAt">
): Promise<Application> {
  try {
    const response = await apiCall("/trackia/applications", {
      method: "POST",
      body: JSON.stringify(application),
    });
    if (response.ok) {
      const data = await response.json();
      return data.application as Application;
    }
  } catch {}
  return saveLocalApplication(application);
}

export async function updateAccountApplication(
  id: string,
  updates: Partial<Application>
): Promise<Application | null> {
  try {
    const response = await apiCall(`/trackia/applications/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    if (response.ok) {
      const data = await response.json();
      return data.application as Application;
    }
  } catch {}
  return updateLocalApplication(id, updates);
}

export async function deleteAccountApplication(id: string): Promise<boolean> {
  try {
    const response = await apiCall(`/trackia/applications/${id}`, {
      method: "DELETE",
    });
    if (response.ok) return true;
  } catch {}
  return deleteLocalApplication(id);
}

export function getDefaultEmailTemplates(userId: string): EmailTemplate[] {
  const existing = getEmailTemplates(userId);
  if (existing.length) return existing;

  return [
    saveLocalEmailTemplate({
      userId,
      name: "Relance",
      subject: "Relance candidature - {{poste}}",
      content:
        "Bonjour,\n\nJe me permets de vous relancer au sujet de ma candidature pour le poste de {{poste}} chez {{entreprise}}.\n\nJe reste très motivé(e) et disponible pour échanger.\n\nBien cordialement,\n{{nom}}",
    }),
    saveLocalEmailTemplate({
      userId,
      name: "Candidature",
      subject: "Candidature - {{poste}}",
      content:
        "Bonjour,\n\nJe vous adresse ma candidature pour le poste de {{poste}} chez {{entreprise}}.\n\nJe serais ravi(e) de pouvoir échanger avec vous sur cette opportunité.\n\nBien cordialement,\n{{nom}}",
    }),
  ];
}

export function renderEmailTemplate(
  value: string,
  application: Application,
  userName: string
) {
  return value
    .replaceAll("{{entreprise}}", application.company)
    .replaceAll("{{poste}}", application.position)
    .replaceAll("{{nom}}", userName);
}

export async function sendApplicationEmail(input: {
  userId: string;
  candidatureId: string;
  recipient: string;
  subject: string;
  content: string;
}): Promise<EmailSent> {
  try {
    const response = await apiCall("/trackia/emails/send", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (response.ok) {
      const data = await response.json();
      return data.email as EmailSent;
    }
  } catch {}

  return saveLocalEmailSent({
    userId: input.userId,
    candidatureId: input.candidatureId,
    recipient: input.recipient,
    subject: input.subject,
    content: input.content,
    status: "queued",
  });
}

export async function loadApplicationEmails(userId: string, candidatureId: string): Promise<EmailSent[]> {
  const localFallback = getEmailsForApplication(userId, candidatureId);
  try {
    const response = await apiCall(`/trackia/emails/${candidatureId}`);
    return safeJson<EmailSent[]>(response, "emails", localFallback);
  } catch {
    return localFallback;
  }
}
