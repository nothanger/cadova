import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  Inbox,
  Mail,
  Plus,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "../components/AppLayout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { useSEO } from "../hooks/useSEO";
import {
  deleteAccountApplication,
  getDefaultEmailTemplates,
  loadAccountApplications,
  loadApplicationEmails,
  renderEmailTemplate,
  saveAccountApplication,
  sendApplicationEmail,
  updateAccountApplication,
} from "../lib/account-data";
import { isProSubscription } from "../lib/payment-service";
import { useAuth } from "@/contexts/AuthContext";
import type { Application, ApplicationStatus, ApplicationType, EmailSent, EmailTemplate } from "@/lib/localStorage";

const STATUSES: ApplicationStatus[] = [
  "À envoyer",
  "Envoyé",
  "Relance à faire",
  "Relancé",
  "Entretien",
  "Refusé",
  "Accepté",
];

const FINAL_STATUSES: ApplicationStatus[] = ["Refusé", "Accepté"];

const statusStyles: Record<ApplicationStatus, { bg: string; text: string; border: string; dot: string }> = {
  "À envoyer": { bg: "bg-gradient-to-b from-slate-50/90 to-white", text: "text-slate-800", border: "border-slate-200/80", dot: "bg-slate-400" },
  Envoyé: { bg: "bg-gradient-to-b from-blue-50/80 to-white", text: "text-blue-800", border: "border-blue-100", dot: "bg-blue-400" },
  "Relance à faire": { bg: "bg-gradient-to-b from-amber-50/90 to-white", text: "text-amber-900", border: "border-amber-100", dot: "bg-amber-400" },
  Relancé: { bg: "bg-gradient-to-b from-violet-50/80 to-white", text: "text-violet-800", border: "border-violet-100", dot: "bg-violet-400" },
  Entretien: { bg: "bg-gradient-to-b from-indigo-50/80 to-white", text: "text-indigo-800", border: "border-indigo-100", dot: "bg-indigo-400" },
  Refusé: { bg: "bg-gradient-to-b from-rose-50/80 to-white", text: "text-rose-800", border: "border-rose-100", dot: "bg-rose-400" },
  Accepté: { bg: "bg-gradient-to-b from-emerald-50/80 to-white", text: "text-emerald-800", border: "border-emerald-100", dot: "bg-emerald-400" },
};

const emptyDraft = {
  company: "",
  position: "",
  type: "stage" as ApplicationType,
  status: "À envoyer" as ApplicationStatus,
  appliedAt: "",
  followUpDate: "",
  email: "",
  link: "",
  notes: "",
};

function dateOnly(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return dateOnly(next);
}

function recommendedFollowUpDate(appliedAt?: string) {
  return addDays(appliedAt ? new Date(`${appliedAt}T00:00:00`) : new Date(), 6);
}

function getFollowUpDate(application: Application) {
  return application.followUpDate || recommendedFollowUpDate(application.appliedAt);
}

function daysBetween(from: Date, to: Date) {
  const start = new Date(from.toDateString()).getTime();
  const end = new Date(to.toDateString()).getTime();
  return Math.round((end - start) / 86400000);
}

function getFollowUpState(application: Application) {
  const dueDate = getFollowUpDate(application);
  const due = new Date(`${dueDate}T00:00:00`);
  const diff = daysBetween(new Date(), due);
  const relevant = application.status === "Envoyé" || application.status === "Relance à faire";
  return {
    dueDate,
    daysUntil: diff,
    isDue: relevant && diff <= 0,
    isOverdue: relevant && diff < 0,
  };
}

function shouldAutoMoveToFollowUp(application: Application) {
  return application.status === "Envoyé" && getFollowUpState(application).isDue;
}

