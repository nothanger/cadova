import { MarketingShell } from "../components/MarketingShell";
import { PricingCard } from "../components/PricingCard";
import { useSEO } from "../hooks/useSEO";
import { cadovaBundle, cadovaModules, cadovaPlans } from "../lib/module-data";

export function Pricing() {
  useSEO({
    title: "Pricing Cadova",
    description: "Tarifs des modules Cadova et formule complete.",
    noindex: false,
  });

  return (
    <MarketingShell>
      <section className="marketing-section marketing-hero">
        <div className="marketing-container marketing-panel" style={{ padding: 30 }}>
          <div style={{ maxWidth: 760 }}>
            <div className="marketing-kicker">Pricing</div>
            <h1 className="marketing-title-section">Des formules plus nettes, sans theatre inutile.</h1>
            <p className="marketing-copy" style={{ marginTop: 16 }}>
              Tu peux demarrer petit avec un besoin unique ou prendre la formule complete si tu veux produire, preparer et suivre sans changer d'outil ni de rythme.
            </p>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container marketing-grid-4">
          {cadovaModules.map((module) => (
            <PricingCard
              key={module.slug}
              title={module.name}
              price={module.plans[0].priceMonthly}
              note={module.plans[0].priceNote}
              summary={module.plans[0].summary}
              highlights={module.plans[0].highlights}
              accentColor={module.accentColor}
              ctaLabel={module.ctaLabel}
              ctaHref={module.ctaHref}
            />
          ))}
          <PricingCard
            title={cadovaBundle.name}
            price={cadovaBundle.priceMonthly}
            note={cadovaBundle.note}
            summary="La formule la plus complete si tu veux relier production, preparation et suivi dans le meme espace."
            highlights={cadovaBundle.highlights}
            accentColor="#161426"
            ctaLabel="Choisir Cadova complet"
            ctaHref="/signup"
            featured
          />
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container marketing-grid-2">
          {cadovaPlans.map((plan) => (
            <div key={plan.name} className="marketing-detail-block">
              <div className="marketing-kicker">{plan.name}</div>
              <p className="marketing-card-copy" style={{ marginTop: 14 }}>
                {plan.summary}
              </p>
              <div className="marketing-list" style={{ marginTop: 18 }}>
                {plan.bulletPoints.map((item) => (
                  <div key={item} className="marketing-list-item" style={{ color: "#453f55" }}>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
