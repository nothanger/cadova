import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
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
    items.push({
      id: `cv-${item.id}`,
      label: item.title || "CV enregistre",
      meta: "ReussIA",
      date: timeAgo(item.updatedAt),
      ts: new Date(item.updatedAt).getTime(),
    });
  });

  data.letters.forEach((item) => {
    items.push({
      id: `letter-${item.id}`,
      label: item.title || `${item.company || "Lettre"} - ${item.position || "candidature"}`,
      meta: "Cover letter",
      date: timeAgo(item.updatedAt),
      ts: new Date(item.updatedAt).getTime(),
    });
  });

  data.ats.forEach((item) => {
    items.push({
      id: `ats-${item.id}`,
      label: `Analyse ATS ${item.score}/100`,
      meta: item.missingKeywords.length ? `${item.missingKeywords.length} mots-cles manquants` : "Bon niveau de compatibilite",
      date: timeAgo(item.analyzedAt),
      ts: new Date(item.analyzedAt).getTime(),
    });
  });

  data.interviews.forEach((item) => {
    items.push({
      id: `interview-${item.id}`,
      label: `Simulation ${item.type}`,
      meta: `Score ${item.score}/100`,
      date: timeAgo(item.completedAt),
      ts: new Date(item.completedAt).getTime(),
    });
  });

  data.applications.forEach((item) => {
    items.push({
      id: `application-${item.id}`,
      label: `${item.company} - ${item.position}`,
      meta: `Statut: ${item.status}`,
      date: timeAgo(item.updatedAt),
      ts: new Date(item.updatedAt).getTime(),
    });
  });

  data.linkedin.forEach((item) => {
    items.push({
      id: `linkedin-${item.id}`,
      label: "Analyse LinkedIn",
      meta: `Score ${item.score}/100`,
      date: timeAgo(item.analyzedAt),
      ts: new Date(item.analyzedAt).getTime(),
    });
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
      return {
        avgAts: 0,
        avgInterview: 0,
        completion: 0,
        activeApplications: 0,
        activity: [] as ActivityItem[],
      };
    }

    const avgAts =
      data.ats.length > 0
        ? Math.round(data.ats.reduce((acc, item) => acc + item.score, 0) / data.ats.length)
        : 0;

    const avgInterview =
      data.interviews.length > 0
        ? Math.round(data.interviews.reduce((acc, item) => acc + item.score, 0) / data.interviews.length)
        : 0;

    const completion = Math.min(
      100,
      (data.cvs.length > 0 ? 20 : 0) +
        (data.letters.length > 0 ? 15 : 0) +
        (data.ats.length > 0 ? 20 : 0) +
        (data.interviews.length > 0 ? 20 : 0) +
        (data.linkedin.length > 0 ? 10 : 0) +
        (data.applications.length > 0 ? 15 : 0)
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
    { label: "Generer un CV", href: "/cv-generator", icon: FileText },
    { label: "Lancer une analyse ATS", href: "/ats-analysis", icon: Search },
    { label: "Simuler un entretien", href: "/interview", icon: MessageSquare },
    { label: "Suivre mes candidatures", href: "/company-finder", icon: Briefcase },
  ];

  const cards = [
    {
      label: "CV enregistres",
      value: data?.cvs.length ?? 0,
      hint: "Chaque nouvelle version apparait ici.",
      icon: FileText,
      color: "#5548f5",
    },
    {
      label: "Candidatures actives",
      value: summary.activeApplications,
      hint: "Candidatures encore en cours ou a relancer.",
      icon: Briefcase,
      color: "#10b981",
    },
    {
      label: "Score ATS moyen",
      value: summary.avgAts,
      suffix: "/100",
      hint: summary.avgAts ? "Base sur tes analyses sauvegardees." : "Aucune analyse pour l'instant.",
      icon: Search,
      color: "#06b6d4",
    },
    {
      label: "Score entretien moyen",
      value: summary.avgInterview,
      suffix: "/100",
      hint: summary.avgInterview ? "Moyenne de tes simulations." : "Lance une simulation pour commencer.",
      icon: MessageSquare,
      color: "#ec4899",
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6" style={{ fontFamily: "DM Sans, system-ui, sans-serif" }}>
        <section
          style={{
            background: "linear-gradient(135deg, #120d23, #23174b)",
            color: "white",
            borderRadius: 8,
            padding: 28,
          }}
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.16em", color: "rgba(255,255,255,0.45)" }}>
                Tableau de bord
              </div>
              <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(2rem, 5vw, 3.4rem)", lineHeight: 1.02, margin: "10px 0 12px" }}>
                Bonjour, {firstName}.
              </h1>
              <p style={{ maxWidth: 640, margin: 0, color: "rgba(255,255,255,0.72)", lineHeight: 1.7 }}>
                Ici, seules tes vraies actions comptent: documents enregistres, analyses lancees, simulations terminees et candidatures suivies.
              </p>
            </div>
            <div
              style={{
                minWidth: 240,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: 18,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "end" }}>
                <div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Progression globale</div>
                  <div style={{ fontSize: 32, fontWeight: 800 }}>{summary.completion}%</div>
                </div>
                <TrendingUp size={18} style={{ color: "#8b5cf6" }} />
              </div>
              <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.12)", marginTop: 14, overflow: "hidden" }}>
                <div style={{ width: `${summary.completion}%`, height: "100%", background: "linear-gradient(90deg, #5548f5, #8b5cf6)" }} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.label}
              style={{
                background: "white",
                border: "1px solid rgba(20,15,38,0.08)",
                borderRadius: 8,
                padding: 20,
              }}
            >
              <div className="flex items-center justify-between">
                <card.icon size={18} style={{ color: card.color }} />
                <span style={{ fontSize: 12, color: "#9189a6" }}>{card.label}</span>
              </div>
              <div style={{ marginTop: 18, fontSize: 34, fontWeight: 800, lineHeight: 1 }}>
                {card.value}
                {card.suffix ? <span style={{ fontSize: 18, color: "#8d86a2", marginLeft: 4 }}>{card.suffix}</span> : null}
              </div>
              <p style={{ marginTop: 10, marginBottom: 0, color: "#69627d", lineHeight: 1.6, fontSize: 14 }}>{card.hint}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div
            style={{
              background: "white",
              borderRadius: 8,
              border: "1px solid rgba(20,15,38,0.08)",
              padding: 22,
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <h2 style={{ margin: 0, fontSize: 22 }}>Activite recente</h2>
              <Clock3 size={18} style={{ color: "#8f87a4" }} />
            </div>

            {summary.activity.length === 0 ? (
              <div style={{ marginTop: 18, padding: 20, borderRadius: 8, background: "#f7f6fb" }}>
                <p style={{ margin: 0, color: "#5b5470", lineHeight: 1.7 }}>
                  Ton dashboard s'alimente quand tu enregistres un CV, une lettre, une analyse ATS, une simulation d'entretien ou une candidature.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
                {summary.activity.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      alignItems: "start",
                      paddingBottom: 14,
                      borderBottom: "1px solid rgba(20,15,38,0.08)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.label}</div>
                      <div style={{ color: "#766f8a", fontSize: 14, marginTop: 4 }}>{item.meta}</div>
                    </div>
                    <div style={{ color: "#9a93ae", fontSize: 13, whiteSpace: "nowrap" }}>{item.date}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div
              style={{
                background: "white",
                borderRadius: 8,
                border: "1px solid rgba(20,15,38,0.08)",
                padding: 22,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 22 }}>Actions rapides</h2>
              <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                {quickActions.map((action) => (
                  <Link
                    key={action.href}
                    to={action.href}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      padding: 14,
                      borderRadius: 8,
                      background: "#f7f6fb",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <action.icon size={17} style={{ color: "#5548f5" }} />
                      <span style={{ fontWeight: 700 }}>{action.label}</span>
                    </div>
                    <ArrowRight size={16} style={{ color: "#8a84a0" }} />
                  </Link>
                ))}
              </div>
            </div>

            <div
              style={{
                background: "white",
                borderRadius: 8,
                border: "1px solid rgba(20,15,38,0.08)",
                padding: 22,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 22 }}>Etat des modules</h2>
              <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                {[
                  { label: "ReussIA", value: (data?.cvs.length ?? 0) + (data?.letters.length ?? 0) + (data?.ats.length ?? 0), icon: FileText },
                  { label: "OralIA", value: data?.interviews.length ?? 0, icon: MessageSquare },
                  { label: "TrackIA", value: data?.applications.length ?? 0, icon: Briefcase },
                  { label: "SkillIA", value: data?.linkedin.length ?? 0, icon: Linkedin },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <item.icon size={16} style={{ color: "#5548f5" }} />
                      <span>{item.label}</span>
                    </div>
                    <strong>{item.value}</strong>
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
