import { Link } from "react-router";
import { ArrowRight, CheckCircle2, Shield } from "lucide-react";
import { MarketingShell } from "../components/MarketingShell";
import { ModuleCard } from "../components/ModuleCard";
import { useSEO } from "../hooks/useSEO";
import { cadovaModules } from "../lib/module-data";

const proofPoints = [
  "Des modules adaptés à tes besoins",
  "Un essai gratuit de 2 jours pour tous les services en illimité",
  "Une interface simple pour avancer sans t'éparpiller",
];

const heroStats = [
  { value: "Trouve ton entreprise", label: "Candidatures structurées" },
  { value: "Ton CV prêt en quelques minutes", label: "Optimisation avant envoi" },
  { value: "Tu suis tes candidatures", label: "Suivi plus régulier" },
];

const workflow = [
  {
    title: "Tu dis ou tu en es",
    body: "Premier stage, alternance ou poste junior. On part de ta situation, pas d'un parcours parfait.",
  },
  {
    title: "Tu avances par petits blocs",
    body: "Un CV plus lisible, une lettre moins vide, une analyse qui dit quoi corriger. Pas besoin de tout refaire d'un coup.",
  },
  {
    title: "Tu gardes le fil",
    body: "Tu sais ce que tu as envoye, qui relancer, et ce qu'il faut retravailler avant la prochaine candidature.",
  },
];

const testimonials = [
  {
    name: "Marie",
    role: "Alternance marketing",
    quote: "J'avais l'impression d'envoyer dans le vide. La, j'ai enfin vu ce qui manquait dans mon CV.",
  },
  {
    name: "Yanis",
    role: "Premier poste tech",
    quote: "Ce n'est pas magique, mais ca m'a remis dans une routine. Je savais quoi faire apres chaque envoi.",
  },
];

export function Landing() {
  useSEO({
    title: "Cadova - Un coup de main pour tes candidatures",
    description:
      "Cadova aide les lyceens, etudiants et jeunes diplomes a construire leurs candidatures, preparer leurs entretiens et garder le fil de leur recherche.",
    canonical: "https://cadova.fr/",
    noindex: false,
  });

  return (
    <MarketingShell>
      <section className="marketing-section marketing-hero">
        <div className="marketing-container marketing-hero-grid">
          <div className="marketing-hero-content">
            <h1 className="marketing-title">
              Tu cherches un
              <br />
              stage ? Alors fais
              <br />
              le bien !
            </h1>
            <p className="marketing-copy" style={{ marginTop: 22 }}>
              Arrête de t'éparpiller.
              <br />
              Avec Cadova, tu fais tout au même endroit : CV, entraînement et suivi.
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
                <span className="marketing-kicker">Temps gagné</span>
                <strong>Tout au même endroit</strong>
                <span className="marketing-price-note">CV, entraînement et suivi réunis</span>
              </div>
              <div className="marketing-meta-card">
                <span className="marketing-kicker">Point fort</span>
                <strong>Tu sais quoi faire</strong>
                <span className="marketing-price-note">À chaque étape de ta recherche</span>
              </div>
              <div className="marketing-meta-card">
                <span className="marketing-kicker">Ce que tu gagnes</span>
                <strong>Tu restes organisé</strong>
                <span className="marketing-price-note">Sans te perdre entre les onglets</span>
              </div>
            </div>
          </div>

          <div className="marketing-hero-stats" aria-label="Preuves Cadova">
            {heroStats.map((stat, index) => (
              <div key={stat.label} className={`marketing-proof-stat marketing-proof-stat-${index + 1}`}>
                <span className="marketing-proof-dot" aria-hidden="true" />
                <div>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container">
          <div className="marketing-section-head">
            <div>
              <div className="marketing-kicker">Les modules</div>
              <h2 className="marketing-title-section">Choisis le probleme du moment.</h2>
            </div>
            <Link to="/modules/comparaison" className="marketing-link">
              M'aider a choisir
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
              <h2 className="marketing-title-section">On avance sans te noyer.</h2>
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
                Reprends ta recherche par un bout simple.
              </h2>
              <p className="marketing-copy-muted" style={{ marginTop: 16 }}>
                Pas besoin d'avoir un plan parfait. Tu peux commencer par le CV, l'entretien, le suivi ou ton profil, puis construire le reste autour.
              </p>
            </div>
            <div className="marketing-actions" style={{ marginTop: 0 }}>
              <Link to="/pricing" className="marketing-button-secondary">
                Voir les options
              </Link>
              <Link to="/modules/comparaison" className="marketing-button-light">
                Comparer tranquillement
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
