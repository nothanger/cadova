import { Link } from "react-router";
import { motion } from "motion/react";
import { useState, useEffect } from "react";
import { useSEO } from "../hooks/useSEO";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  MessageSquare,
  Linkedin,
  LayoutDashboard,
  CheckCircle,
  Star,
  Menu,
  X,
  PenTool,
} from "lucide-react";
import { CadovaLogo } from "../components/CadovaLogo";

/* ─────────────────────────── DATA ─────────────────────────── */

const modules = [
  {
    id: "reussia",
    index: "01",
    name: "ReussIA",
    tagline: "CV · Lettres · ATS",
    description:
      "Génère des CVs optimisés ATS et des lettres sur-mesure en quelques secondes. L'IA analyse chaque offre pour maximiser tes chances.",
    accent: "#5548F5",
    icon: FileText,
    path: "/cv-generator",
    price: "4,99€/mois",
    features: ["Générateur CV IA", "Lettres sur-mesure", "Score ATS temps réel"],
  },
  {
    id: "oralia",
    index: "02",
    name: "OralIA",
    tagline: "Simulation d'entretien",
    description:
      "Entraîne-toi face à une IA qui joue le recruteur. Questions réalistes, feedback instantané sur tes réponses STAR.",
    accent: "#EC4899",
    icon: MessageSquare,
    path: "/interview",
    price: "5,99€/mois",
    features: ["Questions par métier", "Analyse des réponses", "Mode pression"],
  },
  {
    id: "trackia",
    index: "03",
    name: "TrackIA",
    tagline: "Suivi de candidatures",
    description:
      "Dashboard intelligent pour ne jamais perdre le fil. Pipeline visuel + carte des entreprises qui recrutent près de chez toi.",
    accent: "#10B981",
    icon: LayoutDashboard,
    path: "/dashboard",
    price: "3,99€/mois",
    features: ["Pipeline kanban", "Rappels automatiques", "Carte entreprises"],
  },
  {
    id: "skillia",
    index: "04",
    name: "SkillIA",
    tagline: "LinkedIn & Compétences",
    description:
      "Optimise ton profil LinkedIn et découvre les compétences qui font la différence dans ton secteur cible.",
    accent: "#F59E0B",
    icon: Linkedin,
    path: "/linkedin",
    price: "4,99€/mois",
    features: ["Analyse LinkedIn", "Roadmap compétences", "Résumé optimisé"],
  },
];

const testimonials = [
  {
    name: "Marie L.",
    role: "Étudiante Marketing",
    city: "Lyon",
    content:
      "J'ai décroché mon alternance en 2 semaines. Le score ATS m'a expliqué exactement pourquoi mes candidatures échouaient depuis des mois. J'aurais dû utiliser ça dès la L3.",
    rating: 5,
    tag: "Alternance décrochée",
  },
  {
    name: "Thomas D.",
    role: "Dev Junior",
    city: "Paris",
    content:
      "La simulation d'entretien m'a préparé à des questions que je n'aurais jamais anticipées. 3× plus de retours positifs.",
    rating: 5,
    tag: "3× plus de retours",
  },
  {
    name: "Sarah K.",
    role: "Commerce International",
    city: "Bordeaux",
    content:
      "Embauché en CDI à 23 ans. Le CV généré était bien meilleur que celui que j'avais mis des heures à construire.",
    rating: 5,
    tag: "CDI à 23 ans",
  },
];

const TICKER = [
  "ReussIA", "·", "OralIA", "·", "TrackIA", "·", "SkillIA",
  "·", "10 000 étudiants", "·", "89% de réussite", "·", "50 000+ CVs générés",
  "·", "Fait à Paris", "·",
];

/* ─────────────────────────── TERMINAL MOCK ─────────────────── */

