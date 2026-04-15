import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { ModuleCard } from "../components/ModuleCard";
import { PricingCard } from "../components/PricingCard";
import { MarketingShell } from "../components/MarketingShell";
import { useSEO } from "../hooks/useSEO";
import { cadovaBundle, cadovaModules, moduleHighlights } from "../lib/module-data";

export function Modules() {
  useSEO({
    title: "Modules Cadova",
    description: "Vue d'ensemble des modules Cadova: ReussIA, OralIA, TrackIA et SkillIA.",
    noindex: false,
  });

  return (
    <MarketingShell>
      <section className="marketing-section marketing-hero">
        <div className="marketing-container marketing-panel" style={{ padding: 30 }}>
          <div className="marketing-section-head">
            <div style={{ maxWidth: 760 }}>
              <div className="marketing-kicker">Catalogue produit</div>
              <h1 className="marketing-title-section">Des modules qui couvrent un moment reel du parcours candidat.</h1>
              <p className="marketing-copy" style={{ marginTop: 16 }}>
                Chaque bloc Cadova a un role net. Tu peux entrer par l'urgence du moment, puis etendre ton espace quand ta recherche devient plus dense.
              </p>
            </div>
            <div className="marketing-actions" style={{ marginTop: 0 }}>
              <Link to="/modules/comparaison" className="marketing-button-primary">
                Comparer les modules
                <ArrowRight size={18} />
              </Link>
              <Link to="/pricing" className="marketing-button-secondary">
                Voir les formules
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container marketing-grid-4">
          {cadovaModules.map((module) => (
            <ModuleCard key={module.slug} module={module} />
          ))}
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container marketing-grid-4">
          {moduleHighlights.map((item) => (
            <div key={item.title} className="marketing-detail-block">
              <item.icon size={18} style={{ color: "#ff6a4d" }} />
              <h3 className="marketing-detail-block-title">{item.title}</h3>
              <p className="marketing-card-copy">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container marketing-grid-2">
          <div className="marketing-panel" style={{ padding: 28 }}>
            <div className="marketing-kicker">
              Vue d'ensemble
            </div>
            <h2 className="marketing-title-section" style={{ marginTop: 14 }}>
              Modulaire dans l'entree, coherent dans l'ensemble.
            </h2>
            <p className="marketing-copy" style={{ marginTop: 16 }}>
              Le but n'est pas d'empiler des outils. Le but est de garder une ligne claire entre candidature, entretien, visibilite et suivi.
            </p>
          </div>

          <PricingCard
            title={cadovaBundle.name}
            price={cadovaBundle.priceMonthly}
            note={cadovaBundle.note}
            summary="La formule la plus simple si tu veux tout piloter dans le meme environnement."
            highlights={cadovaBundle.highlights}
            accentColor="#161426"
            ctaLabel="Voir le pricing"
            ctaHref="/pricing"
            featured
          />
        </div>
      </section>
    </MarketingShell>
  );
}
