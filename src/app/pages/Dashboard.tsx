import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Briefcase,
  Clock3,
  FileText,
  Linkedin,
  MessageSquare,
  Search,
  TrendingUp,
} from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { useSEO } from "../hooks/useSEO";
import { useAuth } from "@/contexts/AuthContext";
import {
  getApplications,
  getATSAnalyses,
  getCVs,
  getCoverLetters,
  getInterviewSessions,
  getLinkedInAnalyses,
} from "@/lib/localStorage";

type ActivityItem = {
  id: string;
  label: string;
  meta: string;
  date: string;
};

type DashboardData = {
  cvs: ReturnType<typeof getCVs>;
  letters: ReturnType<typeof getCoverLetters>;
  ats: ReturnType<typeof getATSAnalyses>;
  interviews: ReturnType<typeof getInterviewSessions>;
  applications: ReturnType<typeof getApplications>;
  linkedin: ReturnType<typeof getLinkedInAnalyses>;
};

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "A l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours} h`;
  if (days === 1) return "Hier";
  return `Il y a ${days} jours`;
}

function buildActivity(data: DashboardData): ActivityItem[] {
  const items: Array<ActivityItem & { ts: number }> = [];

  data.cvs.forEach((item) => {
    items.push({ id: `cv-${item.id}`, label: item.title || "CV enregistre", meta: "ReussIA", date: timeAgo(item.updatedAt), ts: new Date(item.updatedAt).getTime() });
  });
  data.letters.forEach((item) => {
    items.push({ id: `letter-${item.id}`, label: item.title || `${item.company || "Lettre"} - ${item.position || "candidature"}`, meta: "Cover letter", date: timeAgo(item.updatedAt), ts: new Date(item.updatedAt).getTime() });
  });
  data.ats.forEach((item) => {
    items.push({ id: `ats-${item.id}`, label: `Analyse ATS ${item.score}/100`, meta: item.missingKeywords.length ? `${item.missingKeywords.length} mots-cles manquants` : "Bon niveau de compatibilite", date: timeAgo(item.analyzedAt), ts: new Date(item.analyzedAt).getTime() });
  });
  data.interviews.forEach((item) => {
    items.push({ id: `interview-${item.id}`, label: `Simulation ${item.type}`, meta: `Score ${item.score}/100`, date: timeAgo(item.completedAt), ts: new Date(item.completedAt).getTime() });
  });
  data.applications.forEach((item) => {
    items.push({ id: `application-${item.id}`, label: `${item.company} - ${item.position}`, meta: `Statut: ${item.status}`, date: timeAgo(item.updatedAt), ts: new Date(item.updatedAt).getTime() });
  });
  data.linkedin.forEach((item) => {
    items.push({ id: `linkedin-${item.id}`, label: "Analyse LinkedIn", meta: `Score ${item.score}/100`, date: timeAgo(item.analyzedAt), ts: new Date(item.analyzedAt).getTime() });
  });

  return items.sort((a, b) => b.ts - a.ts).slice(0, 8);
}