function TerminalMock() {
  const lines = [
    { delay: 0,   text: "$ cadova analyse --cv=\"profil.pdf\" --poste=\"charge-marketing\"", color: "rgba(255,255,255,0.4)" },
    { delay: 0.5, text: "→  Lecture du CV en cours...", color: "rgba(255,255,255,0.2)" },
    { delay: 1.0, text: "✓  Score ATS : 94 / 100", color: "#10B981" },
    { delay: 1.3, text: "✓  Competences-cles : 12 / 15 trouvees", color: "#10B981" },
    { delay: 1.6, text: "⚠  3 points a ameliorer detectes", color: "#F59E0B" },
  ];

  return (
    <div>
      {/* Label contextuel au-dessus */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <div
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "#10B981",
            boxShadow: "0 0 6px rgba(16,185,129,0.8)",
          }}
        />
        <span
          style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.28)",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          Apercu — Analyse ATS en direct
        </span>
      </div>

      <div
        style={{
          background: "#0D0D22",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "10px",
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(85,72,245,0.1)",
        }}
      >
      {/* Chrome bar */}
      <div
        style={{
          padding: "11px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          alignItems: "center",
          gap: "7px",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {["#FF5F56", "#FFBD2E", "#27C93F"].map((c, i) => (
          <div key={i} style={{ width: "10px", height: "10px", borderRadius: "50%", background: c, opacity: 0.75 }} />
        ))}
        <span
          style={{
            marginLeft: "10px",
            fontSize: "11px",
            color: "rgba(255,255,255,0.2)",
            fontFamily: "'SF Mono', 'Fira Code', ui-monospace, monospace",
          }}
        >
          cadova — analyse ats
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          padding: "22px 20px 20px",
          fontFamily: "'SF Mono', 'Fira Code', ui-monospace, monospace",
          fontSize: "12.5px",
          lineHeight: "1.85",
        }}
      >
        {lines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: line.delay, duration: 0.25 }}
            style={{ color: line.color }}
          >
            {line.text}
          </motion.div>
        ))}

        {/* Recommendation block */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.2, duration: 0.4 }}
          style={{
            marginTop: "18px",
            padding: "14px 16px",
            background: "rgba(85,72,245,0.08)",
            border: "1px solid rgba(85,72,245,0.18)",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              fontSize: "9px",
              color: "#A78BFA",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: "9px",
              fontFamily: "'SF Mono', ui-monospace, monospace",
            }}
          >
            recommandations cadova
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", lineHeight: 1.7 }}>
            + Mentionner "gestion de projet" (mot-cle absent)
            <br />
            + Quantifier vos resultats (ex: +30% d'engagement)
          </div>
        </motion.div>

        {/* Blinking cursor */}
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ repeat: Infinity, duration: 1.1 }}
          style={{ color: "#5548F5", display: "inline-block", marginTop: "6px" }}
        >
          █
        </motion.span>
      </div>
    </div>
    </div>
  );
}

/* ─────────────────────────── MAIN ─────────────────────────── */

