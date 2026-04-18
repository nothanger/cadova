import { AppLayout } from "../components/AppLayout";
import { motion } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router";
import { useSEO } from "../hooks/useSEO";
import { useEffect, useState, useRef } from "react";
import {
  getCVs,
  getCoverLetters,
  getATSAnalyses,
  getInterviewSessions,
} from "@/lib/localStorage";
import {
  FileText,
  PenTool,
  Search,
  MessageSquare,
  Linkedin,
  Lightbulb,
  MapPin,
  ArrowUpRight,
  ArrowRight,
} from "lucide-react";



const modules = [
  { id: "cv", module: "ReussIA", label: "Générer un CV", desc: "Optimisé pour passer les filtres ATS", path: "/cv-generator", accent: "#5548F5", icon: FileText, index: "01" },
  { id: "letter", module: "ReussIA", label: "Lettre de motivation", desc: "Personnalisée par offre d'emploi", path: "/cover-letter", accent: "#5548F5", icon: PenTool, index: "02" },
  { id: "ats", module: "ReussIA", label: "Analyse ATS", desc: "Score + recommandations précises", path: "/ats-analysis", accent: "#5548F5", icon: Search, index: "03" },
  { id: "oral", module: "OralIA", label: "Simulation entretien", desc: "Questions réalistes, feedback instantané", path: "/interview", accent: "#EC4899", icon: MessageSquare, index: "04" },
  { id: "map", module: "TrackIA", label: "Carte entreprises", desc: "Offres proches de chez toi", path: "/company-finder", accent: "#10B981", icon: MapPin, index: "05" },
  { id: "linkedin", module: "SkillIA", label: "Optimiser LinkedIn", desc: "Profil + compétences clés", path: "/linkedin", accent: "#F59E0B", icon: Linkedin, index: "06" },
  { id: "skills", module: "SkillIA", label: "Compétences", desc: "Roadmap personnalisée par secteur", path: "/skills", accent: "#F59E0B", icon: Lightbulb, index: "07" },
];

const tips = [
  "Personnalise ton CV pour chaque offre — les recruteurs voient la différence.",
  "Un score ATS > 80% multiplie les entretiens par ×3.",
  "Prépare 5 réponses STAR avant chaque entretien.",
];



function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const steps = 30;
    const step = target / steps;
    let current = 0;
    let count = 0;
    const tick = () => {
      count++;
      current = Math.min(Math.round(step * count), target);
      setVal(current);
      if (count < steps) ref.current = setTimeout(tick, duration / steps);
    };
    tick();
    return () => { if (ref.current) clearTimeout(ref.current); };
  }, [target, duration]);

  return val;
}

function StatBlock({
  value,
  label,
  suffix = "",
  delta,
  unit,
  delay,
  empty,
}: {
  value: number;
  label: string;
  suffix?: string;
  delta: string;
  unit: string;
  delay: number;
  empty?: boolean;
}) {
  const count = useCountUp(empty ? 0 : value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="flex flex-col"
    >
      <span
        className="font-black leading-none tracking-tight tabular-nums"
        style={{
          fontFamily: "Syne, sans-serif",
          fontSize: "clamp(2.2rem, 4.5vw, 3.2rem)",
          color: empty ? "#D1D5DB" : "#0C0B1A",
          letterSpacing: "-0.03em",
        }}
      >
        {empty ? "—" : `${count}${suffix}`}
      </span>
      <span className="text-[11px] mt-1 uppercase tracking-wider" style={{ color: "#9CA3AF" }}>
        {label}
      </span>
      {!empty && (
        <span className="text-[11px] mt-0.5" style={{ color: "#10B981", fontVariantNumeric: "tabular-nums" }}>
          ↑ {delta} {unit}
        </span>
      )}
      {empty && (
        <span className="text-[11px] mt-0.5" style={{ color: "#D1D5DB" }}>
          Pas encore de données
        </span>
      )}
    </motion.div>
  );
}



interface DashboardStats {
  cvsCount: number;
  lettersCount: number;
  avgAtsScore: number;
  interviewsCount: number;
  profileCompletion: number;
  hasActivity: boolean;
  recentActivity: { label: string; tag: string; time: string; dot: string }[];
}

