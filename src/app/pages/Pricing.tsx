import { MarketingShell } from "../components/MarketingShell";
import { PricingCard } from "../components/PricingCard";
import { useSEO } from "../hooks/useSEO";
import { cadovaBundle, cadovaModules, cadovaPlans } from "../lib/module-data";

const pricingItems = [
  ...cadovaModules.slice(0, 2),
  "bundle",
  ...cadovaModules.slice(2),
];

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
        <div className="marketing-container marketing-pricing-grid">
          {pricingItems.map((item) => {
            if (item === "bundle") {
              return (
                <PricingCard
                  key="cadova-complet"
                  title={cadovaBundle.name}
                  price={cadovaBundle.priceMonthly}
                  note="par mois"
                  badge="Le plus choisi"
                  subtitle="Acces complet aux 4 modules"
                  summary="La formule la plus complete si tu veux relier production, preparation et suivi dans le meme espace."
                  highlights={[
                    "Tout Cadova dans un seul espace",
                    "CV, ATS, entretien et suivi unifies",
                    "Ideal pour une recherche active",
                  ]}
                  accentColor="#5044F5"
                  ctaLabel="Commencer avec Cadova"
                  ctaHref="/signup"
                  featured
                />
              );
            }

            return (
              <PricingCard
                key={item.slug}
                title={item.name}
                price={item.plans[0].priceMonthly}
                note={item.plans[0].priceNote}
                summary={item.plans[0].summary}
                highlights={item.plans[0].highlights}
                accentColor={item.accentColor}
                ctaLabel={item.ctaLabel}
                ctaHref={item.ctaHref}
              />
            );
          })}
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
