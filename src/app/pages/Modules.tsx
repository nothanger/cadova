import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { ModuleCard } from "../components/ModuleCard";
import { MarketingShell } from "../components/MarketingShell";
import { useSEO } from "../hooks/useSEO";
import { cadovaModules } from "../lib/module-data";
import { PRO_PRICING } from "../lib/payment-service";

export function Modules() {
  useSEO({
    title: "Outils Cadova",
    description: "Choisis l’outil Cadova qui t’aide selon ton besoin du moment : dossier, entretien, suivi ou profil.",
    noindex: false,
  });

  return (
    <MarketingShell>
      <section className="marketing-section marketing-hero">
        <div className="marketing-container marketing-panel" style={{ padding: 30 }}>
          <div className="marketing-section-head">
            <div style={{ maxWidth: 760 }}>
              <div className="marketing-kicker">Par où commencer</div>
              <h1 className="marketing-title-section">Chaque outil répond à un besoin précis.</h1>
              <p className="marketing-copy" style={{ marginTop: 16 }}>
                Tu n’as pas besoin de tout utiliser d’un coup. Commence par ce qui te bloque aujourd’hui, puis ajoute le reste si ta recherche devient plus dense.
              </p>
            </div>
            <div className="marketing-actions" style={{ marginTop: 0 }}>
              <Link to="/pricing" className="marketing-button-primary">
                Voir les tarifs
                <ArrowRight size={18} />
              </Link>
              <Link to="/pricing" className="marketing-button-secondary">
                Passer Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container marketing-grid-2">
          {cadovaModules.map((module) => (
            <ModuleCard key={module.slug} module={module} />
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
              Un jour tu as besoin d’un CV propre. Le lendemain, d’un entraînement à l’oral. La semaine suivante, d’un suivi de relances. Cadova garde tout au même endroit.
            </p>
          </div>

          <div className="marketing-pricing-card is-featured">
            <div className="marketing-pricing-heading">
              <span className="marketing-recommended-badge">Pro</span>
              <span className="marketing-pricing-badge">Cadova complet</span>
            </div>
            <div className="marketing-price-line">
              <strong>{PRO_PRICING.monthly.price}</strong>
              <span className="marketing-price-note">par mois</span>
            </div>
            <p className="marketing-card-copy" style={{ marginTop: 14 }}>
              Un abonnement unique pour CV, lettres, ATS, entretiens, suivi et relances.
            </p>
            <Link to="/checkout" className="marketing-button-primary marketing-pricing-cta-featured" style={{ marginTop: 22 }}>
              Passer Pro
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