function getNextAction(application: Application) {
  const followUp = getFollowUpState(application);
  if (application.status === "À envoyer") return { label: "À envoyer", tone: "slate" };
  if (application.status === "Relance à faire") return { label: followUp.isOverdue ? "Relance en retard" : "Relancer aujourd’hui", tone: "amber" };
  if (application.status === "Envoyé") {
    if (followUp.isDue) return { label: followUp.isOverdue ? "Relance en retard" : "Relancer aujourd’hui", tone: "amber" };
    return { label: `Attendre jusqu’au ${formatDate(followUp.dueDate)}`, tone: "blue" };
  }
  if (application.status === "Relancé") return { label: "Attendre une réponse", tone: "violet" };
  if (application.status === "Entretien") return { label: "Préparer entretien", tone: "indigo" };
  return { label: "Terminé", tone: application.status === "Accepté" ? "emerald" : "rose" };
}

function formatDate(value?: string) {
  if (!value) return "Non définie";
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(date);
}

function typeLabel(type: ApplicationType) {
  return type === "job" ? "Job" : type.charAt(0).toUpperCase() + type.slice(1);
}

function toneClass(tone: string) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-100 text-amber-900",
    violet: "bg-violet-50 text-violet-700",
    indigo: "bg-indigo-50 text-indigo-700",
    rose: "bg-rose-50 text-rose-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };
  return tones[tone] || tones.slate;
}

function notesPreview(notes?: string) {
  if (!notes?.trim()) return "";
  return notes.trim().replace(/\s+/g, " ").slice(0, 96);
}

