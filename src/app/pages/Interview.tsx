import { useState, useEffect, useRef } from "react";
import { useSEO } from "../hooks/useSEO";
import { AppLayout } from "../components/AppLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageSquare, Play, Send, RotateCcw, Lightbulb,
  Target, Clock, Star, User, Bot, CheckCircle,
  ChevronRight, ThumbsUp, AlertCircle, TrendingUp,
  Mic, Sparkles, Zap,
} from "lucide-react";
import {
  buildInterviewSession,
  analyzeAnswer,
  buildSessionReport,
  InterviewQuestion,
  AnswerFeedback,
  InterviewType,
  SessionReport,
} from "../lib/oralia-data";
import { saveInterviewSession } from "@/lib/localStorage";
import { useAuth } from "@/contexts/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// Types locaux
// ─────────────────────────────────────────────────────────────────────────────

interface MessageEntry {
  id: string;
  role: "interviewer" | "user";
  content: string;
  question?: InterviewQuestion;
  feedback?: AnswerFeedback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<InterviewType, string> = {
  stage: "Stage",
  alternance: "Alternance",
  emploi: "Premier emploi",
  parcoursup: "Entretien Parcoursup",
  ecole: "Oral école",
};

const SECTORS = [
  "Marketing / Communication",
  "Commerce / Vente",
  "Finance / Comptabilité",
  "Informatique / Tech",
  "Design / Créatif",
  "Droit / Juridique",
  "Santé / Social",
  "Hôtellerie / Restauration",
  "BTP / Construction",
  "Éducation / Formation",
  "Autre",
];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function WordCountBar({ count }: { count: number }) {
  const optimal = count >= 80 && count <= 220;
  const tooShort = count < 40;
  const pct = Math.min((count / 250) * 100, 100);

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: tooShort ? "#F59E0B" : optimal ? "#10B981" : "#5044f5",
          }}
        />
      </div>
      <span
        className="text-[10px] tabular-nums flex-shrink-0"
        style={{
          color: tooShort ? "#F59E0B" : optimal ? "#10B981" : "#5044f5",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {count} mots{tooShort ? " — trop court" : optimal ? " — idéal" : count > 220 ? " — trop long" : ""}
      </span>
    </div>
  );
}

