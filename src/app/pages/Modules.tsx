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
    description: "Choisis le module Cadova qui t'aide selon ton blocage du moment: dossier, entretien, suivi ou profil.",
    noindex: false,
  });

  return (
    <MarketingShell>
      <section className="marketing-section marketing-hero">
        <div className="marketing-container marketing-panel" style={{ padding: 30 }}>
          <div className="marketing-section-head">
            <div style={{ maxWidth: 760 }}>
              <div className="marketing-kicker">Par ou commencer</div>
              <h1 className="marketing-title-section">Chaque module repond a un blocage precis.</h1>
              <p className="marketing-copy" style={{ marginTop: 16 }}>
                Tu n'as pas besoin de tout utiliser d'un coup. Commence par ce qui te bloque aujourd'hui, puis ajoute le reste si ta recherche devient plus dense.
              </p>
            </div>
            <div className="marketing-actions" style={{ marginTop: 0 }}>
              <Link to="/modules/comparaison" className="marketing-button-primary">
                M'aider a choisir
                <ArrowRight size={18} />
              </Link>
              <Link to="/pricing" className="marketing-button-secondary">
                Voir les options
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
              Vue simple
            </div>
            <h2 className="marketing-title-section" style={{ marginTop: 14 }}>
              Tu peux avancer morceau par morceau.
            </h2>
            <p className="marketing-copy" style={{ marginTop: 16 }}>
              Un jour tu as besoin d'un CV propre. Le lendemain, d'un entrainement a l'oral. La semaine suivante, d'un suivi de relances. Cadova garde tout dans le meme fil.
            </p>
          </div>

          <PricingCard
            title={cadovaBundle.name}
            price={cadovaBundle.priceMonthly}
            note={cadovaBundle.note}
            summary="Le choix le plus confortable si tu veux garder toute ta recherche au meme endroit."
            highlights={cadovaBundle.highlights}
            accentColor="#161426"
            ctaLabel="Voir les formules"
            ctaHref="/pricing"
            featured
          />
        </div>
      </section>
    </MarketingShell>
  );
}