export function Applications() {
  useSEO({ title: "Suivi candidatures - Cadova", noindex: true });
  const { user } = useAuth();
  const isPro = isProSubscription(user?.subscription);
  const [applications, setApplications] = useState<Application[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [emails, setEmails] = useState<Record<string, EmailSent[]>>({});
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [emailApplication, setEmailApplication] = useState<Application | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [emailDraft, setEmailDraft] = useState({ recipient: "", subject: "", content: "" });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    loadAccountApplications(user.id).then(async (items) => {
      const normalized = await Promise.all(items.map(async (item) => {
        if (!shouldAutoMoveToFollowUp(item)) return item;
        return (await updateAccountApplication(item.id, { status: "Relance à faire" })) || item;
      }));
      const sortedItems = normalized.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setApplications(sortedItems);
      const nextEmails: Record<string, EmailSent[]> = {};
      await Promise.all(sortedItems.map(async (item) => {
        nextEmails[item.id] = await loadApplicationEmails(user.id, item.id);
      }));
      setEmails(nextEmails);
    });
    setTemplates(getDefaultEmailTemplates(user.id));
  }, [user?.id]);

  const stats = useMemo(() => {
    const total = applications.length;
    const interviews = applications.filter((item) => item.status === "Entretien").length;
    const finished = applications.filter((item) => FINAL_STATUSES.includes(item.status)).length;
    const waiting = applications.filter((item) => ["Envoyé", "Relancé"].includes(item.status) && !getFollowUpState(item).isDue).length;
    const followUps = applications.filter((item) => item.status === "Relance à faire" || getFollowUpState(item).isDue).length;
    const overdue = applications.filter((item) => getFollowUpState(item).isOverdue).length;
    const responses = applications.filter((item) => ["Entretien", "Refusé", "Accepté"].includes(item.status)).length;
    return {
      total,
      interviews,
      finished,
      waiting,
      followUps,
      overdue,
      responseRate: total ? Math.round((responses / total) * 100) : 0,
    };
  }, [applications]);

  const canCreate = isPro || applications.length < 5;
  const fieldClass = "h-10 rounded-[8px] border-slate-200 bg-slate-50/70 px-3 text-sm shadow-none transition focus-visible:bg-white";
  const selectClass = "h-10 w-full rounded-[8px] border border-slate-200 bg-slate-50/70 px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100";
  const textareaClass = "min-h-[92px] rounded-[8px] border-slate-200 bg-slate-50/70 px-3 py-2 text-sm shadow-none transition focus-visible:bg-white";

  const resetForm = () => {
    setDraft(emptyDraft);
    setEditingId(null);
  };

  const updateApplicationInState = (updated: Application) => {
    setApplications((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedApplication((current) => (current?.id === updated.id ? updated : current));
    setEmailApplication((current) => (current?.id === updated.id ? updated : current));
  };

  const submitApplication = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;
    if (!canCreate && !editingId) {
      toast.error("Le plan gratuit limite le suivi à 5 candidatures.");
      return;
    }

    const appliedAt = draft.appliedAt || (draft.status === "À envoyer" ? "" : dateOnly(new Date()));
    const payload = {
      ...draft,
      userId: user.id,
      appliedAt,
      followUpDate: draft.followUpDate || (appliedAt ? recommendedFollowUpDate(appliedAt) : ""),
    };

    if (editingId) {
      const updated = await updateAccountApplication(editingId, payload);
      if (updated) {
        updateApplicationInState(updated);
        toast.success("Candidature mise à jour.");
      }
    } else {
      const created = await saveAccountApplication(payload);
      setApplications((items) => [created, ...items]);
      toast.success("Candidature ajoutée.");
    }

    resetForm();
  };

  const editApplication = (application: Application) => {
    setEditingId(application.id);
    setDraft({
      company: application.company,
      position: application.position,
      type: application.type,
      status: application.status,
      appliedAt: application.appliedAt,
      followUpDate: application.followUpDate,
      email: application.email,
      link: application.link,
      notes: application.notes || "",
    });
  };

  const removeApplication = async (id: string) => {
    const deleted = await deleteAccountApplication(id);
    if (deleted) {
      setApplications((items) => items.filter((item) => item.id !== id));
      setSelectedApplication((current) => (current?.id === id ? null : current));
      toast.success("Candidature supprimée.");
    }
  };

  const updateApplication = async (id: string, updates: Partial<Application>, message?: string) => {
    const updated = await updateAccountApplication(id, updates);
    if (!updated) return null;
    updateApplicationInState(updated);
    if (message) toast.success(message);
    return updated;
  };

  const moveApplication = async (id: string, status: ApplicationStatus) => {
    await updateApplication(id, { status });
  };

  const markAsSent = async (application: Application) => {
    const appliedAt = application.appliedAt || dateOnly(new Date());
    await updateApplication(application.id, {
      status: "Envoyé",
      appliedAt,
      followUpDate: application.followUpDate || recommendedFollowUpDate(appliedAt),
    }, "Candidature marquée comme envoyée.");
  };

  const markAsFollowedUp = async (application: Application) => {
    await updateApplication(application.id, {
      status: "Relancé",
      lastFollowUpAt: new Date().toISOString(),
      followUpDate: addDays(new Date(), 7),
    } as Partial<Application>, "Relance enregistrée.");
  };

  const scheduleFollowUp = async (application: Application, followUpDate: string) => {
    const status = application.status === "Relance à faire" ? "Envoyé" : application.status;
    await updateApplication(application.id, {
      followUpDate,
      status,
    }, "Date de relance planifiée.");
  };

  const openEmail = (application: Application, templateName = "Relance") => {
    const template = templates.find((item) => item.name === templateName) || templates[0];
    setEmailApplication(application);
    setSelectedTemplateId(template?.id || "");
    setEmailDraft({
      recipient: application.email,
      subject: template ? renderEmailTemplate(template.subject, application, user?.name || "") : "",
      content: template ? renderEmailTemplate(template.content, application, user?.name || "") : "",
    });
  };

  const applyTemplate = (templateId: string) => {
    if (!emailApplication) return;
    const template = templates.find((item) => item.id === templateId);
    setSelectedTemplateId(templateId);
    if (!template) return;
    setEmailDraft({
      recipient: emailApplication.email,
      subject: renderEmailTemplate(template.subject, emailApplication, user?.name || ""),
      content: renderEmailTemplate(template.content, emailApplication, user?.name || ""),
    });
  };

  const sendEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id || !emailApplication) return;
    setSending(true);
    const sent = await sendApplicationEmail({
      userId: user.id,
      candidatureId: emailApplication.id,
      recipient: emailDraft.recipient,
      subject: emailDraft.subject,
      content: emailDraft.content,
    });
    setEmails((items) => ({
      ...items,
      [emailApplication.id]: [sent, ...(items[emailApplication.id] || [])],
    }));
    await updateApplication(emailApplication.id, {
      status: "Relancé",
      lastFollowUpAt: sent.sentAt,
      followUpDate: addDays(new Date(), 7),
    } as Partial<Application>);
    setSending(false);
    setEmailApplication(null);
    toast.success(sent.status === "sent" ? "Email envoyé." : "Email enregistré.");
  };

  const Card = ({ application }: { application: Application }) => {
    const followUp = getFollowUpState(application);
    const nextAction = getNextAction(application);
    const preview = notesPreview(application.notes);
    const emailCount = emails[application.id]?.length || 0;

    return (
      <article
        role="button"
        tabIndex={0}
        draggable
        onDragStart={() => setDraggedId(application.id)}
        onDragEnd={() => setDraggedId(null)}
        onClick={() => setSelectedApplication(application)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedApplication(application);
          }
        }}
        className={`cursor-grab rounded-[8px] border bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] outline-none transition-all duration-150 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_18px_44px_rgba(15,23,42,0.10)] focus-visible:border-indigo-400 focus-visible:ring-4 focus-visible:ring-indigo-100 active:cursor-grabbing ${
          followUp.isOverdue ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-200/80"
        }`}
      >
        <div className="min-w-0">
          <p title={application.company || "Entreprise"} className="line-clamp-2 break-words text-[15px] font-black leading-5 text-slate-950">
            {application.company || "Entreprise"}
          </p>
          <p title={application.position || "Poste"} className="mt-1 line-clamp-2 break-words text-[13px] font-semibold leading-5 text-slate-600">
            {application.position || "Poste"}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.06em] ${toneClass(nextAction.tone)}`}>
            {typeLabel(application.type)}
          </span>
          <span className={`min-w-0 rounded-full px-2.5 py-1 text-[10px] font-black leading-4 ${toneClass(nextAction.tone)}`}>
            {nextAction.label}
          </span>
        </div>

        <div className="my-4 grid gap-2.5">
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-[11px] font-bold text-slate-400">Envoyé le</span>
            <strong className="min-w-0 text-[13px] font-black text-slate-900">
              {application.appliedAt ? formatDate(application.appliedAt) : "Pas encore"}
            </strong>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-[11px] font-bold text-slate-400">Relance le</span>
            <strong className={`min-w-0 text-[13px] font-black ${followUp.isDue ? "text-amber-800" : "text-slate-900"}`}>
              {formatDate(followUp.dueDate)}
            </strong>
          </div>
        </div>

        {followUp.isDue && (
          <div className="mt-3 flex items-center gap-2 rounded-[8px] bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-900">
            <AlertTriangle className="size-3.5" />
            {followUp.isOverdue ? `En retard de ${Math.abs(followUp.daysUntil)} j` : "À relancer aujourd’hui"}
          </div>
        )}

        {preview && (
          <p className="mt-3 rounded-[8px] border border-slate-100 bg-white p-3 text-[12px] leading-5 text-slate-600">
            {preview}{application.notes && application.notes.length > 96 ? "..." : ""}
          </p>
        )}

        <div className="mt-4 grid gap-2">
          {application.status === "À envoyer" ? (
            <button type="button" onClick={(event) => { event.stopPropagation(); markAsSent(application); }} className="h-9 rounded-[8px] bg-slate-950 px-3 text-[12px] font-black text-white transition hover:bg-indigo-700">
              Envoyée
            </button>
          ) : (
            <button type="button" disabled={!application.email} onClick={(event) => { event.stopPropagation(); openEmail(application); }} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-slate-950 px-3 text-[12px] font-black text-white transition hover:bg-indigo-700 disabled:opacity-40">
              <Mail className="size-3.5" />
              Relancer
            </button>
          )}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <button type="button" onClick={(event) => { event.stopPropagation(); editApplication(application); }} className="h-9 rounded-[8px] bg-slate-100 px-3 text-[12px] font-black text-slate-700 transition hover:bg-slate-200">
              Modifier
            </button>
            {application.link && (
              <a onClick={(event) => event.stopPropagation()} href={application.link} target="_blank" rel="noreferrer" className="flex size-9 items-center justify-center rounded-[8px] bg-slate-100 text-slate-700 transition hover:bg-slate-200">
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </div>

        <div className="mt-2">
          <select
            value={application.status}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => moveApplication(application.id, event.target.value as ApplicationStatus)}
            className="h-9 w-full rounded-[8px] border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>

        {emailCount > 0 && (
          <p className="mt-3 text-[11px] font-bold text-slate-500">{emailCount} email{emailCount > 1 ? "s" : ""} envoyé{emailCount > 1 ? "s" : ""}</p>
        )}
      </article>
    );
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1600px]" style={{ fontFamily: "DM Sans, system-ui, sans-serif" }}>
        <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">Suivi</p>
            <h1 className="font-black leading-none text-slate-950" style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(2.4rem, 5vw, 4rem)", letterSpacing: "-0.05em" }}>
              Tes candidatures à suivre.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
              Vois ce qui est envoyé, ce qui attend une réponse, ce qui doit être relancé et ce qui est terminé.
            </p>
          </div>
          {!isPro && (
            <Link to="/checkout" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-slate-950 px-5 text-sm font-bold text-white">
              Suivi illimité
              <ArrowRight className="size-4" />
            </Link>
          )}
        </div>

        <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          {[
            { label: "Total", value: stats.total, icon: Briefcase, tone: "bg-slate-100 text-slate-700" },
            { label: "En attente", value: stats.waiting, icon: Clock3, tone: "bg-blue-50 text-blue-700" },
            { label: "À relancer", value: stats.followUps, icon: CalendarClock, tone: "bg-amber-50 text-amber-800" },
            { label: "En retard", value: stats.overdue, icon: AlertTriangle, tone: "bg-rose-50 text-rose-700" },
            { label: "Entretiens", value: stats.interviews, icon: Mail, tone: "bg-indigo-50 text-indigo-700" },
            { label: "Terminées", value: stats.finished, icon: Check, tone: "bg-emerald-50 text-emerald-700" },
            { label: "Réponse", value: `${stats.responseRate}%`, icon: ChevronRight, tone: "bg-violet-50 text-violet-700" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-[8px] border border-slate-200/70 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
                <div className={`mb-4 flex size-9 items-center justify-center rounded-[8px] ${item.tone}`}>
                  <Icon className="size-4" />
                </div>
                <p className="text-3xl font-black leading-none text-slate-950" style={{ fontFamily: "Syne, sans-serif" }}>{item.value}</p>
                <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
              </div>
            );
          })}
        </div>

        {stats.followUps > 0 && (
          <div className="mb-6 flex flex-col gap-3 rounded-[8px] border border-amber-200 bg-amber-50 p-4 text-amber-950 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-black">{stats.followUps} candidature{stats.followUps > 1 ? "s" : ""} à relancer</p>
                <p className="text-sm text-amber-900">Priorise ces cartes aujourd’hui pour éviter les oublis.</p>
              </div>
            </div>
            <ChevronRight className="hidden size-5 md:block" />
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <form onSubmit={submitApplication} className="h-fit rounded-[8px] border border-slate-200/80 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)] [&_label]:mb-1.5 [&_label]:text-[12px] [&_label]:font-bold [&_label]:text-slate-700">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-slate-950">{editingId ? "Modifier" : "Nouvelle candidature"}</p>
                <p className="text-xs text-slate-600">{isPro ? "Suivi illimité" : `${applications.length}/5 sur le plan gratuit`}</p>
              </div>
              {editingId && (
                <button type="button" onClick={resetForm} className="text-xs font-bold text-slate-500 hover:text-slate-800">
                  Annuler
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <Label>Entreprise</Label>
                <Input className={fieldClass} value={draft.company} onChange={(event) => setDraft((item) => ({ ...item, company: event.target.value }))} required />
              </div>
              <div>
                <Label>Poste</Label>
                <Input className={fieldClass} value={draft.position} onChange={(event) => setDraft((item) => ({ ...item, position: event.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <select value={draft.type} onChange={(event) => setDraft((item) => ({ ...item, type: event.target.value as ApplicationType }))} className={selectClass}>
                    <option value="stage">Stage</option>
                    <option value="alternance">Alternance</option>
                    <option value="job">Job</option>
                  </select>
                </div>
                <div>
                  <Label>Statut</Label>
                  <select value={draft.status} onChange={(event) => setDraft((item) => ({ ...item, status: event.target.value as ApplicationStatus }))} className={selectClass}>
                    {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date d’envoi</Label>
                  <Input className={fieldClass} type="date" value={draft.appliedAt} onChange={(event) => setDraft((item) => ({ ...item, appliedAt: event.target.value, followUpDate: item.followUpDate || recommendedFollowUpDate(event.target.value) }))} />
                </div>
                <div>
                  <Label>Date relance</Label>
                  <Input className={fieldClass} type="date" value={draft.followUpDate} onChange={(event) => setDraft((item) => ({ ...item, followUpDate: event.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Email contact</Label>
                <Input className={fieldClass} type="email" value={draft.email} onChange={(event) => setDraft((item) => ({ ...item, email: event.target.value }))} />
              </div>
              <div>
                <Label>Lien offre</Label>
                <Input className={fieldClass} value={draft.link} onChange={(event) => setDraft((item) => ({ ...item, link: event.target.value }))} />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea className={textareaClass} value={draft.notes} onChange={(event) => setDraft((item) => ({ ...item, notes: event.target.value }))} rows={4} />
              </div>
            </div>

            <Button type="submit" disabled={!canCreate && !editingId} className="mt-5 h-11 w-full gap-2 bg-[linear-gradient(135deg,#5044f5,#7c3aed)] font-black shadow-[0_16px_36px_rgba(80,68,245,0.24)] hover:shadow-[0_18px_42px_rgba(80,68,245,0.30)]">
              <Plus className="size-4" />
              {editingId ? "Enregistrer" : "Ajouter"}
            </Button>
          </form>

          <div className="min-w-0">
            <div className="overflow-x-auto pb-3">
              <div className="grid min-w-[1660px] grid-cols-7 gap-3">
                {STATUSES.map((status) => {
                  const items = applications.filter((item) => item.status === status);
                  const style = statusStyles[status];
                  return (
                    <section
                      key={status}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => draggedId && moveApplication(draggedId, status)}
                      className={`min-h-[500px] rounded-[8px] border ${style.border} ${style.bg} p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]`}
                    >
                      <div className="mb-4 flex items-center justify-between rounded-[8px] bg-white/70 px-3 py-2 shadow-sm shadow-slate-900/[0.03]">
                        <div className="flex items-center gap-2">
                          <span className={`size-2.5 rounded-full ${style.dot}`} />
                          <p className={`text-[13px] font-black ${style.text}`}>{status}</p>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-700">{items.length}</span>
                      </div>
                      <div className="space-y-3.5">
                        {items.length > 0 ? (
                          items.map((application) => <Card key={application.id} application={application} />)
                        ) : (
                          <div className="mt-2 flex min-h-[170px] flex-col items-center justify-center rounded-[8px] border border-dashed border-slate-200/90 bg-white/45 px-4 text-center">
                            <Inbox className="mb-3 size-5 text-slate-300" />
                            <p className="text-sm font-bold text-slate-400">Aucune candidature</p>
                            <p className="mt-1 text-xs leading-5 text-slate-400">Dépose une carte ici.</p>
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 rounded-[8px] border border-black/5 bg-white shadow-sm lg:hidden">
              {applications.map((application) => {
                const nextAction = getNextAction(application);
                return (
                  <button key={application.id} type="button" onClick={() => setSelectedApplication(application)} className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left last:border-0">
                    <div>
                      <p className="text-sm font-bold text-slate-950">{application.company}</p>
                      <p className="text-xs text-slate-600">{application.position} - {nextAction.label}</p>
                    </div>
                    <span className="text-xs font-bold text-indigo-700">Ouvrir</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {selectedApplication && (
          <div className="fixed inset-0 z-[3900] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-label="Détail de la candidature" className="w-full max-w-2xl rounded-[8px] bg-white p-5 shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xl font-black text-slate-950">{selectedApplication.company}</p>
                  <p className="text-sm font-semibold text-slate-600">{selectedApplication.position}</p>
                </div>
                <button type="button" onClick={() => setSelectedApplication(null)} className="text-sm font-bold text-slate-500">Fermer</button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[8px] bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Prochaine action</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{getNextAction(selectedApplication).label}</p>
                </div>
                <div className="rounded-[8px] bg-slate-50 p-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Relance prévue</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{formatDate(getFollowUpDate(selectedApplication))}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Button type="button" onClick={() => openEmail(selectedApplication)} disabled={!selectedApplication.email} className="gap-2 bg-slate-950 hover:bg-slate-800">
                  <Mail className="size-4" />
                  Ouvrir l’email de relance
                </Button>
                <Button type="button" variant="outline" onClick={() => markAsFollowedUp(selectedApplication)}>
                  Marquer comme relancée
                </Button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_190px]">
                <div>
                  <Label>Planifier une relance</Label>
                  <Input type="date" defaultValue={getFollowUpDate(selectedApplication)} onBlur={(event) => event.target.value && scheduleFollowUp(selectedApplication, event.target.value)} />
                </div>
                <div>
                  <Label>Changer de statut</Label>
                  <select value={selectedApplication.status} onChange={(event) => moveApplication(selectedApplication.id, event.target.value as ApplicationStatus)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                    {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>

              {selectedApplication.notes && (
                <div className="mt-4 rounded-[8px] bg-slate-50 p-4">
                  <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Notes</p>
                  <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{selectedApplication.notes}</p>
                </div>
              )}

              <div className="mt-4 rounded-[8px] bg-slate-50 p-4">
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Emails envoyés</p>
                {(emails[selectedApplication.id]?.length || 0) > 0 ? (
                  <div className="space-y-2">
                    {emails[selectedApplication.id].map((email) => (
                      <div key={email.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <Check className="size-3.5 text-emerald-600" />
                        <span className="font-semibold">{email.subject}</span>
                        <span className="text-slate-500">{formatDate(email.sentAt)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">Aucun email enregistré pour cette candidature.</p>
                )}
              </div>

              <div className="mt-5 flex justify-between gap-3">
                <Button type="button" variant="outline" onClick={() => editApplication(selectedApplication)}>Modifier</Button>
                <Button type="button" variant="outline" onClick={() => removeApplication(selectedApplication.id)} className="text-rose-700">Supprimer</Button>
              </div>
            </div>
          </div>
        )}

        {emailApplication && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <form role="dialog" aria-modal="true" aria-label="Email de relance" onSubmit={sendEmail} className="w-full max-w-2xl rounded-[8px] bg-white p-5 shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-black text-slate-950">Email de relance</p>
                  <p className="text-sm text-slate-600">{emailApplication.company} - {emailApplication.position}</p>
                </div>
                <button type="button" onClick={() => setEmailApplication(null)} className="text-sm font-bold text-slate-500">Fermer</button>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>Modèle</Label>
                  <select value={selectedTemplateId} onChange={(event) => applyTemplate(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                    {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Destinataire</Label>
                  <Input value={emailDraft.recipient} onChange={(event) => setEmailDraft((item) => ({ ...item, recipient: event.target.value }))} required />
                </div>
                <div>
                  <Label>Objet</Label>
                  <Input value={emailDraft.subject} onChange={(event) => setEmailDraft((item) => ({ ...item, subject: event.target.value }))} required />
                </div>
                <div>
                  <Label>Contenu</Label>
                  <Textarea value={emailDraft.content} onChange={(event) => setEmailDraft((item) => ({ ...item, content: event.target.value }))} rows={9} required />
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setEmailApplication(null)}>Annuler</Button>
                <Button type="submit" disabled={sending} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                  {sending ? <CalendarClock className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Envoyer
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
