import { Link } from "react-router";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  FileText,
  Linkedin,
  MessageSquare,
  Shield,
  Sparkles,
  Target,
} from "lucide-react";
import { CadovaLogo } from "../components/CadovaLogo";
import { useSEO } from "../hooks/useSEO";

const modules = [
  {
    name: "ReussIA",
    description: "CV, lettres de motivation et analyse ATS dans le meme flux.",
    href: "/signup",
    icon: FileText,
    color: "#5548f5",
    hoverBackground: "rgba(85,72,245,0.05)",
    hoverBorder: "rgba(85,72,245,0.2)",
  },
  {
    name: "OralIA",
    description: "Simulation d'entretien avec feedback immediat sur tes reponses.",
    href: "/signup",
    icon: MessageSquare,
    color: "#d946ef",
    hoverBackground: "rgba(217,70,239,0.05)",
    hoverBorder: "rgba(217,70,239,0.2)",
  },
  {
    name: "TrackIA",
    description: "Suivi de candidatures, rappels et entreprises a relancer.",
    href: "/signup",
    icon: Briefcase,
    color: "#14b8a6",
    hoverBackground: "rgba(20,184,166,0.05)",
    hoverBorder: "rgba(20,184,166,0.2)",
  },
  {
    name: "SkillIA",
    description: "Optimisation LinkedIn et competences a travailler pour le poste vise.",
    href: "/signup",
    icon: Linkedin,
    color: "#2563eb",
    hoverBackground: "rgba(37,99,235,0.05)",
    hoverBorder: "rgba(37,99,235,0.2)",
  },
];

const proofPoints = [
  "Creation de CV en quelques minutes",
  "Essai gratuit de 14 jours sans carte bancaire",
  "Un seul compte pour tous les modules",
];

const workflow = [
  {
    title: "Tu entres ton objectif",
    body: "Stage, alternance ou premier CDI. Cadova adapte ensuite le ton, les conseils et les outils.",
  },
  {
    title: "Tu produis tes supports",
    body: "CV, lettre et analyse ATS se nourrissent les uns les autres au lieu de repartir de zero a chaque fois.",
  },
  {
    title: "Tu suis tes candidatures",
    body: "Le dashboard centralise ton activite et te montre ce qu'il te manque pour avancer.",
  },
];

const testimonials = [
  {
    name: "Marie",
    role: "Alternance marketing",
    quote:
      "Le score ATS m'a aidee a comprendre pourquoi mes candidatures restaient sans reponse.",
  },
  {
    name: "Yanis",
    role: "Premier poste tech",
    quote:
      "Le fait d'avoir le CV, l'entretien et le suivi dans le meme outil m'a fait gagner un temps fou.",
  },
];

