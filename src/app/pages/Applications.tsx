import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ExternalLink,
  Mail,
  Plus,
  Send,
  Sparkles,
  Trash2,
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

const statusStyles: Record<ApplicationStatus, { bg: string; text: string; border: string }> = {
  "À envoyer": { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
  Envoyé: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100" },
  "Relance à faire": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100" },
  Relancé: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-100" },
  Entretien: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-100" },
  Refusé: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-100" },
  Accepté: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
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

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function recommendedFollowUpDate(appliedAt?: string) {
  return addDays(appliedAt ? new Date(appliedAt) : new Date(), 6);
}

function isFollowUpRecommended(application: Application) {
  if (application.status === "Relance à faire") return true;
  if (application.status !== "Envoyé") return false;
  const due = application.followUpDate || recommendedFollowUpDate(application.appliedAt);
  return new Date(`${due}T00:00:00`).getTime() <= Date.now();
}

function formatDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(value));
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
  const [emailApplication, setEmailApplication] = useState<Application | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [emailDraft, setEmailDraft] = useState({ recipient: "", subject: "", content: "" });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    loadAccountApplications(user.id).then(async (items) => {
      const sortedItems = items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    const responses = applications.filter((item) => ["Entretien", "Refusé", "Accepté"].includes(item.status)).length;
    const followUps = applications.filter(isFollowUpRecommended).length;
    return {
      total,
      interviews,
      followUps,
      responseRate: total ? Math.round((responses / total) * 100) : 0,
    };
  }, [applications]);

  const canCreate = isPro || applications.length < 5;

  const resetForm = () => {
    setDraft(emptyDraft);
    setEditingId(null);
  };

  const submitApplication = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;
    if (!canCreate && !editingId) {
      toast.error("Le plan gratuit limite le suivi à 5 candidatures.");
      return;
    }

    const payload = {
      ...draft,
      userId: user.id,
      appliedAt: draft.appliedAt || new Date().toISOString().slice(0, 10),
      followUpDate: draft.followUpDate || recommendedFollowUpDate(draft.appliedAt),
    };

    if (editingId) {
      const updated = await updateAccountApplication(editingId, payload);
      if (updated) {
        setApplications((items) => items.map((item) => (item.id === editingId ? updated : item)));
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
      toast.success("Candidature supprimée.");
    }
  };

  const moveApplication = async (id: string, status: ApplicationStatus) => {
    const updated = await updateAccountApplication(id, { status });
    if (!updated) return;
    setApplications((items) => items.map((item) => (item.id === id ? updated : item)));
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
    await moveApplication(emailApplication.id, "Relancé");
    setSending(false);
    setEmailApplication(null);
    toast.success(sent.status === "sent" ? "Email envoyé." : "Email enregistré côté serveur.");
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl" style={{ fontFamily: "DM Sans, system-ui, sans-serif" }}>
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-500">Suivi</p>
            <h1 className="font-black leading-none text-slate-950" style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(2.4rem, 5vw, 4rem)", letterSpacing: "-0.05em" }}>
              Pilote tes candidatures.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Garde les offres, statuts, relances et emails au même endroit pour ne plus perdre le fil.
            </p>
          </div>
          {!isPro && (
            <Link to="/checkout" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-slate-950 px-5 text-sm font-bold text-white">
              Débloquer le suivi illimité
              <ArrowRight className="size-4" />
            </Link>
          )}
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          {[
            { label: "Candidatures", value: stats.total },
            { label: "Taux réponse", value: `${stats.responseRate}%` },
            { label: "Entretiens", value: stats.interviews },
            { label: "Relances", value: stats.followUps },
          ].map((item) => (
            <div key={item.label} className="rounded-[8px] border border-black/5 bg-white p-5 shadow-sm">
              <p className="text-3xl font-black text-slate-950" style={{ fontFamily: "Syne, sans-serif" }}>{item.value}</p>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.13em] text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <form onSubmit={submitApplication} className="rounded-[8px] border border-black/5 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-slate-950">{editingId ? "Modifier" : "Nouvelle candidature"}</p>
                <p className="text-xs text-slate-500">{isPro ? "Suivi illimité" : `${applications.length}/5 sur le plan gratuit`}</p>
              </div>
              {editingId && (
                <button type="button" onClick={resetForm} className="text-xs font-bold text-slate-400 hover:text-slate-700">
                  Annuler
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <Label>Entreprise</Label>
                <Input value={draft.company} onChange={(event) => setDraft((item) => ({ ...item, company: event.target.value }))} required />
              </div>
              <div>
                <Label>Poste</Label>
                <Input value={draft.position} onChange={(event) => setDraft((item) => ({ ...item, position: event.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <select value={draft.type} onChange={(event) => setDraft((item) => ({ ...item, type: event.target.value as ApplicationType }))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                    <option value="stage">Stage</option>
                    <option value="alternance">Alternance</option>
                    <option value="job">Job</option>
                  </select>
                </div>
                <div>
                  <Label>Statut</Label>
                  <select value={draft.status} onChange={(event) => setDraft((item) => ({ ...item, status: event.target.value as ApplicationStatus }))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
                    {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date d’envoi</Label>
                  <Input type="date" value={draft.appliedAt} onChange={(event) => setDraft((item) => ({ ...item, appliedAt: event.target.value, followUpDate: item.followUpDate || recommendedFollowUpDate(event.target.value) }))} />
                </div>
                <div>
                  <Label>Date relance</Label>
                  <Input type="date" value={draft.followUpDate} onChange={(event) => setDraft((item) => ({ ...item, followUpDate: event.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Email contact</Label>
                <Input type="email" value={draft.email} onChange={(event) => setDraft((item) => ({ ...item, email: event.target.value }))} />
              </div>
              <div>
                <Label>Lien offre</Label>
                <Input value={draft.link} onChange={(event) => setDraft((item) => ({ ...item, link: event.target.value }))} />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={draft.notes} onChange={(event) => setDraft((item) => ({ ...item, notes: event.target.value }))} rows={4} />
              </div>
            </div>

            <Button type="submit" disabled={!canCreate && !editingId} className="mt-5 w-full gap-2 bg-indigo-600 hover:bg-indigo-700">
              <Plus className="size-4" />
              {editingId ? "Enregistrer" : "Ajouter"}
            </Button>
          </form>

          <div className="min-w-0">
            <div className="overflow-x-auto pb-3">
              <div className="grid min-w-[1120px] grid-cols-7 gap-3">
                {STATUSES.map((status) => {
                  const items = applications.filter((item) => item.status === status);
                  const style = statusStyles[status];
                  return (
                    <section
                      key={status}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => draggedId && moveApplication(draggedId, status)}
                      className={`min-h-[520px] rounded-[8px] border ${style.border} ${style.bg} p-3`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <p className={`text-xs font-black ${style.text}`}>{status}</p>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500">{items.length}</span>
                      </div>
                      <div className="space-y-3">
                        {items.map((application) => {
                          const recommended = isFollowUpRecommended(application);
                          return (
                            <article
                              key={application.id}
                              draggable
                              onDragStart={() => setDraggedId(application.id)}
                              onDragEnd={() => setDraggedId(null)}
                              className="cursor-grab rounded-[8px] border border-black/5 bg-white p-3 shadow-sm active:cursor-grabbing"
                            >
                              <div className="mb-2 flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-slate-950">{application.company}</p>
                                  <p className="truncate text-xs font-semibold text-slate-500">{application.position}</p>
                                </div>
                                <button onClick={() => editApplication(application)} className="text-[11px] font-bold text-indigo-600">Edit</button>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">{application.type}</span>
                                {application.appliedAt && (
                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{formatDate(application.appliedAt)}</span>
                                )}
                              </div>
                              {recommended && (
                                <div className="mt-3 flex items-center gap-1.5 rounded-[8px] bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-700">
                                  <Sparkles className="size-3" />
                                  Relance recommandée
                                </div>
                              )}
                              <div className="mt-3 flex items-center gap-2">
                                <button type="button" disabled={!application.email} onClick={() => openEmail(application)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-slate-950 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40">
                                  <Mail className="size-3" />
                                  Relancer
                                </button>
                                {application.link && (
                                  <a href={application.link} target="_blank" rel="noreferrer" className="flex size-8 items-center justify-center rounded-[8px] bg-slate-100 text-slate-600">
                                    <ExternalLink className="size-3.5" />
                                  </a>
                                )}
                                <button type="button" onClick={() => removeApplication(application.id)} className="flex size-8 items-center justify-center rounded-[8px] bg-rose-50 text-rose-600">
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                              {(emails[application.id]?.length || 0) > 0 && (
                                <p className="mt-2 text-[11px] font-semibold text-slate-400">{emails[application.id].length} email(s)</p>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 rounded-[8px] border border-black/5 bg-white shadow-sm lg:hidden">
              {applications.map((application) => (
                <div key={application.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0">
                  <div>
                    <p className="text-sm font-bold text-slate-950">{application.company}</p>
                    <p className="text-xs text-slate-500">{application.position} - {application.status}</p>
                  </div>
                  <button onClick={() => editApplication(application)} className="text-xs font-bold text-indigo-600">Modifier</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {emailApplication && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <form onSubmit={sendEmail} className="w-full max-w-2xl rounded-[12px] bg-white p-5 shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-black text-slate-950">Envoyer un email</p>
                  <p className="text-sm text-slate-500">{emailApplication.company} - {emailApplication.position}</p>
                </div>
                <button type="button" onClick={() => setEmailApplication(null)} className="text-sm font-bold text-slate-400">Fermer</button>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>Template</Label>
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
              {(emails[emailApplication.id]?.length || 0) > 0 && (
                <div className="mt-5 rounded-[8px] bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Historique</p>
                  <div className="space-y-2">
                    {emails[emailApplication.id].slice(0, 4).map((email) => (
                      <div key={email.id} className="flex items-center gap-2 text-xs text-slate-600">
                        <Check className="size-3 text-emerald-600" />
                        <span className="font-semibold">{email.subject}</span>
                        <span>{formatDate(email.sentAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