function FeedbackCard({ feedback }: { feedback: AnswerFeedback }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      className="mt-2 mx-2 rounded-xl overflow-hidden"
      style={{ background: "#f7f7ff", border: "1px solid rgba(80,68,245,0.1)" }}
    >
      <div className="p-4">
        {/* Score header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="size-4" style={{ color: feedback.scoreColor }} />
            <span className="text-[12px] font-bold" style={{ color: feedback.scoreColor }}>
              {feedback.scoreLabel}
            </span>
          </div>
          <div
            className="px-3 py-1 rounded-full text-[11px] font-black tabular-nums"
            style={{ background: `${feedback.scoreColor}15`, color: feedback.scoreColor, fontFamily: "Sora, system-ui, sans-serif" }}
          >
            {feedback.score}/100
          </div>
        </div>

        {/* STAR indicators */}
        <div className="flex gap-1.5 mb-3">
          {(["situation", "task", "action", "result"] as const).map((part) => {
            const labels = { situation: "S", task: "T", action: "A", result: "R" };
            const detected = feedback.starDetected[part];
            return (
              <div
                key={part}
                className="size-6 rounded flex items-center justify-center text-[10px] font-bold"
                style={{
                  background: detected ? "#5044f520" : "rgba(0,0,0,0.05)",
                  color: detected ? "#5044f5" : "#C4C4D4",
                  fontFamily: "ui-monospace, monospace",
                }}
                title={detected ? `${part} détecté` : `${part} non détecté`}
              >
                {labels[part]}
              </div>
            );
          })}
          <span className="text-[10px] self-center ml-1" style={{ color: "#9CA3AF" }}>Méthode STAR</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Points forts */}
          <div>
            <p className="text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: "#10B981" }}>
              <ThumbsUp className="size-3" /> Points forts
            </p>
            {feedback.strengths.map((s, i) => (
              <p key={i} className="text-[11px] leading-snug mb-1" style={{ color: "#374151" }}>
                · {s}
              </p>
            ))}
          </div>
          {/* À améliorer */}
          <div>
            <p className="text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: "#F59E0B" }}>
              <AlertCircle className="size-3" /> À améliorer
            </p>
            {feedback.improvements.map((s, i) => (
              <p key={i} className="text-[11px] leading-snug mb-1" style={{ color: "#374151" }}>
                · {s}
              </p>
            ))}
          </div>
        </div>

        {/* Conseil personnalisé */}
        <div className="mt-3 p-2 rounded-lg" style={{ background: "rgba(80,68,245,0.06)" }}>
          <p className="text-[11px] leading-snug flex items-center gap-2" style={{ color: "#5044f5" }}>
            <Sparkles className="w-5 h-5 text-current flex-shrink-0" />
            <span>{feedback.tip}</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function SessionReportView({ report, onReset }: { report: SessionReport; onReset: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      {/* Score global */}
      <div
        className="rounded-2xl p-8 mb-6 text-center relative overflow-hidden"
        style={{ background: "#080719", border: "1px solid rgba(80,68,245,0.15)" }}
      >
        <div
          className="absolute inset-0 rounded-full blur-3xl pointer-events-none"
          style={{ background: `radial-gradient(circle at 50% 30%, ${report.scoreColor}30 0%, transparent 65%)` }}
        />
        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.2em] mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
            Résultat de session
          </p>
          <div
            className="text-8xl font-black tabular-nums mb-2"
            style={{ fontFamily: "Sora, system-ui, sans-serif", color: report.scoreColor, letterSpacing: "-0.04em" }}
          >
            {report.averageScore}
          </div>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>points sur 100</p>
          <div
            className="mt-4 inline-block px-4 py-1.5 rounded-full text-sm font-semibold"
            style={{ background: `${report.scoreColor}20`, color: report.scoreColor }}
          >
            {report.scoreLabel}
          </div>
        </div>
      </div>

      {/* Métriques */}
      <div
        className="grid grid-cols-2 gap-px mb-6 rounded-2xl overflow-hidden"
        style={{ background: "rgba(0,0,0,0.06)" }}
      >
        {report.categoryScores.map((cat, i) => (
          <div key={i} className="p-5" style={{ background: "white" }}>
            <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "#9CA3AF" }}>{cat.label}</p>
            <div className="flex items-end gap-2 mb-2">
              <span
                className="text-2xl font-black tabular-nums leading-none"
                style={{ fontFamily: "Sora, system-ui, sans-serif", color: "#070716" }}
              >
                {cat.score}
              </span>
              <span className="text-xs mb-0.5" style={{ color: "#C4C4D4" }}>/100</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${cat.score}%` }}
                transition={{ delay: 0.1 * i, duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: cat.color }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Points forts & améliorations */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {report.topStrengths.length > 0 && (
          <div className="rounded-xl p-5" style={{ background: "#F0FDF4", border: "1px solid #D1FAE5" }}>
            <p className="text-[10px] uppercase tracking-wider mb-3 flex items-center gap-1" style={{ color: "#10B981" }}>
              <ThumbsUp className="size-3" /> Tes points forts
            </p>
            {report.topStrengths.map((s, i) => (
              <p key={i} className="text-[12px] leading-snug mb-1.5" style={{ color: "#065F46" }}>· {s}</p>
            ))}
          </div>
        )}
        {report.topImprovements.length > 0 && (
          <div className="rounded-xl p-5" style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
            <p className="text-[10px] uppercase tracking-wider mb-3 flex items-center gap-1" style={{ color: "#F59E0B" }}>
              <TrendingUp className="size-3" /> À travailler
            </p>
            {report.topImprovements.map((s, i) => (
              <p key={i} className="text-[12px] leading-snug mb-1.5" style={{ color: "#92400E" }}>· {s}</p>
            ))}
          </div>
        )}
      </div>

      {/* Conseil global */}
      <div className="rounded-xl p-5 mb-6" style={{ background: "#efedff", border: "1px solid rgba(80,68,245,0.12)" }}>
        <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#5044f5" }}>
          Conseil OralIA
        </p>
        <p className="text-[13px] leading-relaxed" style={{ color: "#3730A3" }}>
          {report.globalTip}
        </p>
      </div>

      <button
        onClick={onReset}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2"
        style={{ background: "#080719", color: "white" }}
      >
        <RotateCcw className="size-4" />
        Nouvelle simulation
      </button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function Interview() {
  useSEO({ title: "Simulation entretien OralIA — Cadova", noindex: true });
  const { user } = useAuth();

  // Config
  const [interviewType, setInterviewType] = useState<InterviewType>("stage");
  const [sector, setSector] = useState("");
  const [pressureMode, setPressureMode] = useState(false);

  // Session state
  const [phase, setPhase] = useState<"setup" | "interview" | "report">("setup");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [questionIdx, setQuestionIdx] = useState(0);
  const [feedbacks, setFeedbacks] = useState<AnswerFeedback[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [showFeedback, setShowFeedback] = useState(true);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const wordCount = currentAnswer.trim().split(/\s+/).filter(Boolean).length;

  // ── Start session ──────────────────────────────────────────────────

  const handleStart = () => {
    const sessionQuestions = buildInterviewSession(interviewType, sector);
    setQuestions(sessionQuestions);
    setPhase("interview");

    // First question message with small delay
    setTimeout(() => {
      setMessages([
        {
          id: "intro",
          role: "interviewer",
          content: sessionQuestions[0].text,
          question: sessionQuestions[0],
        },
      ]);
      setQuestionIdx(0);
    }, 200);
  };

  // ── Send answer ────────────────────────────────────────────────────

  const handleSend = () => {
    if (!currentAnswer.trim() || isTyping) return;

    const currentQ = questions[questionIdx];
    const feedback = analyzeAnswer(currentAnswer, currentQ);

    const userMsg: MessageEntry = {
      id: `user-${questionIdx}`,
      role: "user",
      content: currentAnswer,
      question: currentQ,
      feedback,
    };

    const newFeedbacks = [...feedbacks, feedback];
    setFeedbacks(newFeedbacks);
    setMessages((prev) => [...prev, userMsg]);
    setCurrentAnswer("");

    const nextIdx = questionIdx + 1;

    if (nextIdx < questions.length) {
      // Simulate interviewer "typing"
      setIsTyping(true);
      const delay = pressureMode ? 600 : 1200 + Math.random() * 800;
      setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `q-${nextIdx}`,
            role: "interviewer",
            content: questions[nextIdx].text,
            question: questions[nextIdx],
          },
        ]);
        setQuestionIdx(nextIdx);
      }, delay);
    } else {
      // End of session
      const finalReport = buildSessionReport(newFeedbacks);
      setReport(finalReport);

      // Save to localStorage
      if (user?.id) {
        saveInterviewSession({
          userId: user.id,
          type: interviewType,
          sector: sector || undefined,
          score: finalReport.averageScore,
          questionsCount: questions.length,
        });
      }

      setTimeout(() => setPhase("report"), 1000);
    }
  };

  // ── Reset ──────────────────────────────────────────────────────────

  const handleReset = () => {
    setPhase("setup");
    setQuestions([]);
    setMessages([]);
    setCurrentAnswer("");
    setQuestionIdx(0);
    setFeedbacks([]);
    setIsTyping(false);
    setReport(null);
  };

  const avgScore = feedbacks.length > 0
    ? Math.round(feedbacks.reduce((s, f) => s + f.score, 0) / feedbacks.length)
    : null;

  // ─────────────────────────────────────���───────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto" style={{ fontFamily: "Sora, system-ui, sans-serif" }}>

        {/* Header éditorial */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="size-9 rounded-xl flex items-center justify-center" style={{ background: "#EC489910" }}>
              <Mic className="size-4" style={{ color: "#EC4899" }} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em]" style={{ color: "#EC4899" }}>
                OralIA
              </p>
              <h1 className="font-black leading-none" style={{ fontFamily: "Sora, system-ui, sans-serif", color: "#070716", fontSize: "clamp(1.4rem, 3vw, 2rem)", letterSpacing: "-0.025em" }}>
                Simulation d'entretien
              </h1>
            </div>
          </div>
          <p className="text-sm ml-12" style={{ color: "#9CA3AF" }}>
            Réponds aux questions et reçois un feedback détaillé basé sur la méthode STAR.
          </p>
        </motion.div>

        {/* ══ SETUP ══ */}
        <AnimatePresence mode="wait">
          {phase === "setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="grid lg:grid-cols-3 gap-6"
            >
              {/* Config card */}
              <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                  <p className="text-[10px] uppercase tracking-[0.15em]" style={{ color: "#C4C4D4" }}>
                    Configuration
                  </p>
                </div>
                <div className="p-6 space-y-5">

                  {/* Type */}
                  <div>
                    <label className="text-[11px] uppercase tracking-wider block mb-2" style={{ color: "#9CA3AF" }}>
                      Type d'entretien
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(Object.entries(TYPE_LABELS) as [InterviewType, string][]).map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => setInterviewType(val)}
                          className="px-3 py-2.5 rounded-xl text-[12px] font-medium text-left transition-all"
                          style={{
                            background: interviewType === val ? "#EC489915" : "rgba(0,0,0,0.03)",
                            color: interviewType === val ? "#EC4899" : "#6B7280",
                            border: interviewType === val ? "1px solid #EC489930" : "1px solid transparent",
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Secteur */}
                  <div>
                    <label className="text-[11px] uppercase tracking-wider block mb-2" style={{ color: "#9CA3AF" }}>
                      Secteur (optionnel)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SECTORS.map((s) => (
                        <button
                          key={s}
                          onClick={() => setSector(sector === s ? "" : s)}
                          className="px-3 py-1.5 rounded-lg text-[11px] transition-all"
                          style={{
                            background: sector === s ? "#5044f515" : "rgba(0,0,0,0.03)",
                            color: sector === s ? "#5044f5" : "#9CA3AF",
                            border: sector === s ? "1px solid #5044f530" : "1px solid transparent",
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mode pression */}
                  <div
                    className="flex items-center justify-between p-4 rounded-xl"
                    style={{ background: pressureMode ? "#EC489910" : "rgba(0,0,0,0.02)", border: `1px solid ${pressureMode ? "#EC489930" : "transparent"}` }}
                  >
                    <div>
                      <p className="text-[13px] font-semibold" style={{ color: "#070716" }}>Mode pression</p>
                      <p className="text-[11px]" style={{ color: "#9CA3AF" }}>Questions enchaînées plus rapidement — simule un vrai entretien</p>
                    </div>
                    <button
                      onClick={() => setPressureMode(!pressureMode)}
                      className="relative w-10 h-5 rounded-full transition-all"
                      style={{ background: pressureMode ? "#EC4899" : "rgba(0,0,0,0.12)" }}
                    >
                      <div
                        className="absolute top-0.5 size-4 rounded-full bg-white shadow transition-all"
                        style={{ left: pressureMode ? "calc(100% - 18px)" : "2px" }}
                      />
                    </button>
                  </div>

                  {/* Info box */}
                  <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "#efedff" }}>
                    <Lightbulb className="size-4 flex-shrink-0 mt-0.5" style={{ color: "#5044f5" }} />
                    <div>
                      <p className="text-[12px] font-semibold mb-1" style={{ color: "#3730A3" }}>Comment ça marche ?</p>
                      <p className="text-[12px] leading-relaxed" style={{ color: "#5044f5" }}>
                        7 questions progressives (présentation → motivation → situations → compétences). Chaque réponse est analysée selon la méthode STAR : Situation, Tâche, Action, Résultat.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleStart}
                    className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #EC4899, #BE185D)", color: "white" }}
                  >
                    <Play className="size-4" />
                    Lancer la simulation — {questions.length > 0 ? questions.length : 7} questions
                  </button>
                </div>
              </div>

              {/* Question preview */}
              <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                  <p className="text-[10px] uppercase tracking-[0.15em]" style={{ color: "#C4C4D4" }}>
                    Exemples de questions
                  </p>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    { cat: "Présentation", q: "Présentez-vous en 2 minutes.", color: "#5044f5" },
                    { cat: "Motivation", q: "Pourquoi cette entreprise ?", color: "#EC4899" },
                    { cat: "Situation", q: "Parlez-moi d'un problème résolu.", color: "#10B981" },
                    { cat: "Compétence", q: "Vos outils maîtrisés ?", color: "#F59E0B" },
                    { cat: "Finale", q: "Avez-vous des questions ?", color: "#6b55f7" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span
                        className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0 mt-0.5"
                        style={{ background: `${item.color}15`, color: item.color }}
                      >
                        {item.cat}
                      </span>
                      <p className="text-[12px] leading-snug" style={{ color: "#6B7280" }}>
                        {item.q}
                      </p>
                    </div>
                  ))}
                  <div className="pt-3" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                    <p className="text-[11px]" style={{ color: "#9CA3AF" }}>
                      Les questions varient selon le type d'entretien et le secteur choisi.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══ INTERVIEW ══ */}
          {phase === "interview" && (
            <motion.div
              key="interview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid lg:grid-cols-3 gap-6"
            >
              {/* Chat window */}
              <div className="lg:col-span-2">
                <div
                  className="rounded-2xl overflow-hidden flex flex-col"
                  style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)", minHeight: "580px" }}
                >
                  {/* Header */}
                  <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #EC4899, #BE185D)" }}>
                        <Bot className="size-4 text-white" />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold" style={{ color: "#070716" }}>Recruteur OralIA</p>
                        <p className="text-[11px]" style={{ color: "#9CA3AF" }}>
                          Question {Math.min(questionIdx + 1, questions.length)}/{questions.length}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="size-4" style={{ color: "#C4C4D4" }} />
                      <span className="text-[11px]" style={{ color: "#C4C4D4" }}>~15 min</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: "3px", background: "rgba(0,0,0,0.04)" }}>
                    <motion.div
                      animate={{ width: `${((questionIdx) / questions.length) * 100}%` }}
                      transition={{ duration: 0.5 }}
                      style={{ height: "100%", background: "linear-gradient(90deg, #EC4899, #BE185D)" }}
                    />
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    <AnimatePresence>
                      {messages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                            {/* Avatar */}
                            <div
                              className="size-8 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{
                                background: msg.role === "interviewer"
                                  ? "linear-gradient(135deg, #EC4899, #BE185D)"
                                  : "linear-gradient(135deg, #5044f5, #6b55f7)",
                              }}
                            >
                              {msg.role === "interviewer"
                                ? <Bot className="size-4 text-white" />
                                : <User className="size-4 text-white" />}
                            </div>

                            {/* Bubble */}
                            <div
                              className="max-w-[78%] rounded-2xl px-4 py-3"
                              style={{
                                background: msg.role === "interviewer" ? "#F9FAFB" : "#5044f5",
                                color: msg.role === "interviewer" ? "#070716" : "white",
                                borderRadius: msg.role === "interviewer" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                              }}
                            >
                              <p className="text-[13px] leading-relaxed">{msg.content}</p>
                              {msg.role === "interviewer" && msg.question && (
                                <p className="text-[10px] mt-2 flex items-center gap-1" style={{ color: "#EC4899" }}>
                                  <Lightbulb className="size-3" />
                                  {msg.question.tip}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Feedback under user message */}
                          {msg.role === "user" && msg.feedback && showFeedback && (
                            <FeedbackCard feedback={msg.feedback} />
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {/* Typing indicator */}
                    {isTyping && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-3"
                      >
                        <div className="size-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #EC4899, #BE185D)" }}>
                          <Bot className="size-4 text-white" />
                        </div>
                        <div className="rounded-2xl px-4 py-3 flex items-center gap-1" style={{ background: "#F9FAFB", borderRadius: "4px 16px 16px 16px" }}>
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              animate={{ y: [0, -4, 0] }}
                              transition={{ duration: 0.5, delay: i * 0.12, repeat: Infinity }}
                              className="size-1.5 rounded-full"
                              style={{ background: "#EC4899" }}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}

                    <div ref={chatEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-4" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                    <WordCountBar count={wordCount} />
                    <div className="flex gap-3 mt-2">
                      <textarea
                        value={currentAnswer}
                        onChange={(e) => setCurrentAnswer(e.target.value)}
                        placeholder="Tape ta réponse ici… (Entrée pour envoyer, Shift+Entrée pour un saut de ligne)"
                        rows={3}
                        className="flex-1 resize-none rounded-xl px-4 py-3 text-[13px] outline-none transition-all"
                        style={{
                          background: "rgba(0,0,0,0.02)",
                          border: "1px solid rgba(0,0,0,0.08)",
                          color: "#070716",
                          fontFamily: "Sora, system-ui, sans-serif",
                        }}
                        disabled={isTyping}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                      />
                      <button
                        onClick={handleSend}
                        disabled={!currentAnswer.trim() || isTyping}
                        className="self-end px-4 py-3 rounded-xl transition-all hover:opacity-90 disabled:opacity-30"
                        style={{ background: "linear-gradient(135deg, #EC4899, #BE185D)", color: "white" }}
                      >
                        <Send className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel latéral */}
              <div className="space-y-4">

                {/* Score live */}
                <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid rgba(0,0,0,0.06)" }}>
                  <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                    <p className="text-[10px] uppercase tracking-[0.15em]" style={{ color: "#C4C4D4" }}>Score en direct</p>
                  </div>
                  <div className="p-5 text-center">
                    <div
                      className="text-5xl font-black tabular-nums mb-1"
                      style={{ fontFamily: "Sora, system-ui, sans-serif", color: avgScore ? (avgScore >= 70 ? "#10B981" : avgScore >= 50 ? "#F59E0B" : "#EF4444") : "#E5E7EB", letterSpacing: "-0.04em" }}
                    >
                      {avgScore ?? "—"}
                    </div>
                    <p className="text-[11px]" style={{ color: "#9CA3AF" }}>sur 100</p>
                    <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.05)" }}>
                      <motion.div
                        animate={{ width: `${avgScore ?? 0}%` }}
                        className="h-full rounded-full"
                        style={{ background: avgScore ? (avgScore >= 70 ? "#10B981" : "#F59E0B") : "#E5E7EB" }}
                      />
                    </div>
                    <div className="mt-3 flex justify-between text-[11px]" style={{ color: "#C4C4D4" }}>
                      <span>{feedbacks.length} rép.</span>
                      <span>{questions.length - feedbacks.length} restantes</span>
                    </div>
                  </div>
                </div>

                {/* Toggle feedback */}
                <button
                  onClick={() => setShowFeedback(!showFeedback)}
                  className="w-full px-4 py-3 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: showFeedback ? "#5044f510" : "rgba(0,0,0,0.04)",
                    color: showFeedback ? "#5044f5" : "#9CA3AF",
                    border: `1px solid ${showFeedback ? "#5044f530" : "transparent"}`,
                  }}
                >
                  <Star className="size-4" />
                  {showFeedback ? "Feedback affiché" : "Afficher le feedback"}
                </button>

                {/* Méthode STAR reminder */}
                <div className="rounded-2xl p-5" style={{ background: "#080719", border: "1px solid rgba(80,68,245,0.12)" }}>
                  <p className="text-[10px] uppercase tracking-[0.15em] mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>
                    Méthode STAR
                  </p>
                  {[
                    { letter: "S", word: "Situation", desc: "Pose le contexte" },
                    { letter: "T", word: "Tâche", desc: "Ton rôle / objectif" },
                    { letter: "A", word: "Action", desc: "Ce que tu as fait" },
                    { letter: "R", word: "Résultat", desc: "L'impact obtenu" },
                  ].map((item) => (
                    <div key={item.letter} className="flex items-start gap-3 mb-2.5">
                      <span
                        className="size-5 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                        style={{ background: "#5044f520", color: "#6b55f7", fontFamily: "ui-monospace, monospace" }}
                      >
                        {item.letter}
                      </span>
                      <div>
                        <span className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
                          {item.word}
                        </span>
                        <span className="text-[11px] ml-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                          {item.desc}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleReset}
                  className="w-full py-2.5 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-70"
                  style={{ background: "rgba(0,0,0,0.04)", color: "#9CA3AF" }}
                >
                  <RotateCcw className="size-3.5" />
                  Abandonner
                </button>
              </div>
            </motion.div>
          )}

          {/* ══ REPORT ══ */}
          {phase === "report" && report && (
            <motion.div
              key="report"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <SessionReportView report={report} onReset={handleReset} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
