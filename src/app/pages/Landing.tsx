import { Link } from "react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { MarketingShell } from "../components/MarketingShell";
import { ModuleCard } from "../components/ModuleCard";
import { useSEO } from "../hooks/useSEO";
import { cadovaModules } from "../lib/module-data";
import { PRO_PRICING } from "../lib/payment-service";

const heroCards = [
  { title: "Documents prêts", text: "CV et lettres adaptés" },
  { title: "Relances utiles", text: "Rappel après 5 à 7 jours" },
  { title: "Suivi clair", text: "Offres, réponses et entretiens" },
];

const valueCards = [
  "CV, lettres, suivi et entretiens réunis",
  "Un plan gratuit pour commencer",
  "Un espace simple pour voir quoi faire ensuite",
];

export function Landing() {
  useSEO({
    title: "Cadova - IA pour trouver un stage, une alternance ou un job",
    description:
      "Cadova aide les jeunes candidats à gérer toute leur recherche d’emploi au même endroit.",
    canonical: "https://cadova.fr/",
    noindex: false,
  });

  const featuredModules = cadovaModules.filter((module) => module.slug === "reussia" || module.slug === "oralia");

  return (
    <MarketingShell ctaLabel="Commencer">
      <section className="marketing-section marketing-hero">
        <div className="marketing-container marketing-hero-grid">
          <div className="marketing-hero-content">
            <h1 className="marketing-title">
              Gère toute ta recherche au même endroit.
            </h1>
            <p className="marketing-copy" style={{ marginTop: 18, maxWidth: 520 }}>
              Crée tes documents, suis tes candidatures, prépare tes entretiens et relance au bon moment.
            </p>
            <div className="marketing-actions">
              <Link to="/signup" className="marketing-button-primary">
                Commencer gratuitement
                <ArrowRight size={18} />
              </Link>
              <Link to="/pricing" className="marketing-button-secondary">
                Voir les tarifs
              </Link>
            </div>
            <div className="marketing-proof-list">
              {valueCards.map((item) => (
                <div key={item} className="marketing-proof-item">
                  <CheckCircle2 className="marketing-proof-icon" size={16} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="marketing-hero-stats" aria-label="Points clés Cadova">
            {heroCards.map((card, index) => (
              <div key={card.title} className={`marketing-proof-stat marketing-proof-stat-${index + 1}`}>
                <span className="marketing-proof-dot" />
                <div>
                  <strong>{card.title}</strong>
                  <span>{card.text}</span>
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
              <div className="marketing-kicker">Les outils</div>
              <h2 className="marketing-title-section">Tout ce qu’il faut pour avancer proprement</h2>
            </div>
            <Link to="/pricing" className="marketing-link">
              Voir les tarifs
            </Link>
          </div>
          <div className="marketing-grid-2">
            {featuredModules.map((module) => (
              <ModuleCard key={module.slug} module={module} />
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container marketing-grid-2">
          <div className="marketing-panel-dark marketing-cta-panel">
            <h2 className="marketing-title-section">
              Sache quoi faire chaque jour.
            </h2>
            <p className="marketing-copy-muted" style={{ marginTop: 16 }}>
              Ajoute tes offres, vois les relances à faire et garde tes documents au bon endroit.
            </p>
            <div className="marketing-actions">
              <Link to="/signup" className="marketing-button-light">
                Commencer
              </Link>
              <Link to="/pricing" className="marketing-button-light">
                Voir les tarifs
              </Link>
            </div>
          </div>
          <div className="marketing-pricing-card is-featured">
            <div className="marketing-pricing-heading">
              <span className="marketing-recommended-badge">Pro</span>
              <span className="marketing-pricing-badge">CADOVA COMPLET</span>
            </div>
            <div className="marketing-price-line">
              <strong>{PRO_PRICING.monthly.price}</strong>
              <span className="marketing-price-note">par mois</span>
            </div>
            <p className="marketing-card-copy" style={{ marginTop: 14 }}>
              CV, lettres, suivi, relances et entretiens dans un seul espace.
            </p>
            <div className="marketing-list" style={{ marginTop: 18 }}>
              {["Tout illimité", "Suivi candidatures complet", "Mensuel ou annuel"].map((item) => (
                <div key={item} className="marketing-list-item">
                  <CheckCircle2 size={16} style={{ color: "#5044F5", marginTop: 3, flexShrink: 0 }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <Link to="/checkout" className="marketing-button-primary marketing-pricing-cta-featured" style={{ marginTop: 22 }}>
              Passer Pro
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