function buildStats(userId: string): DashboardStats {
  const cvs = getCVs(userId);
  const letters = getCoverLetters(userId);
  const analyses = getATSAnalyses(userId);
  const interviews = getInterviewSessions(userId);

  const avgAts =
    analyses.length > 0
      ? Math.round(analyses.reduce((s, a) => s + a.score, 0) / analyses.length)
      : 0;


  let completion = 10; // Compte créé = 10%
  if (cvs.length > 0) completion += 25;
  if (letters.length > 0) completion += 20;
  if (analyses.length > 0) completion += 20;
  if (interviews.length > 0) completion += 20;
  if (cvs.length >= 2) completion += 5;


  const allActivity: { label: string; tag: string; time: string; dot: string; ts: number }[] = [];

  cvs.slice(-3).forEach((c) => {
    allActivity.push({
      label: `CV "${c.title || "Sans titre"}" généré`,
      tag: "ReussIA",
      time: timeAgo(c.createdAt),
      dot: "#5548F5",
      ts: new Date(c.createdAt).getTime(),
    });
  });

  letters.slice(-3).forEach((l) => {
    allActivity.push({
      label: `Lettre — ${l.company || l.position || "Sans titre"}`,
      tag: "ReussIA",
      time: timeAgo(l.createdAt),
      dot: "#8B5CF6",
      ts: new Date(l.createdAt).getTime(),
    });
  });

  analyses.slice(-3).forEach((a) => {
    allActivity.push({
      label: `Analyse ATS — Score ${a.score}%`,
      tag: "ReussIA",
      time: timeAgo(a.analyzedAt),
      dot: "#10B981",
      ts: new Date(a.analyzedAt).getTime(),
    });
  });

  interviews.slice(-3).forEach((i) => {
    allActivity.push({
      label: `Simulation entretien — ${i.score}/100`,
      tag: "OralIA",
      time: timeAgo(i.completedAt),
      dot: "#EC4899",
      ts: new Date(i.completedAt).getTime(),
    });
  });

  allActivity.sort((a, b) => b.ts - a.ts);

  return {
    cvsCount: cvs.length,
    lettersCount: letters.length,
    avgAtsScore: avgAts,
    interviewsCount: interviews.length,
    profileCompletion: Math.min(completion, 100),
    hasActivity: allActivity.length > 0,
    recentActivity: allActivity.slice(0, 4).map(({ label, tag, time, dot }) => ({ label, tag, time, dot })),
  };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 2) return "À l'instant";
  if (mins < 60) return `${mins}min`;
  if (hours < 24) return `${hours}h`;
  if (days === 1) return "J-1";
  return `J-${days}`;
}



