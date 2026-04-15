import { Link } from "react-router";
import { ArrowRight, CheckCircle2, Shield, Sparkles } from "lucide-react";
import { MarketingShell } from "../components/MarketingShell";
import { ModuleCard } from "../components/ModuleCard";
import { useSEO } from "../hooks/useSEO";
import { cadovaModules } from "../lib/module-data";

const proofPoints = [
  "Creation de CV en quelques minutes",
  "Essai gratuit de 14 jours sans carte bancaire",
  "Un seul compte pour tous les modules",
];

const workflow = [
  {
    title: "Tu poses la cible",
    body: "Stage, alternance ou premier CDI. Cadova ajuste ensuite ton angle, tes priorites et tes outils.",
  },
  {
    title: "Tu produis sans casser le rythme",
    body: "CV, lettre, ATS et entretien avancent ensemble au lieu de repartir de zero a chaque etape.",
  },
  {
    title: "Tu pilotes ce qui compte",
    body: "Le suivi garde une memoire claire de tes envois, relances et points a retravailler.",
  },
];

const testimonials = [
  {
    name: "Marie",
    role: "Alternance marketing",
    quote: "Le score ATS m'a aidee a comprendre pourquoi mes candidatures restaient sans reponse.",
  },
  {
    name: "Yanis",
    role: "Premier poste tech",
    quote: "Le fait d'avoir le CV, l'entretien et le suivi dans le meme outil m'a fait gagner un temps fou.",
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
    <MarketingShell>
      <section className="marketing-section marketing-hero">
        <div className="marketing-container marketing-hero-grid">
          <div>
            <span className="marketing-eyebrow">
              <Sparkles size={14} />
              Un cockpit de candidature plus net
            </span>
            <h1 className="marketing-title">
              Le style de recherche
              <br />
              qui te remet
              <br />
              en mouvement.
            </h1>
            <p className="marketing-copy" style={{ marginTop: 22 }}>
              Cadova rassemble ce qu'un candidat disperse souvent entre trop d'onglets: produire, affiner, s'entrainer et suivre. Tu gardes une trajectoire claire sans perdre ton energie dans l'organisation.
            </p>

            <div className="marketing-actions">
              <Link to="/modules" className="marketing-button-primary">
                Explorer les modules
                <ArrowRight size={18} />
              </Link>
              <Link to="/pricing" className="marketing-button-secondary">
                Voir les formules
              </Link>
            </div>

            <div className="marketing-proof-list">
              {proofPoints.map((item) => (
                <div key={item} className="marketing-proof-item">
                  <CheckCircle2 size={16} className="marketing-proof-icon" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="marketing-meta-grid">
              <div className="marketing-meta-card">
                <span className="marketing-kicker">Temps gagne</span>
                <strong>4 modules</strong>
                <span className="marketing-price-note">dans le meme espace de travail</span>
              </div>
              <div className="marketing-meta-card">
                <span className="marketing-kicker">Point fort</span>
                <strong>Process net</strong>
                <span className="marketing-price-note">du brouillon au suivi reel</span>
              </div>
              <div className="marketing-meta-card">
                <span className="marketing-kicker">Depart</span>
                <strong>14 jours</strong>
                <span className="marketing-price-note">pour tester sans carte</span>
              </div>
            </div>
          </div>

          <div className="marketing-panel marketing-hero-visual">
            <div className="marketing-preview-frame">
              <div className="marketing-preview-topline">
                <span>Cadova flow</span>
                <span>Objectif: alternance marketing</span>
              </div>

              <div className="marketing-preview-highlight">
                <span className="marketing-kicker">
                  Vue active
                </span>
                <h3>Tu sais quoi produire, quoi relancer, et quoi corriger ensuite.</h3>
              </div>

              <div className="marketing-preview-stack">
                <div className="marketing-metric-card">
                  <span className="marketing-metric-label">CV genere</span>
                  <span className="marketing-metric-value" style={{ color: "#5044f5" }}>
                    Pret
                  </span>
                </div>
                <div className="marketing-metric-card">
                  <span className="marketing-metric-label">Score ATS</span>
                  <span className="marketing-metric-value" style={{ color: "#5044f5" }}>
                    86/100
                  </span>
                </div>
                <div className="marketing-metric-card">
                  <span className="marketing-metric-label">Simulation</span>
                  <span className="marketing-metric-value" style={{ color: "#5044f5" }}>
                    7 Q
                  </span>
                </div>
                <div className="marketing-metric-card">
                  <span className="marketing-metric-label">Relances</span>
                  <span className="marketing-metric-value" style={{ color: "#5044f5" }}>
                    2
                  </span>
                </div>
              </div>

              <div className="marketing-spotlight">
                <span className="marketing-kicker">
                  Ce que tu recuperes
                </span>
                <p className="marketing-card-copy" style={{ margin: 0 }}>
                  Moins de friction mentale, plus de coherence entre ce que tu racontes, ce que tu envoies et ce que tu suis.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container">
          <div className="marketing-section-head">
            <div>
              <div className="marketing-kicker">Les modules</div>
              <h2 className="marketing-title-section">Entre par le bon besoin, pas par le chaos.</h2>
            </div>
            <Link to="/modules/comparaison" className="marketing-link">
              Comparer les modules
            </Link>
          </div>
          <div className="marketing-grid-4">
            {cadovaModules.map((module) => (
              <ModuleCard key={module.slug} module={module} />
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container marketing-panel" style={{ padding: 28 }}>
          <div className="marketing-section-head">
            <div>
              <div className="marketing-kicker">Le parcours</div>
              <h2 className="marketing-title-section">Simple dans la forme, solide dans le fond.</h2>
            </div>
          </div>
          <div className="marketing-grid-3">
            {workflow.map((item, index) => (
              <div key={item.title} className="marketing-detail-block">
                <span className="marketing-kicker">Etape {index + 1}</span>
                <h3 className="marketing-detail-block-title">{item.title}</h3>
                <p className="marketing-card-copy">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container marketing-grid-2">
          {testimonials.map((item) => (
            <div key={item.name} className="marketing-panel" style={{ padding: 24 }}>
              <p style={{ margin: 0, lineHeight: 1.8, fontSize: 18, color: "#373348" }}>"{item.quote}"</p>
              <div style={{ marginTop: 18, fontWeight: 800 }}>{item.name}</div>
              <div className="marketing-price-note">{item.role}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container marketing-panel-dark" style={{ padding: 32 }}>
          <div className="marketing-section-head" style={{ marginBottom: 0 }}>
            <div>
              <div className="marketing-eyebrow" style={{ background: "rgba(255,255,255,0.08)", color: "#f5f4ef", borderColor: "rgba(255,255,255,0.12)" }}>
                <Shield size={14} />
                Donnees sous controle
              </div>
              <h2 className="marketing-title-section" style={{ marginTop: 16 }}>
                Cree ton compte et avance sans casser ton elan.
              </h2>
              <p className="marketing-copy-muted" style={{ marginTop: 16 }}>
                Tu peux commencer par un besoin precis ou choisir la formule complete si tu veux tout garder sous le meme cap visuel et pratique.
              </p>
            </div>
            <div className="marketing-actions" style={{ marginTop: 0 }}>
              <Link to="/pricing" className="marketing-button-secondary">
                Voir la formule complete
              </Link>
              <Link to="/modules/comparaison" className="marketing-button-light">
                Comparer les modules
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