export function Dashboard() {
  useSEO({ title: "Dashboard - Cadova", noindex: true });
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const read = () =>
      setData({
        cvs: getCVs(user.id),
        letters: getCoverLetters(user.id),
        ats: getATSAnalyses(user.id),
        interviews: getInterviewSessions(user.id),
        applications: getApplications(user.id),
        linkedin: getLinkedInAnalyses(user.id),
      });

    read();
    window.addEventListener("storage", read);
    window.addEventListener("focus", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("focus", read);
    };
  }, [user?.id]);

  const firstName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "toi";

  const summary = useMemo(() => {
    if (!data) {
      return { avgAts: 0, avgInterview: 0, completion: 0, activeApplications: 0, activity: [] as ActivityItem[] };
    }

    const avgAts = data.ats.length > 0 ? Math.round(data.ats.reduce((acc, item) => acc + item.score, 0) / data.ats.length) : 0;
    const avgInterview = data.interviews.length > 0 ? Math.round(data.interviews.reduce((acc, item) => acc + item.score, 0) / data.interviews.length) : 0;
    const completion = Math.min(
      100,
      (data.cvs.length > 0 ? 20 : 0) +
        (data.letters.length > 0 ? 15 : 0) +
        (data.ats.length > 0 ? 20 : 0) +
        (data.interviews.length > 0 ? 20 : 0) +
        (data.linkedin.length > 0 ? 10 : 0) +
        (data.applications.length > 0 ? 15 : 0),
    );

    return {
      avgAts,
      avgInterview,
      completion,
      activeApplications: data.applications.filter((item) => item.status !== "rejected").length,
      activity: buildActivity(data),
    };
  }, [data]);

  const quickActions = [
    { label: "Remettre mon CV au propre", href: "/cv-generator", icon: FileText },
    { label: "Voir si mon CV tient la route", href: "/ats-analysis", icon: Search },
    { label: "M'entrainer a l'entretien", href: "/interview", icon: MessageSquare },
    { label: "Ranger mes candidatures", href: "/company-finder", icon: Briefcase },
  ];

  const cards = [
    { label: "CV gardes ici", value: data?.cvs.length ?? 0, hint: "Chaque version utile reste sous la main.", icon: FileText, color: "#5044f5" },
    { label: "Pistes encore ouvertes", value: summary.activeApplications, hint: "Celles qui meritent encore ton attention.", icon: Briefcase, color: "#14b8a6" },
    { label: "Lisibilite ATS", value: summary.avgAts, suffix: "/100", hint: summary.avgAts ? "Moyenne de tes analyses sauvegardees." : "Pas encore d'analyse. On peut commencer par la.", icon: Search, color: "#2563eb" },
    { label: "Entrainement oral", value: summary.avgInterview, suffix: "/100", hint: summary.avgInterview ? "Moyenne de tes simulations." : "Une simulation suffit pour poser une premiere base.", icon: MessageSquare, color: "#d946ef" },
  ];

  return (
    <AppLayout>
      <div className="cadova-page space-y-6">
        <section className="cadova-panel p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="cadova-kicker">Ton point de controle</p>
              <h1 className="cadova-title">Bonjour, {firstName}.</h1>
              <p className="cadova-subtitle">
                Ici, on regarde ce qui avance vraiment: les documents que tu as gardes, les pistes encore ouvertes, les analyses faites et les entretiens prepares.
              </p>
            </div>
            <div className="cadova-card min-w-[250px] p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-[var(--cadova-muted)]">Recherche structuree</div>
                  <div className="mt-1 text-4xl font-extrabold tracking-[-0.05em] text-[var(--cadova-text)]">{summary.completion}%</div>
                </div>
                <TrendingUp className="size-5 text-[var(--cadova-primary)]" />
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--cadova-bg-alt)]">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#5044f5,#7c5cff)]" style={{ width: `${summary.completion}%` }} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="cadova-card p-5">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-[8px]" style={{ background: `${card.color}12` }}>
                  <card.icon size={18} style={{ color: card.color }} />
                </span>
                <span className="text-xs font-semibold text-[var(--cadova-muted)]">{card.label}</span>
              </div>
              <div className="mt-5 text-4xl font-extrabold tracking-[-0.055em] text-[var(--cadova-text)]">
                {card.value}
                {card.suffix ? <span className="ml-1 text-lg text-[var(--cadova-muted)]">{card.suffix}</span> : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--cadova-muted)]">{card.hint}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="cadova-card p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-extrabold tracking-[-0.045em]">Ce qui a bouge recemment</h2>
              <Clock3 className="size-5 text-[var(--cadova-muted)]" />
            </div>

            {summary.activity.length === 0 ? (
              <div className="mt-5 rounded-[8px] border border-[var(--cadova-border)] bg-[var(--cadova-bg-alt)] p-5">
                <p className="m-0 text-sm leading-7 text-[var(--cadova-muted)]">
                  Rien a afficher pour l'instant. Des que tu gardes un CV, une lettre, une analyse, une simulation ou une candidature, on te remet le fil ici.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-4">
                {summary.activity.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4 border-b border-[var(--cadova-border)] pb-4 last:border-0 last:pb-0">
                    <div>
                      <div className="font-bold text-[var(--cadova-text)]">{item.label}</div>
                      <div className="mt-1 text-sm text-[var(--cadova-muted)]">{item.meta}</div>
                    </div>
                    <div className="whitespace-nowrap text-xs font-semibold text-[#a6abc0]">{item.date}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="cadova-card p-6">
              <h2 className="text-2xl font-extrabold tracking-[-0.045em]">Je veux avancer sur...</h2>
              <div className="mt-5 grid gap-3">
                {quickActions.map((action) => (
                  <Link key={action.href} to={action.href} className="flex items-center justify-between gap-3 rounded-[8px] border border-[var(--cadova-border)] bg-white px-4 py-3 no-underline transition hover:bg-[var(--cadova-primary-soft)]">
                    <div className="flex items-center gap-3">
                      <action.icon className="size-4 text-[var(--cadova-primary)]" />
                      <span className="font-bold text-[var(--cadova-text)]">{action.label}</span>
                    </div>
                    <ArrowRight className="size-4 text-[var(--cadova-muted)]" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="cadova-card p-6">
              <h2 className="text-2xl font-extrabold tracking-[-0.045em]">Ce que tu as deja touche</h2>
              <div className="mt-5 grid gap-3">
                {[
                  { label: "ReussIA", value: (data?.cvs.length ?? 0) + (data?.letters.length ?? 0) + (data?.ats.length ?? 0), icon: FileText },
                  { label: "OralIA", value: data?.interviews.length ?? 0, icon: MessageSquare },
                  { label: "TrackIA", value: data?.applications.length ?? 0, icon: Briefcase },
                  { label: "SkillIA", value: data?.linkedin.length ?? 0, icon: Linkedin },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-[8px] bg-[var(--cadova-bg-alt)] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <item.icon className="size-4 text-[var(--cadova-primary)]" />
                      <span className="font-semibold text-[var(--cadova-text)]">{item.label}</span>
                    </div>
                    <strong className="text-[var(--cadova-text)]">{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