export function Landing() {
  useSEO({
    title: "Cadova — L'écosystème IA pour l'emploi des jeunes",
    description:
      "CV optimisé ATS, lettres de motivation sur-mesure, simulation d'entretien, suivi de candidatures et optimisation LinkedIn — l'IA au service de ta recherche d'emploi. Gratuit pour commencer.",
    canonical: "https://cadova.fr/",
    noindex: false,
  });

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (scrolled && menuOpen) setMenuOpen(false);
  }, [scrolled]);

  return (
    <div
      style={{
        fontFamily: "DM Sans, system-ui, sans-serif",
        background: "#F6F5FF",
        overflowX: "hidden",
      }}
    >

      {/* CSS global pour marquee + responsive */}
      <style>{`
        @keyframes cadova-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .cadova-marquee-track {
          display: flex;
          animation: cadova-marquee 22s linear infinite;
          width: max-content;
        }
        .hero-terminal-mobile {
          display: none;
        }
        @media (max-width: 768px) {
          .hero-grid {
            grid-template-columns: 1fr !important;
            min-height: auto !important;
            gap: 28px !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
          }
          .hero-copy {
            padding-top: 20px !important;
            padding-bottom: 28px !important;
            max-width: 100% !important;
          }
          .hero-title {
            font-size: clamp(2.6rem, 15vw, 4.2rem) !important;
            line-height: 0.98 !important;
            margin-bottom: 22px !important;
            max-width: 100% !important;
            overflow-wrap: break-word !important;
            word-break: break-word !important;
            white-space: normal !important;
          }
          .hero-title span {
            max-width: 100% !important;
            overflow-wrap: break-word !important;
            word-break: break-word !important;
            white-space: normal !important;
          }
          .hero-body {
            max-width: 100% !important;
          }
          .hero-ctas {
            margin-bottom: 30px !important;
          }
        }
        @media (max-width: 640px) {
          .hero-grid {
            padding-top: 18px !important;
            padding-bottom: 42px !important;
          }
          .hero-copy {
          }
          .hero-overline {
            margin-bottom: 24px !important;
            gap: 10px !important;
            flex-wrap: wrap !important;
          }
          .hero-overline-text {
            font-size: 10px !important;
            line-height: 1.5 !important;
          }
          .hero-title {
            font-size: clamp(2.35rem, 14vw, 3.8rem) !important;
          }
          .hero-body {
            font-size: 15px !important;
            line-height: 1.7 !important;
            margin-bottom: 28px !important;
          }
          .hero-ctas {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 14px !important;
          }
          .hero-primary-cta {
            width: 100% !important;
            justify-content: center !important;
            padding: 15px 18px !important;
            font-size: 15px !important;
          }
          .hero-secondary-cta {
            display: block !important;
            width: 100% !important;
            text-align: center !important;
          }
          .hero-terminal-mobile {
            display: block !important;
            margin-bottom: 28px !important;
          }
          .hero-terminal-mobile > div {
            max-width: 100% !important;
          }
          .hero-terminal-proof {
            margin-top: 12px !important;
          }
          .hero-stats {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 16px 12px !important;
            padding-top: 20px !important;
          }
          .hero-stat {
            min-width: 0 !important;
          }
          .modules-header {
            display: block !important;
          }
          .modules-header-cta {
            display: inline-flex !important;
            margin-top: 20px !important;
          }
          .modules-row {
            grid-template-columns: 1fr auto !important;
            gap: 12px !important;
            align-items: flex-start !important;
            padding: 22px 0 !important;
          }
          .modules-index {
            display: none !important;
          }
          .modules-main {
            grid-column: 1 / 2 !important;
          }
          .modules-tagline {
            display: block !important;
            margin-top: 6px !important;
          }
          .modules-features {
            max-height: none !important;
            overflow: visible !important;
            margin-top: 10px !important;
          }
          .modules-price {
            display: block !important;
            text-align: left !important;
            white-space: normal !important;
            margin-top: 10px !important;
          }
          .modules-arrow {
            width: 34px !important;
            height: 34px !important;
          }
          .pro-strip {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .pro-strip-meta {
            width: 100% !important;
            justify-content: space-between !important;
            gap: 18px !important;
            flex-wrap: wrap !important;
          }
          .featured-testimonial-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .featured-testimonial-stars {
            flex-direction: row !important;
            align-self: flex-start !important;
          }
          .testi-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .step-card {
            border-left: none !important;
            border-top: 1px solid rgba(0,0,0,0.07) !important;
            padding: 24px 0 0 !important;
            margin-top: 24px !important;
          }
          .step-card:first-child {
            border-top: none !important;
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          .footer-cols { grid-template-columns: 1fr !important; }
          .footer-brand { grid-column: auto !important; }
          .footer-bottom {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
        }
        @media (max-width: 900px) {
          .modules-features {
            max-height: none !important;
            overflow: visible !important;
            margin-top: 10px !important;
          }
          .modules-price {
            display: block !important;
          }
        }
      `}</style>

      {/* ══════════════════════════════════════════
          NAV
      ══════════════════════════════════════════ */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          transition: "background 0.4s, border-color 0.4s",
          background:
            scrolled || menuOpen
              ? "rgba(8,8,26,0.95)"
              : "transparent",
          backdropFilter: scrolled || menuOpen ? "blur(20px)" : "none",
          borderBottom:
            scrolled
              ? "1px solid rgba(255,255,255,0.06)"
              : "1px solid transparent",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 clamp(20px, 4vw, 48px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: "80px",
            }}
          >
            <Link
              to="/"
              style={{
                display: "flex",
                alignItems: "center",
                minHeight: "80px",
              }}
            >
              <CadovaLogo width={66} maxHeight={62} white />
            </Link>

            {/* Desktop */}
            <div className="hidden sm:flex" style={{ alignItems: "center", gap: "6px" }}>
              <Link
                to="/login"
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: "14px",
                  textDecoration: "none",
                  padding: "8px 16px",
                  letterSpacing: "-0.01em",
                }}
              >
                Connexion
              </Link>
              <Link to="/signup">
                <button
                  style={{
                    background: "white",
                    color: "#0C0B1A",
                    padding: "10px 22px",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "14px",
                    letterSpacing: "-0.02em",
                    transition: "opacity 0.15s, transform 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "0.92";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "1";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  Commencer gratuit
                </button>
              </Link>
            </div>

            {/* Mobile */}
            <div className="flex sm:hidden" style={{ alignItems: "center", gap: "10px" }}>
              <Link to="/signup">
                <button
                  style={{
                    background: "white",
                    color: "#0C0B1A",
                    padding: "9px 18px",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "13px",
                  }}
                >
                  Essayer
                </button>
              </Link>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                  width: "38px",
                  height: "38px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "6px",
                  cursor: "pointer",
                  color: "white",
                }}
              >
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              borderTop: "1px solid rgba(255,255,255,0.05)",
              padding: "12px 24px 20px",
            }}
          >
            {modules.map((m) => (
              <Link key={m.id} to={m.path} onClick={() => setMenuOpen(false)} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "13px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: m.accent }} />
                    <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "14px", fontWeight: 500 }}>
                      {m.name}
                    </span>
                  </div>
                  <ArrowRight size={14} style={{ color: m.accent }} />
                </div>
              </Link>
            ))}
            <div style={{ paddingTop: "16px" }}>
              <Link to="/login" onClick={() => setMenuOpen(false)} style={{ textDecoration: "none" }}>
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: "14px" }}>
                  Se connecter
                </div>
              </Link>
            </div>
          </motion.div>
        )}
      </nav>

      {/* ══════════════════════════════════════════
          HERO — asymétrique, terminal mock, stats inline
      ══════════════════════════════════════════ */}
      <section
        style={{
          background: "#08081A",
          minHeight: "100vh",
          paddingTop: "62px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Lumières d'ambiance — couvrent toute la section sans coupure */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(85,72,245,0.13) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-60px",
            right: "10%",
            width: "600px",
            height: "450px",
            background:
              "radial-gradient(ellipse at 70% 80%, rgba(236,72,153,0.06) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />



        <div
          className="hero-grid"
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 clamp(20px, 4vw, 48px)",
            display: "grid",
            gridTemplateColumns: "1fr 420px",
            gap: "clamp(32px, 5vw, 64px)",
            minHeight: "calc(100vh - 62px)",
            alignItems: "center",
          }}
        >
          {/* ── Left : texte principal ── */}
          <div className="hero-copy" style={{ paddingTop: "48px", paddingBottom: "80px" }}>

            {/* Overline — comme un debug log */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="hero-overline"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "40px",
              }}
            >
              <div style={{ width: "18px", height: "1px", background: "#5548F5" }} />
              <span
                className="hero-overline-text"
                style={{
                  color: "rgba(255,255,255,0.3)",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                Pour les 18–25 ans · Propulsé par l'IA
              </span>
            </motion.div>

            {/* H1 — variation de poids intentionnelle sur 3 lignes */}
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7 }}
              className="hero-title"
              style={{
                fontFamily: "Syne, sans-serif",
                fontSize: "clamp(2.9rem, 7.5vw, 6rem)",
                lineHeight: 1.01,
                letterSpacing: "-0.045em",
                margin: 0,
                marginBottom: "30px",
              }}
            >
              <span
                style={{
                  color: "rgba(255,255,255,0.22)",
                  fontWeight: 300,
                  display: "block",
                  letterSpacing: "-0.03em",
                }}
              >
                L'IA qui
              </span>
              <span style={{ color: "white", fontWeight: 800, display: "block" }}>
                décuple tes
              </span>
              <span
                style={{
                  fontWeight: 800,
                  display: "block",
                  backgroundImage:
                    "linear-gradient(88deg, #A78BFA 0%, #5548F5 42%, #EC4899 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                chances.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="hero-body"
              style={{
                color: "rgba(255,255,255,0.36)",
                fontSize: "16px",
                lineHeight: 1.75,
                maxWidth: "420px",
                marginBottom: "44px",
              }}
            >
              4 modules IA intégrés — CV, entretiens, candidatures, LinkedIn.
              Conçu pour décrocher ton stage, alternance ou premier CDI.
            </motion.p>

            {/* CTAs — bouton sharp + lien texte */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
              className="hero-ctas"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "22px",
                flexWrap: "wrap",
                marginBottom: "60px",
              }}
            >
              <Link to="/signup" style={{ textDecoration: "none" }}>
                <button
                  className="hero-primary-cta"
                  style={{
                    background: "#5548F5",
                    color: "white",
                    padding: "15px 32px",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "15px",
                    letterSpacing: "-0.02em",
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    transition: "background 0.15s, transform 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#4338E0";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#5548F5";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = "translateY(0) scale(0.98)";
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = "translateY(-1px) scale(1)";
                  }}
                >
                  Essai gratuit 14 jours
                  <ArrowRight size={16} />
                </button>
              </Link>
              <Link
                className="hero-secondary-cta"
                to="/login"
                style={{
                  color: "rgba(255,255,255,0.32)",
                  fontSize: "14px",
                  textDecoration: "none",
                  letterSpacing: "-0.01em",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.color =
                    "rgba(255,255,255,0.6)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.color =
                    "rgba(255,255,255,0.32)";
                }}
              >
                Déjà un compte →
              </Link>
            </motion.div>

            {/* Stats inline �� pas un strip séparé */}
            <div className="hero-terminal-mobile lg:hidden">
              <TerminalMock />
              <div
                className="hero-terminal-proof"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.15)",
                  borderRadius: "8px",
                }}
              >
                <div
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: "#10B981",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.45)",
                    fontFamily: "ui-monospace, monospace",
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: "#10B981", fontWeight: 600 }}>3 247 étudiants</span>{" "}
                  ont analysé leur CV cette semaine
                </span>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="hero-stats"
              style={{
                display: "flex",
                gap: "clamp(24px, 5vw, 48px)",
                paddingTop: "28px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {[
                { value: "10K+", label: "étudiants" },
                { value: "89%", label: "réussite" },
                { value: "50K+", label: "CVs générés" },
                { value: "4.8★", label: "note" },
              ].map((s) => (
                <div key={s.label} className="hero-stat">
                  <div
                    style={{
                      fontFamily: "Syne, sans-serif",
                      fontSize: "clamp(1.4rem, 2.8vw, 2rem)",
                      fontWeight: 800,
                      color: "white",
                      letterSpacing: "-0.04em",
                      lineHeight: 1,
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "rgba(255,255,255,0.22)",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      marginTop: "5px",
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── Right : terminal mock — desktop seulement ── */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.8 }}
            className="hidden lg:block"
            style={{ alignSelf: "center" }}
          >
            <TerminalMock />

            {/* Tag social proof flottant sous le terminal */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3.2 }}
              style={{
                marginTop: "16px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 16px",
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.15)",
                borderRadius: "8px",
              }}
            >
              <div
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: "#10B981",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.45)",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                <span style={{ color: "#10B981", fontWeight: 600 }}>3 247 étudiants</span>{" "}
                ont analysé leur CV cette semaine
              </span>
            </motion.div>
          </motion.div>
        </div>

        {/* Séparateur bas — ligne colorée, pas une vague */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "1px",
            background:
              "linear-gradient(90deg, transparent 0%, rgba(85,72,245,0.6) 30%, rgba(236,72,153,0.4) 70%, transparent 100%)",
          }}
        />
      </section>

      {/* ═══════════════���══════════════════════════
          TICKER — bande indigo, résultats + modules
      ══════════════════════════════════════════ */}
      <div
        style={{
          background: "#5548F5",
          overflow: "hidden",
          padding: "13px 0",
        }}
      >
        <div className="cadova-marquee-track">
          {[...TICKER, ...TICKER].map((item, i) => (
            <span
              key={i}
              style={{
                color:
                  item === "·"
                    ? "rgba(255,255,255,0.35)"
                    : "rgba(255,255,255,0.82)",
                fontSize: "13px",
                fontWeight: item === "·" ? 300 : 600,
                letterSpacing: item === "·" ? "0" : "-0.01em",
                padding: "0 18px",
                whiteSpace: "nowrap",
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          MODULES — liste éditoriale, pas de cards
      ═════════════════════════════════��════════ */}
      <section
        style={{
          background: "#F6F5FF",
          padding: "clamp(64px, 10vh, 120px) clamp(20px, 4vw, 48px)",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

          {/* Header — pas centré, asymétrique */}
          <div
            className="modules-header"
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginBottom: "clamp(40px, 6vh, 72px)",
              gap: "24px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  color: "#A0A0C0",
                  marginBottom: "18px",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                — Ce que Cadova fait
              </div>
              <h2
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontSize: "clamp(2rem, 5vw, 3.6rem)",
                  fontWeight: 800,
                  color: "#0C0B1A",
                  letterSpacing: "-0.04em",
                  lineHeight: 1.04,
                  margin: 0,
                }}
              >
                Un écosystème complet,
                <br />
                <span style={{ color: "#5548F5" }}>pas juste un outil.</span>
              </h2>
            </div>
            <Link
              to="/signup"
              className="modules-header-cta"
              style={{ textDecoration: "none", flexShrink: 0 }}
            >
              <button
                style={{
                  border: "1.5px solid rgba(85,72,245,0.28)",
                  background: "transparent",
                  color: "#5548F5",
                  padding: "12px 22px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                  letterSpacing: "-0.01em",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(85,72,245,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                Accéder aux modules →
              </button>
            </Link>
          </div>

          {/* Liste éditoriale */}
          <div>
            {modules.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.5 }}
                viewport={{ once: true }}
                onMouseEnter={() => setHoveredModule(m.id)}
                onMouseLeave={() => setHoveredModule(null)}
              >
                <Link to={m.path} style={{ textDecoration: "none" }}>
                  <div
                    className="modules-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "56px 1fr 120px 44px",
                      alignItems: "center",
                      gap: "clamp(14px, 3vw, 36px)",
                      padding: "clamp(20px, 3vw, 30px) 0",
                      borderBottom: "1px solid rgba(0,0,0,0.07)",
                      cursor: "pointer",
                      transition: "padding-left 0.2s",
                      paddingLeft: hoveredModule === m.id ? "8px" : "0",
                    }}
                  >
                    {/* Index monospace */}
                    <span
                      className="modules-index"
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: "12px",
                        color:
                          hoveredModule === m.id
                            ? m.accent
                            : "rgba(0,0,0,0.18)",
                        transition: "color 0.2s",
                        fontWeight: 500,
                      }}
                    >
                      {m.index}
                    </span>

                    {/* Nom + description révélée au hover */}
                    <div className="modules-main">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: "12px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "Syne, sans-serif",
                            fontSize: "clamp(1.25rem, 2.8vw, 1.75rem)",
                            fontWeight: 700,
                            color:
                              hoveredModule === m.id ? m.accent : "#0C0B1A",
                            letterSpacing: "-0.035em",
                            transition: "color 0.18s",
                          }}
                        >
                          {m.name}
                        </span>
                        <span
                          className="modules-tagline"
                          style={{
                            fontSize: "13px",
                            color: "#9B9BBF",
                            fontWeight: 400,
                          }}
                        >
                          {m.tagline}
                        </span>
                      </div>

                      {/* Features révélées au hover */}
                      <div
                        className="modules-features"
                        style={{
                          maxHeight: hoveredModule === m.id ? "36px" : "0",
                          overflow: "hidden",
                          transition: "max-height 0.28s ease",
                          marginTop: hoveredModule === m.id ? "7px" : "0",
                        }}
                      >
                        <div style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
                          {m.features.map((f) => (
                            <span
                              key={f}
                              style={{
                                fontSize: "12px",
                                color: m.accent,
                                fontWeight: 500,
                              }}
                            >
                              ✓ {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Prix */}
                    <span
                      className="modules-price"
                      style={{
                        fontSize: "13px",
                        color: "#A0A0C0",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        textAlign: "right",
                        fontFamily: "ui-monospace, monospace",
                      }}
                    >
                      {m.price}
                    </span>

                    {/* Flèche ronde */}
                    <div
                      className="modules-arrow"
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background:
                          hoveredModule === m.id
                            ? m.accent
                            : "rgba(0,0,0,0.05)",
                        transition: "background 0.2s",
                        flexShrink: 0,
                      }}
                    >
                      <ArrowUpRight
                        size={16}
                        style={{
                          color:
                            hoveredModule === m.id ? "white" : "#9B9BBF",
                          transition: "color 0.2s",
                        }}
                      />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Pack Pro — bande dark inline, pas une card de plus */}
          <motion.div
            className="pro-strip"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{
              marginTop: "36px",
              padding: "clamp(20px, 3vw, 32px) clamp(20px, 3vw, 36px)",
              background: "#0C0B1A",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "24px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "10px",
                  color: "rgba(255,255,255,0.28)",
                  marginBottom: "7px",
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                ★ Meilleure offre
              </div>
              <div
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontSize: "clamp(1.1rem, 2.5vw, 1.55rem)",
                  fontWeight: 700,
                  color: "white",
                  letterSpacing: "-0.03em",
                }}
              >
                Pack Cadova Pro — tous les modules
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.32)",
                  marginTop: "5px",
                }}
              >
                Accès illimité · Support prioritaire · Mises à jour incluses
              </div>
            </div>
            <div
              className="pro-strip-meta"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "24px",
                flexShrink: 0,
              }}
            >
              <div>
                <span
                  style={{
                    fontFamily: "Syne, sans-serif",
                    fontSize: "clamp(1.7rem, 3.5vw, 2.3rem)",
                    fontWeight: 800,
                    color: "white",
                    letterSpacing: "-0.04em",
                  }}
                >
                  11,99€
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    color: "rgba(255,255,255,0.28)",
                    marginLeft: "3px",
                  }}
                >
                  /mois
                </span>
                <div
                  style={{
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.2)",
                    marginTop: "2px",
                  }}
                >
                  ou 59€/an (offre étudiante)
                </div>
              </div>
              <Link to="/signup" style={{ textDecoration: "none" }}>
                <button
                  style={{
                    background: "#5548F5",
                    color: "white",
                    padding: "13px 24px",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "14px",
                    whiteSpace: "nowrap",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#4338E0";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#5548F5";
                  }}
                >
                  Débloquer tout →
                </button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          TÉMOIGNAGES — grille asymétrique (1 grand + 2 petits)
      ══════════════════════════════════════════ */}
      <section
        style={{
          background: "white",
          padding: "clamp(64px, 10vh, 120px) clamp(20px, 4vw, 48px)",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

          <div style={{ marginBottom: "44px" }}>
            <span
              style={{
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "#A0A0C0",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              — Ils ont réussi avec Cadova
            </span>
            <h2
              style={{
                fontFamily: "Syne, sans-serif",
                fontSize: "clamp(1.8rem, 4vw, 3rem)",
                fontWeight: 800,
                color: "#0C0B1A",
                letterSpacing: "-0.04em",
                marginTop: "14px",
                lineHeight: 1.05,
              }}
            >
              Des résultats réels,
              <br />
              <span style={{ color: "#5548F5" }}>pas des promesses.</span>
            </h2>
          </div>

          {/* Témoignage principal — full width, dark, grand */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{
              background: "#08081A",
              borderRadius: "12px",
              padding: "clamp(32px, 5vw, 56px)",
              marginBottom: "14px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Guillemet décoratif — grand et translucide */}
            <div
              style={{
                position: "absolute",
                top: "-24px",
                right: "36px",
                fontFamily: "Syne, sans-serif",
                fontSize: "clamp(120px, 18vw, 220px)",
                color: "rgba(85,72,245,0.05)",
                lineHeight: 1,
                fontWeight: 800,
                userSelect: "none",
                pointerEvents: "none",
              }}
            >
              "
            </div>

            <div
              className="featured-testimonial-grid"
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "24px",
                alignItems: "flex-end",
              }}
            >
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 12px",
                    background: "rgba(85,72,245,0.15)",
                    borderRadius: "4px",
                    marginBottom: "24px",
                  }}
                >
                  <CheckCircle size={12} style={{ color: "#A78BFA" }} />
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#A78BFA",
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {testimonials[0].tag}
                  </span>
                </div>

                <p
                  style={{
                    fontFamily: "Syne, sans-serif",
                    fontSize: "clamp(1.1rem, 3vw, 1.6rem)",
                    color: "white",
                    lineHeight: 1.55,
                    fontWeight: 500,
                    letterSpacing: "-0.025em",
                    marginBottom: "28px",
                    maxWidth: "660px",
                  }}
                >
                  "{testimonials[0].content}"
                </p>

                <div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    {testimonials[0].name}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.28)",
                      marginTop: "3px",
                    }}
                  >
                    {testimonials[0].role} · {testimonials[0].city}
                  </div>
                </div>
              </div>

              {/* Étoiles verticales */}
              <div
                className="featured-testimonial-stars"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  alignSelf: "flex-start",
                }}
              >
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={13}
                    style={{ fill: "#F59E0B", color: "#F59E0B" }}
                  />
                ))}
              </div>
            </div>
          </motion.div>

          {/* Deux petits témoignages — largeurs inégales */}
          <div
            className="testi-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "3fr 2fr",
              gap: "14px",
            }}
          >
            {testimonials.slice(1).map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.1 }}
                viewport={{ once: true }}
                style={{
                  background: i === 0 ? "#F6F5FF" : "#FFF8EE",
                  borderRadius: "12px",
                  padding: "clamp(24px, 3.5vw, 36px)",
                  border:
                    i === 0
                      ? "1px solid rgba(85,72,245,0.09)"
                      : "1px solid rgba(245,158,11,0.12)",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    background:
                      i === 0
                        ? "rgba(85,72,245,0.08)"
                        : "rgba(245,158,11,0.1)",
                    borderRadius: "4px",
                    marginBottom: "16px",
                  }}
                >
                  <CheckCircle
                    size={11}
                    style={{ color: i === 0 ? "#5548F5" : "#D97706" }}
                  />
                  <span
                    style={{
                      fontSize: "11px",
                      color: i === 0 ? "#5548F5" : "#D97706",
                      fontWeight: 600,
                    }}
                  >
                    {t.tag}
                  </span>
                </div>

                <p
                  style={{
                    fontSize: "15px",
                    color: "#374151",
                    lineHeight: 1.68,
                    marginBottom: "22px",
                    fontStyle: "italic",
                  }}
                >
                  "{t.content}"
                </p>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#0C0B1A",
                      }}
                    >
                      {t.name}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#9CA3AF",
                        marginTop: "2px",
                      }}
                    >
                      {t.role} · {t.city}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "2px" }}>
                    {[...Array(t.rating)].map((_, j) => (
                      <Star
                        key={j}
                        size={11}
                        style={{ fill: "#F59E0B", color: "#F59E0B" }}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          COMMENT ÇA MARCHE — 3 étapes numérotées
      ══════════════════════════════════════════ */}
      <section
        style={{
          background: "#F6F5FF",
          padding: "clamp(64px, 10vh, 120px) clamp(20px, 4vw, 48px)",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

          <div style={{ marginBottom: "clamp(44px, 7vh, 80px)" }}>
            <div
              style={{
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "#A0A0C0",
                fontFamily: "ui-monospace, monospace",
                marginBottom: "16px",
              }}
            >
              — Comment ça marche
            </div>
            <h2
              style={{
                fontFamily: "Syne, sans-serif",
                fontSize: "clamp(1.8rem, 4vw, 3rem)",
                fontWeight: 800,
                color: "#0C0B1A",
                letterSpacing: "-0.04em",
                lineHeight: 1.05,
                maxWidth: "520px",
              }}
            >
              3 étapes.
              <br />
              Des résultats en semaine.
            </h2>
          </div>

          <div
            className="steps-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0",
            }}
          >
            {[
              {
                num: "01",
                title: "Crée ton profil",
                desc: "Renseigne ton secteur, tes compétences, tes ambitions. L'IA calibre tous les modules en fonction de ton profil unique.",
                accent: "#5548F5",
              },
              {
                num: "02",
                title: "Active les modules",
                desc: "Génère ton CV en 30 secondes. Entraîne-toi à l'oral. Suis tes candidatures. Optimise ton LinkedIn. Tout depuis un seul endroit.",
                accent: "#EC4899",
              },
              {
                num: "03",
                title: "Décroche ton poste",
                desc: "CV optimisé ATS, entretiens préparés, profil LinkedIn percutant. Les recruteurs viennent à toi — pas l'inverse.",
                accent: "#10B981",
              },
            ].map((step, i) => (
              <motion.div
                className="step-card"
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                viewport={{ once: true }}
                style={{
                  padding: "clamp(24px, 4vw, 44px)",
                  borderLeft: i > 0 ? "1px solid rgba(0,0,0,0.07)" : "none",
                  position: "relative",
                }}
              >
                {/* Grand numéro en fond */}
                <div
                  style={{
                    fontFamily: "Syne, sans-serif",
                    fontSize: "clamp(3.5rem, 6vw, 5rem)",
                    fontWeight: 800,
                    color: step.accent,
                    opacity: 0.12,
                    lineHeight: 1,
                    marginBottom: "20px",
                    letterSpacing: "-0.06em",
                    userSelect: "none",
                  }}
                >
                  {step.num}
                </div>

                {/* Petit numéro actuel */}
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: step.accent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "16px",
                    opacity: 0.9,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: "11px",
                      color: "white",
                      fontWeight: 700,
                    }}
                  >
                    {i + 1}
                  </span>
                </div>

                <h3
                  style={{
                    fontFamily: "Syne, sans-serif",
                    fontSize: "clamp(1.1rem, 2.2vw, 1.3rem)",
                    fontWeight: 700,
                    color: "#0C0B1A",
                    letterSpacing: "-0.025em",
                    marginBottom: "12px",
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#6B6B8A",
                    lineHeight: 1.72,
                  }}
                >
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CTA FINAL — dark, "CADOVA" en fond outlined
      ══════════════════════════════════════════ */}
      <section
        style={{
          background: "#08081A",
          padding: "clamp(80px, 15vh, 160px) clamp(20px, 4vw, 48px)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Texte géant "CADOVA" en fond — outlined, pas plein */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: "clamp(10rem, 26vw, 24rem)",
              fontWeight: 900,
              color: "transparent",
              WebkitTextStroke: "1px rgba(255,255,255,0.027)",
              letterSpacing: "-0.06em",
              userSelect: "none",
              whiteSpace: "nowrap",
            }}
          >
            CADOVA
          </span>
        </div>

        {/* Lumière derrière le texte */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "500px",
            height: "300px",
            background:
              "radial-gradient(ellipse, rgba(85,72,245,0.12) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            position: "relative",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ maxWidth: "560px" }}
          >
            {/* Logo */}
            <div style={{ marginBottom: "32px" }}>
              <CadovaLogo width={68} white />
            </div>

            <h2
              style={{
                fontFamily: "Syne, sans-serif",
                fontSize: "clamp(2rem, 5.5vw, 3.8rem)",
                fontWeight: 800,
                color: "white",
                letterSpacing: "-0.045em",
                lineHeight: 1.07,
                marginBottom: "20px",
              }}
            >
              Ton prochain job
              <br />
              commence{" "}
              <span
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, #A78BFA, #5548F5)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                aujourd'hui.
              </span>
            </h2>

            <p
              style={{
                fontSize: "16px",
                color: "rgba(255,255,255,0.33)",
                marginBottom: "44px",
                lineHeight: 1.65,
                maxWidth: "400px",
              }}
            >
              14 jours gratuits. Sans carte bancaire. Annulation en un clic.
            </p>

            <Link to="/signup" style={{ textDecoration: "none" }}>
              <button
                style={{
                  background: "#5548F5",
                  color: "white",
                  padding: "17px 38px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "16px",
                  letterSpacing: "-0.025em",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  transition: "background 0.15s, transform 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#4338E0";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#5548F5";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = "scale(0.98)";
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
              >
                Commencer gratuitement
                <ArrowRight size={18} />
              </button>
            </Link>

            <p
              style={{
                marginTop: "20px",
                fontSize: "12px",
                color: "rgba(255,255,255,0.18)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              ✓ Sans CB · ✓ Annulation facile · ✓ Données sécurisées
            </p>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER — minimal, éditorial
      ══════════════════════════════════════════ */}
      <footer
        style={{
          background: "#060613",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          padding: "clamp(48px, 7vw, 80px) clamp(20px, 4vw, 48px) 32px",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div
            className="footer-cols"
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr",
              gap: "clamp(32px, 5vw, 64px)",
              marginBottom: "56px",
            }}
          >
            {/* Brand */}
            <div className="footer-brand">
              <CadovaLogo width={64} white />
              <p
                style={{
                  marginTop: "16px",
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.28)",
                  lineHeight: 1.75,
                  maxWidth: "280px",
                }}
              >
                L'écosystème IA pour décrocher ton stage, alternance ou premier CDI.
                Conçu pour les 18–25 ans.
              </p>
            </div>

            {/* Columns */}
            {[
              {
                title: "Modules",
                links: [
                  { label: "ReussIA", href: "/cv-generator" },
                  { label: "OralIA", href: "/interview" },
                  { label: "TrackIA", href: "/dashboard" },
                  { label: "SkillIA", href: "/linkedin" },
                ],
              },
              {
                title: "Produit",
                links: [
                  { label: "Tarifs", href: "/signup" },
                  { label: "Blog", href: "/" },
                  { label: "CGU", href: "/" },
                  { label: "Confidentialité", href: "/" },
                ],
              },
              {
                title: "Compte",
                links: [
                  { label: "Connexion", href: "/login" },
                  { label: "Inscription", href: "/signup" },
                  { label: "Mot de passe", href: "/forgot-password" },
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <div
                  style={{
                    fontSize: "9px",
                    textTransform: "uppercase",
                    letterSpacing: "0.2em",
                    color: "rgba(255,255,255,0.22)",
                    marginBottom: "20px",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {col.title}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {col.links.map((link) => (
                    <Link
                      key={link.label}
                      to={link.href}
                      style={{
                        fontSize: "13px",
                        color: "rgba(255,255,255,0.32)",
                        textDecoration: "none",
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.color =
                          "rgba(255,255,255,0.6)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.color =
                          "rgba(255,255,255,0.32)";
                      }}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div
            className="footer-bottom"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.04)",
              paddingTop: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.18)",
              }}
            >
              © 2024 Cadova · Fait avec soin à Paris
            </span>
            <span
              style={{
                fontSize: "11px",
                color: "rgba(255,255,255,0.12)",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              v1.0 · GPT-4o · FR
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
