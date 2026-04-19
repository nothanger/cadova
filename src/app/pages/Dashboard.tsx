import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, FileText, MessageSquare, PenTool, Search } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "../components/AppLayout";
import { useSEO } from "../hooks/useSEO";
import { loadAccountWorkspace } from "../lib/account-data";
import type { AccountWorkspace } from "../lib/account-data";

const actions = [
  { label: "Creer un CV", text: "ReussIA", href: "/cv-generator", icon: FileText, color: "#5548F5" },
  { label: "Ecrire une lettre", text: "ReussIA", href: "/cover-letter", icon: PenTool, color: "#5548F5" },
  { label: "Analyser un CV", text: "ReussIA", href: "/ats-analysis", icon: Search, color: "#5548F5" },
  { label: "Simuler un entretien", text: "OralIA", href: "/interview", icon: MessageSquare, color: "#EC4899" },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 2) return "a l'instant";
  if (mins < 60) return `${mins} min`;
  if (hours < 24) return `${hours} h`;
  return `${days} j`;
}

export function Dashboard() {
  useSEO({ title: "Dashboard - Cadova", noindex: true });
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<AccountWorkspace | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    loadAccountWorkspace(user.id).then(setWorkspace);
  }, [user?.id]);

  const stats = useMemo(() => {
    const cvs = workspace?.cvs ?? [];
    const letters = workspace?.coverLetters ?? [];
    const analyses = workspace?.atsAnalyses ?? [];
    const interviews = workspace?.interviewSessions ?? [];
    const avgAts = analyses.length
      ? Math.round(analyses.reduce((sum, item) => sum + item.score, 0) / analyses.length)
      : 0;

    const activity = [
      ...cvs.map((item) => ({
        label: item.title || "CV sauvegarde",
        tag: "CV",
        date: item.updatedAt || item.createdAt,
        color: "#5548F5",
      })),
      ...letters.map((item) => ({
        label: item.company || item.position || item.title || "Lettre sauvegardee",
        tag: "Lettre",
        date: item.updatedAt || item.createdAt,
        color: "#7C3AED",
      })),
      ...analyses.map((item) => ({
        label: `Score ATS ${item.score}/100`,
        tag: "ATS",
        date: item.analyzedAt,
        color: "#10B981",
      })),
      ...interviews.map((item) => ({
        label: `Simulation ${item.score}/100`,
        tag: "OralIA",
        date: item.completedAt,
        color: "#EC4899",
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { cvs, letters, analyses, interviews, avgAts, activity };
  }, [workspace]);

  const firstName = user?.name && user.name !== "Utilisateur" ? user.name.split(" ")[0] : user?.email?.split("@")[0] || "toi";
  const hasActivity = stats.activity.length > 0;

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl" style={{ fontFamily: "DM Sans, system-ui, sans-serif" }}>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <p className="mb-3 text-[11px] uppercase tracking-[0.16em]" style={{ color: "#9CA3AF" }}>
            Espace candidat
          </p>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="font-black leading-none" style={{ fontFamily: "Syne, sans-serif", color: "#0C0B1A", fontSize: "clamp(2.3rem, 5vw, 4rem)", letterSpacing: "-0.05em" }}>
                Bonjour, {firstName}.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6" style={{ color: "#6B7280" }}>
                Cadova centralise tes documents ReussIA, tes analyses ATS et tes entrainements OralIA sur ton compte.
              </p>
            </div>
            <Link to="/cv-generator" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[#5548F5] px-5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20">
              Continuer mon dossier
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </motion.div>

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          {[
            { label: "CV sauvegardes", value: stats.cvs.length },
            { label: "Lettres", value: stats.letters.length },
            { label: "Score ATS moyen", value: stats.avgAts ? `${stats.avgAts}` : "-" },
            { label: "Simulations", value: stats.interviews.length },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-[8px] border border-black/5 bg-white p-5 shadow-sm"
            >
              <div className="text-4xl font-black leading-none" style={{ fontFamily: "Syne, sans-serif", color: "#0C0B1A" }}>
                {item.value}
              </div>
              <p className="mt-2 text-[11px] uppercase tracking-[0.12em]" style={{ color: "#9CA3AF" }}>
                {item.label}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <section className="lg:col-span-7">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "#5548F5" }}>
                  Actions
                </p>
                <h2 className="mt-1 text-xl font-black" style={{ fontFamily: "Syne, sans-serif", color: "#0C0B1A" }}>
                  Tes 3 piliers Cadova
                </h2>
              </div>
            </div>
            <div className="overflow-hidden rounded-[8px] border border-black/5 bg-white shadow-sm">
              {actions.map((action, index) => (
                <Link key={action.href} to={action.href} className="group block">
                  <div className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50" style={{ borderBottom: index < actions.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}>
                    <div className="flex size-10 items-center justify-center rounded-[8px]" style={{ background: `${action.color}12` }}>
                      <action.icon className="size-5" style={{ color: action.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold" style={{ color: "#0C0B1A" }}>{action.label}</p>
                      <p className="text-xs" style={{ color: "#9CA3AF" }}>{action.text}</p>
                    </div>
                    <ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" style={{ color: action.color }} />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="lg:col-span-5">
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "#EC4899" }}>
                Compte
              </p>
              <h2 className="mt-1 text-xl font-black" style={{ fontFamily: "Syne, sans-serif", color: "#0C0B1A" }}>
                Activite recente
              </h2>
            </div>
            <div className="min-h-[320px] rounded-[8px] border border-black/5 bg-white p-5 shadow-sm">
              {hasActivity ? (
                <div className="space-y-3">
                  {stats.activity.slice(0, 6).map((item, index) => (
                    <div key={`${item.tag}-${index}`} className="flex items-center gap-3 rounded-[8px] bg-slate-50 px-3 py-3">
                      <span className="size-2 rounded-full" style={{ background: item.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold" style={{ color: "#111827" }}>{item.label}</p>
                        <p className="text-[11px]" style={{ color: "#9CA3AF" }}>{item.tag} - {timeAgo(item.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-[280px] flex-col items-center justify-center text-center">
                  <div className="mb-4 flex size-14 items-center justify-center rounded-[8px] bg-indigo-50">
                    <FileText className="size-6 text-[#5548F5]" />
                  </div>
                  <h3 className="text-base font-bold" style={{ color: "#0C0B1A" }}>Aucune donnee sauvegardee</h3>
                  <p className="mt-2 max-w-xs text-sm leading-6" style={{ color: "#6B7280" }}>
                    Cree un CV, une lettre ou une simulation pour alimenter ton dashboard avec tes vraies donnees de compte.
                  </p>
                  <Link to="/cv-generator" className="mt-4 text-sm font-bold text-[#5548F5]">
                    Creer mon premier CV
                  </Link>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