export function Dashboard() {
  useSEO({ title: "Dashboard — Cadova", noindex: true });
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const firstName =
    user?.name && user.name !== "Utilisateur"
      ? user.name.split(" ")[0]
      : user?.email?.split("@")[0] || "toi";

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  useEffect(() => {
    if (!user?.id) return;
    setStats(buildStats(user.id));
  }, [user?.id]);

  const s = stats;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto" style={{ fontFamily: "DM Sans, system-ui, sans-serif" }}>

        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <p className="text-[11px] uppercase tracking-[0.15em] mb-3" style={{ color: "#C4C4D4" }}>
            {today}
          </p>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1
                className="font-black leading-[1.05] mb-2"
                style={{ fontFamily: "Syne, sans-serif", color: "#0C0B1A", fontSize: "clamp(2rem, 5vw, 3.2rem)", letterSpacing: "-0.035em" }}
              >
                Bonjour, <span style={{ color: "#5548F5" }}>{firstName}.</span>
              </h1>
              <p className="text-sm" style={{ color: "#9CA3AF" }}>
                {s?.hasActivity ? "Continue sur ta lancée. Chaque action compte." : "Commence ta première génération pour voir tes stats en temps réel."}
              </p>
            </div>

            
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}
            >
              <div>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "#C4C4D4" }}>
                  Profil complété
                </p>
                <p className="font-black text-xl leading-none" style={{ fontFamily: "Syne, sans-serif", color: "#0C0B1A" }}>
                  {s?.profileCompletion ?? 10}<span className="text-sm font-normal" style={{ color: "#C4C4D4" }}>%</span>
                </p>
              </div>
              <div className="w-20">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${s?.profileCompletion ?? 10}%` }}
                    transition={{ delay: 0.4, duration: 0.9, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, #5548F5, #8B5CF6)" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        
        <div
          className="mb-10 rounded-2xl overflow-hidden"
          style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}
        >
          <div
            className="px-6 py-3 flex items-center justify-between"
            style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}
          >
            <span className="text-[10px] uppercase tracking-[0.15em]" style={{ color: "#C4C4D4" }}>
              Indicateurs
            </span>
            <span className="text-[10px] uppercase tracking-[0.15em]" style={{ color: "#C4C4D4" }}>
              Données réelles
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4">
            {[
              { value: s?.cvsCount ?? 0, label: "CVs générés", suffix: "", delta: s?.cvsCount ? `+${s.cvsCount}` : "0", unit: "total", empty: !s?.cvsCount },
              { value: s?.avgAtsScore ?? 0, label: "Score ATS moyen", suffix: "", delta: s?.avgAtsScore ? `${s.avgAtsScore}` : "0", unit: "pts", empty: !s?.avgAtsScore },
              { value: s?.lettersCount ?? 0, label: "Lettres créées", suffix: "", delta: s?.lettersCount ? `+${s.lettersCount}` : "0", unit: "total", empty: !s?.lettersCount },
              { value: s?.interviewsCount ?? 0, label: "Simulations orales", suffix: "", delta: s?.interviewsCount ? `+${s.interviewsCount}` : "0", unit: "total", empty: !s?.interviewsCount },
            ].map((stat, i) => (
              <div
                key={i}
                className="px-6 py-6"
                style={{ borderRight: i < 3 ? "1px solid rgba(0,0,0,0.05)" : "none" }}
              >
                <StatBlock
                  value={stat.value}
                  label={stat.label}
                  suffix={stat.suffix}
                  delta={stat.delta}
                  unit={stat.unit}
                  delay={i * 0.06}
                  empty={stat.empty}
                />
              </div>
            ))}
          </div>
        </div>

      
        <div className="grid lg:grid-cols-12 gap-6 mb-8">

          
          <div className="lg:col-span-7">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-bold text-base" style={{ fontFamily: "Syne, sans-serif", color: "#0C0B1A" }}>
                Modules
              </h2>
              <span className="text-[11px]" style={{ color: "#C4C4D4" }}>{modules.length} outils disponibles</span>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
              {modules.map((m, i) => (
                <Link key={m.id} to={m.path}>
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.04 }}
                    className="group flex items-center gap-4 px-5 py-4 transition-all duration-150 hover:bg-slate-50/70"
                    style={{ borderBottom: i < modules.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}
                  >
                    <span className="text-[11px] w-6 flex-shrink-0 tabular-nums" style={{ color: "rgba(0,0,0,0.15)", fontFamily: "ui-monospace, monospace" }}>
                      {m.index}
                    </span>
                    <div className="size-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110" style={{ background: `${m.accent}10` }}>
                      <m.icon className="size-4" style={{ color: m.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold leading-none mb-1 truncate" style={{ color: "#0C0B1A" }}>{m.label}</p>
                      <p className="text-[11px] leading-none truncate" style={{ color: "#B0B0C8" }}>{m.desc}</p>
                    </div>
                    <span className="text-[9px] uppercase tracking-wider px-2 py-1 rounded-md flex-shrink-0 hidden sm:block" style={{ background: `${m.accent}10`, color: m.accent }}>
                      {m.module}
                    </span>
                    <ArrowUpRight className="size-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: m.accent }} />
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>

          
          <div className="lg:col-span-5 flex flex-col gap-4">

            
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}
            >
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <span className="text-[10px] uppercase tracking-[0.15em]" style={{ color: "#C4C4D4" }}>
                  Activité récente
                </span>
                {s?.hasActivity && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "#10B98115", color: "#10B981" }}>
                    Live
                  </span>
                )}
              </div>

              {s?.hasActivity ? (
                <div>
                  {s.recentActivity.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-5 py-3.5"
                      style={{ borderBottom: i < s.recentActivity.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}
                    >
                      <div className="size-1.5 rounded-full flex-shrink-0" style={{ background: a.dot }} />
                      <p className="flex-1 text-[12px] leading-snug truncate" style={{ color: "#3D3D5C" }}>{a.label}</p>
                      <span className="text-[11px] flex-shrink-0 tabular-nums" style={{ color: "#C4C4D4", fontFamily: "ui-monospace, monospace" }}>{a.time}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-6 text-center">
                  <p className="text-[12px]" style={{ color: "#C4C4D4" }}>
                    Aucune activité pour l'instant.
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: "#D1D5DB" }}>
                    Génère ton premier CV pour commencer.
                  </p>
                  <Link to="/cv-generator">
                    <button
                      className="mt-3 text-[12px] font-semibold flex items-center gap-1 mx-auto transition-opacity hover:opacity-70"
                      style={{ color: "#5548F5" }}
                    >
                      Générer un CV <ArrowRight className="size-3" />
                    </button>
                  </Link>
                </div>
              )}
            </motion.div>

            {/* Tips */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="flex-1 rounded-2xl overflow-hidden relative"
              style={{ background: "#0A0914", border: "1px solid rgba(85,72,245,0.12)" }}
            >
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, #5548F5 0%, transparent 70%)", opacity: 0.12 }} />
              <div className="relative p-5">
                <p className="text-[10px] uppercase tracking-[0.15em] mb-4" style={{ color: "rgba(255,255,255,0.2)" }}>
                  À retenir
                </p>
                <div className="space-y-3">
                  {tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-[10px] mt-0.5 tabular-nums flex-shrink-0" style={{ color: "#5548F5", fontFamily: "ui-monospace, monospace" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{tip}</p>
                    </div>
                  ))}
                </div>
                <Link to="/cv-generator">
                  <button className="mt-5 flex items-center gap-2 text-[12px] font-semibold transition-opacity hover:opacity-80" style={{ color: "#8B5CF6" }}>
                    Créer un CV maintenant <ArrowRight className="size-3.5" />
                  </button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>

        
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}
        >
          <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                label: "Profil complété",
                value: s?.profileCompletion ?? 10,
                color: "#5548F5",
                hint: s?.profileCompletion === 100 ? "Complet !" : `${100 - (s?.profileCompletion ?? 10)}% restants`,
              },
              {
                label: "Score ATS moyen",
                value: s?.avgAtsScore ?? 0,
                color: s?.avgAtsScore && s.avgAtsScore >= 70 ? "#10B981" : "#F59E0B",
                hint: s?.avgAtsScore ? (s.avgAtsScore >= 80 ? "Excellent" : s.avgAtsScore >= 60 ? "Bon" : "À améliorer") : "Lance une analyse ATS",
              },
              {
                label: "Prépa entretien",
                value: s?.interviewsCount ? Math.min(s.interviewsCount * 20, 100) : 0,
                color: "#EC4899",
                hint: s?.interviewsCount ? `${s.interviewsCount} simulation${s.interviewsCount > 1 ? "s" : ""} faite${s.interviewsCount > 1 ? "s" : ""}` : "Lance une simulation",
              },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider" style={{ color: "#9CA3AF" }}>
                    {item.label}
                  </span>
                  <span className="font-black text-base tabular-nums" style={{ fontFamily: "Syne, sans-serif", color: "#0C0B1A" }}>
                    {item.value}<span className="text-xs font-normal" style={{ color: "#C4C4D4" }}>%</span>
                  </span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.05)" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.value}%` }}
                    transition={{ delay: 0.5 + i * 0.1, duration: 0.9, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: item.color }}
                  />
                </div>
                <p className="text-[10px] mt-1" style={{ color: "#C4C4D4" }}>{item.hint}</p>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </AppLayout>
  );
}
