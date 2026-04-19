import { Link, useParams } from "react-router";
import { CheckCircle2 } from "lucide-react";
import { MarketingShell } from "../components/MarketingShell";
import { PricingCard } from "../components/PricingCard";
import { useSEO } from "../hooks/useSEO";
import { cadovaBundle, cadovaModules, getModuleBySlug } from "../lib/module-data";

export function ModuleDetail() {
  const { slug } = useParams();
  const module = getModuleBySlug(slug);

  useSEO({
    title: module ? `${module.name} - Cadova` : "Module Cadova",
    description: module?.fullDescription ?? "Detail d'un module Cadova.",
    noindex: false,
  });

  if (!module) {
    return (
      <div className="marketing-empty">
        <div style={{ textAlign: "center" }}>
          <h1>Module introuvable</h1>
          <Link to="/modules" className="marketing-link">
            Retour aux modules
          </Link>
        </div>
      </div>
    );
  }

  const otherModules = cadovaModules.filter((item) => item.slug !== module.slug);
  const continuationModules = otherModules.slice(0, 1);

  return (
    <MarketingShell ctaHref={module.ctaHref} ctaLabel={module.ctaLabel}>
      <section className="marketing-section marketing-hero">
        <div className="marketing-container marketing-detail-hero">
          <div>
            <div className="marketing-kicker">{module.name}</div>
            <h1 className="marketing-title-section">{module.shortDescription}</h1>
            <p className="marketing-copy" style={{ marginTop: 18 }}>
              {module.fullDescription}
            </p>
            <div className="marketing-actions">
              <Link to={module.ctaHref} className="marketing-button-primary">
                {module.ctaLabel}
              </Link>
              <Link to="/modules/comparaison" className="marketing-button-secondary">
                Comparer avec les autres modules
              </Link>
            </div>
          </div>
          <div className="marketing-panel" style={{ padding: 28 }}>
            <div className="marketing-kicker">{module.previewTitle}</div>
            <div className="marketing-list" style={{ marginTop: 22 }}>
              {module.previewMetrics.map((metric) => (
                <div key={metric.label} className="marketing-metric-row">
                  <span>{metric.label}</span>
                  <strong style={{ color: module.accentColor }}>{metric.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container marketing-grid-3">
          <div className="marketing-detail-block">
            <div className="marketing-kicker">Pour qui</div>
            <div className="marketing-list" style={{ marginTop: 16 }}>
              {module.targetAudience.slice(0, 3).map((item) => (
                <div key={item} className="marketing-list-item">
                  <CheckCircle2 size={16} style={{ color: module.accentColor, marginTop: 3, flexShrink: 0 }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="marketing-detail-block">
            <div className="marketing-kicker">Fonctions cles</div>
            <div className="marketing-list" style={{ marginTop: 16 }}>
              {module.features.slice(0, 3).map((item) => (
                <div key={item} className="marketing-list-item">
                  <CheckCircle2 size={16} style={{ color: module.accentColor, marginTop: 3, flexShrink: 0 }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="marketing-detail-block">
            <div className="marketing-kicker">Ce que ca change</div>
            <div className="marketing-list" style={{ marginTop: 16 }}>
              {module.benefits.slice(0, 3).map((item) => (
                <div key={item} className="marketing-list-item">
                  <CheckCircle2 size={16} style={{ color: module.accentColor, marginTop: 3, flexShrink: 0 }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container">
          <div className="marketing-section-head">
            <div>
              <div className="marketing-kicker">Cas d'usage</div>
              <h2 className="marketing-title-section">Quand {module.name} est le bon choix</h2>
            </div>
          </div>
          <div className="marketing-grid-3">
            {module.useCases.slice(0, 3).map((item, index) => (
              <div key={item} className="marketing-detail-block">
                <div className="marketing-kicker" style={{ color: module.accentColor }}>
                  Situation {index + 1}
                </div>
                <p className="marketing-card-copy" style={{ marginTop: 12 }}>
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container">
          <div className="marketing-section-head">
            <div>
              <div className="marketing-kicker">Formules</div>
              <h2 className="marketing-title-section">Formules pour {module.name}</h2>
            </div>
            <Link to="/pricing" className="marketing-link">
              Voir toutes les options
            </Link>
          </div>
          <div className="marketing-grid-2 marketing-pricing-pair">
            {module.plans.slice(0, 1).map((plan, index) => (
              <PricingCard
                key={plan.name}
                title={plan.name}
                price={plan.priceMonthly}
                note={plan.priceNote}
                summary={plan.summary}
                highlights={plan.highlights}
                accentColor={module.accentColor}
                ctaLabel={module.ctaLabel}
                ctaHref={module.ctaHref}
                featured={index === 0}
              />
            ))}
            <PricingCard
              title={cadovaBundle.name}
              price={cadovaBundle.priceMonthly}
              note={cadovaBundle.note}
              summary="Si ce module devient central dans ta recherche, la formule complete garde la suite du parcours au meme endroit."
              highlights={cadovaBundle.highlights}
              accentColor="#161426"
              ctaLabel="Voir la formule complete"
              ctaHref="/pricing"
            />
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container">
          <div className="marketing-section-head">
            <div>
              <div className="marketing-kicker">Continuer</div>
              <h2 className="marketing-title-section">Voir les autres modules</h2>
            </div>
            <Link to="/modules" className="marketing-link">
              Retour aux modules
            </Link>
          </div>
          <div className="marketing-grid-2 marketing-continuation-grid">
            {continuationModules.map((item) => (
              <Link key={item.slug} to={item.route} className="marketing-module-card" style={{ borderColor: item.hoverBorder }}>
                <span className="marketing-module-icon-wrap">
                  <item.icon size={20} style={{ color: item.accentColor }} />
                </span>
                <h3>{item.name}</h3>
                <p className="marketing-card-copy">{item.shortDescription}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