export function Landing() {
  useSEO({
    title: "Cadova - IA pour CV, entretiens et suivi de candidatures",
    description:
      "Cadova aide les etudiants et jeunes diplomes a creer leurs candidatures, preparer leurs entretiens et suivre leurs opportunites dans un seul espace.",
    canonical: "https://cadova.fr/",
    noindex: false,
  });

  return (
    <div style={{ background: "#f4f1ff", color: "#140f26", fontFamily: "DM Sans, system-ui, sans-serif" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          backdropFilter: "blur(16px)",
          background: "rgba(244,241,255,0.88)",
          borderBottom: "1px solid rgba(20,15,38,0.08)",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <Link to="/" style={{ display: "inline-flex", alignItems: "center" }}>
            <CadovaLogo width={72} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link to="/login" style={{ textDecoration: "none", color: "#5b5570", fontSize: 14 }}>
              Connexion
            </Link>
            <Link
              to="/signup"
              style={{
                textDecoration: "none",
                background: "#5548f5",
                color: "white",
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Commencer
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section style={{ padding: "72px 20px 56px" }}>
          <div
            style={{
              maxWidth: 1180,
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 28,
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: "rgba(85,72,245,0.04)",
                  border: "1px solid rgba(85,72,245,0.08)",
                  color: "#5b5570",
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 20,
                }}
              >
                <Sparkles size={14} style={{ color: "#5548f5" }} />
                Tout ton process de candidature, au meme endroit
              </div>

              <h1
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontSize: "clamp(2.6rem, 7vw, 4.8rem)",
                  lineHeight: 1,
                  letterSpacing: "-0.04em",
                  margin: 0,
                }}
              >
                Ton prochain job
                <br />
                se prepare ici.
              </h1>

              <p
                style={{
                  marginTop: 20,
                  maxWidth: 560,
                  fontSize: 18,
                  lineHeight: 1.65,
                  color: "#5f5874",
                }}
              >
                Cadova t'aide a produire des candidatures plus solides, a t'entrainer pour les entretiens et a garder une vue claire sur ce que tu as deja envoye.
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 28 }}>
                <Link
                  to="/signup"
                  style={{
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "14px 18px",
                    borderRadius: 8,
                    background: "#5548f5",
                    color: "white",
                    fontWeight: 700,
                  }}
                >
                  Commencer gratuitement
                  <ArrowRight size={18} />
                </Link>
                <Link
                  to="/login"
                  style={{
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "14px 18px",
                    borderRadius: 8,
                    border: "1px solid rgba(20,15,38,0.12)",
                    color: "#140f26",
                    fontWeight: 700,
                    background: "white",
                  }}
                >
                  Voir mon espace
                </Link>
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
                {proofPoints.map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, color: "#4e4762" }}>
                    <CheckCircle2 size={16} style={{ color: "#10b981" }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                background: "linear-gradient(160deg, #13152A 0%, #191c34 60%, #211a43 100%)",
                color: "white",
                borderRadius: 8,
                padding: 28,
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 18px 42px rgba(20,15,38,0.18)",
              }}
            >
              <div style={{ display: "grid", gap: 14 }}>
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.045)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)", marginBottom: 8 }}>Exemple de flux</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>Objectif: alternance marketing</div>
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ color: "rgba(255,255,255,0.78)", lineHeight: 1.55 }}>CV genere</span>
                      <strong style={{ color: "#8b5cf6" }}>Pret</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ color: "rgba(255,255,255,0.78)", lineHeight: 1.55 }}>Score ATS</span>
                      <strong style={{ color: "#10b981" }}>86 / 100</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ color: "rgba(255,255,255,0.78)", lineHeight: 1.55 }}>Simulation entretien</span>
                      <strong style={{ color: "#f59e0b" }}>A retravailler</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ color: "rgba(255,255,255,0.78)", lineHeight: 1.55 }}>Relance recommandee</span>
                      <strong style={{ color: "#ec4899" }}>2 entreprises</strong>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    background: "linear-gradient(180deg, rgba(85,72,245,0.12) 0%, rgba(85,72,245,0.08) 100%)",
                    border: "1px solid rgba(139,92,246,0.18)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={{ fontSize: 12, textTransform: "uppercase", color: "#c4b5fd", marginBottom: 8 }}>
                    Ce que tu gagnes
                  </div>
                  <p style={{ margin: 0, lineHeight: 1.72, color: "rgba(255,255,255,0.82)", fontSize: 15 }}>
                    Moins de dispersion, plus de coherence entre tes supports, et un dashboard qui garde la memoire de tes vraies actions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section style={{ padding: "0 20px 64px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <Target size={18} style={{ color: "#5548f5" }} />
              <strong>Les modules</strong>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              {modules.map((module) => (
                <Link
                  key={module.name}
                  to={module.href}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    background: "white",
                    borderRadius: 8,
                    padding: 20,
                    border: "1px solid rgba(20,15,38,0.08)",
                    borderTop: `3px solid ${module.color}`,
                    cursor: "pointer",
                    transition: "background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background = module.hoverBackground;
                    event.currentTarget.style.borderColor = module.hoverBorder;
                    event.currentTarget.style.boxShadow = "0 12px 28px rgba(20,15,38,0.08)";
                    event.currentTarget.style.transform = "scale(1.01)";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = "white";
                    event.currentTarget.style.borderColor = "rgba(20,15,38,0.08)";
                    event.currentTarget.style.boxShadow = "none";
                    event.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  <module.icon size={18} style={{ color: module.color }} />
                  <h2 style={{ margin: "14px 0 8px", fontSize: 20 }}>{module.name}</h2>
                  <p style={{ margin: 0, lineHeight: 1.6, color: "#625b76" }}>{module.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section style={{ background: "white", padding: "64px 20px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto" }}>
            <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(2rem, 4vw, 3rem)", margin: 0 }}>
              Un parcours simple, sans eparpillement.
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 18,
                marginTop: 28,
              }}
            >
              {workflow.map((item, index) => (
                <div key={item.title} style={{ padding: 20, borderRadius: 8, background: "#f8f7fc", border: "1px solid rgba(20,15,38,0.08)" }}>
                  <div style={{ fontSize: 12, color: "#8b84a0", marginBottom: 8 }}>Etape {index + 1}</div>
                  <h3 style={{ margin: "0 0 10px", fontSize: 20 }}>{item.title}</h3>
                  <p style={{ margin: 0, color: "#5d5670", lineHeight: 1.65 }}>{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: "64px 20px" }}>
          <div
            style={{
              maxWidth: 1180,
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 18,
            }}
          >
            {testimonials.map((item) => (
              <div key={item.name} style={{ background: "white", borderRadius: 8, padding: 22, border: "1px solid rgba(20,15,38,0.08)" }}>
                <p style={{ margin: 0, lineHeight: 1.7, color: "#524b67" }}>"{item.quote}"</p>
                <div style={{ marginTop: 16, fontWeight: 700 }}>{item.name}</div>
                <div style={{ color: "#8a839d", fontSize: 14 }}>{item.role}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: "0 20px 80px" }}>
          <div
            style={{
              maxWidth: 1180,
              margin: "0 auto",
              background: "#120d23",
              color: "white",
              borderRadius: 8,
              padding: "32px 24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#c4b5fd", marginBottom: 14 }}>
              <Shield size={16} />
              Donnees sous controle
            </div>
            <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(1.8rem, 4vw, 3rem)", lineHeight: 1.05, margin: 0 }}>
              Cree ton compte et commence par un vrai livrable.
            </h2>
            <p style={{ maxWidth: 620, color: "rgba(255,255,255,0.72)", lineHeight: 1.7 }}>
              L'objectif n'est pas de te faire naviguer dans des promesses. Tu arrives, tu crées, tu enregistres, tu suis.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
              <Link
                to="/signup"
                style={{
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 18px",
                  borderRadius: 8,
                  background: "white",
                  color: "#120d23",
                  fontWeight: 700,
                }}
              >
                Demarrer l'essai gratuit
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/login"
                style={{
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "14px 18px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.16)",
                  color: "white",
                  fontWeight: 700,
                }}
              >
                J'ai deja un compte
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
