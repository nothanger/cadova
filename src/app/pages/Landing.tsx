import { Link } from "react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { MarketingShell } from "../components/MarketingShell";
import { ModuleCard } from "../components/ModuleCard";
import { PricingCard } from "../components/PricingCard";
import { useSEO } from "../hooks/useSEO";
import { cadovaBundle, cadovaModules } from "../lib/module-data";

const heroCards = [
  { title: "Trouve ton entree", text: "Candidature structuree" },
  { title: "Ton CV tient en quelques minutes", text: "Optimise avant envoi" },
  { title: "Tu suis tes candidatures", text: "Sans t'eparpiller" },
];

const valueCards = [
  "Des modules adaptes a ton besoin",
  "Un essai gratuit pour tester",
  "Une interface simple pour avancer sans t'eparpiller",
];

export function Landing() {
  useSEO({
    title: "Cadova - IA pour trouver un stage, une alternance ou un job",
    description:
      "Cadova aide les jeunes candidats avec des modules simples pour le CV, la lettre, l'entretien, le suivi et le profil.",
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
              Tu cherche un stage? Alors fais le bien :)
            </h1>
            <p className="marketing-copy" style={{ marginTop: 18, maxWidth: 520 }}>
              Avec Cadova, tu fais tout au meme endroit: CV, entrainement et suivi.
            </p>
            <div className="marketing-actions">
              <Link to="/signup" className="marketing-button-primary">
                Essayer les modules
                <ArrowRight size={18} />
              </Link>
              <Link to="/modules" className="marketing-button-secondary">
                Voir les formules
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

          <div className="marketing-hero-stats" aria-label="Points cles Cadova">
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
              <div className="marketing-kicker">Les modules</div>
              <h2 className="marketing-title-section">Choisis le module qui correspond a ton besoin</h2>
            </div>
            <Link to="/pricing" className="marketing-link">
              Voir les formules
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
              Maintenant que tu sais? Pourquoi pas commencer aujourd'hui?
            </h2>
            <p className="marketing-copy-muted" style={{ marginTop: 16 }}>
              Teste le module complet ou compare les modules avant de choisir.
            </p>
            <div className="marketing-actions">
              <Link to="/signup" className="marketing-button-light">
                Voir la formule complete
              </Link>
              <Link to="/pricing" className="marketing-button-light">
                Voir les formules
              </Link>
            </div>
          </div>
          <PricingCard
            title={cadovaBundle.name}
            price={cadovaBundle.priceMonthly}
            note="par mois"
            summary="Pour garder toute ta recherche au meme endroit."
            highlights={cadovaBundle.highlights}
            accentColor="#5044F5"
            ctaLabel="Commencer"
            ctaHref="/signup"
            featured
          />
        </div>
      </section>
    </MarketingShell>
  );
}
