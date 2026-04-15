import { Link, useParams } from "react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
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

  return (
    <MarketingShell ctaHref={module.ctaHref} ctaLabel={module.ctaLabel}>
      <section className="marketing-section marketing-hero">
        <div className="marketing-container marketing-hero-grid marketing-detail-hero">
          <div className="marketing-panel" style={{ padding: 30 }}>
            <span
              className="marketing-tag"
              style={{
                color: module.accentColor,
                background: module.hoverBackground,
                border: `1px solid ${module.hoverBorder}`,
              }}
            >
              <module.icon size={14} />
              {module.name}
            </span>
            <h1 className="marketing-title-section" style={{ marginTop: 18 }}>
              {module.tagline}
            </h1>
            <p className="marketing-copy" style={{ marginTop: 18 }}>
              {module.fullDescription}
            </p>

            <div className="marketing-actions">
              <Link to={module.ctaHref} className="marketing-button-primary" style={{ background: module.accentColor }}>
                {module.ctaLabel}
                <ArrowRight size={18} />
              </Link>
              <Link to="/modules/comparaison" className="marketing-button-secondary">
                Comparer avec les autres modules
              </Link>
            </div>
          </div>

          <div className="marketing-panel" style={{ padding: 28 }}>
            <div className="marketing-kicker">
              {module.previewTitle}
            </div>
            <h2 className="marketing-title-section" style={{ marginTop: 14, fontSize: "clamp(1.8rem, 4vw, 3rem)" }}>
              {module.shortDescription}
            </h2>
            <div className="marketing-list" style={{ marginTop: 22 }}>
              {module.previewMetrics.map((metric) => (
                <div
                  key={metric.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    paddingBottom: 12,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    color: "#697085",
                  }}
                >
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
              {module.targetAudience.map((item) => (
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
              {module.features.map((item) => (
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
              {module.benefits.map((item) => (
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
            {module.useCases.map((item, index) => (
              <div key={item} className="marketing-detail-block">
                <div className="marketing-kicker" style={{ color: module.accentColor }}>
                  Use case {index + 1}
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
              <div className="marketing-kicker">Pricing</div>
              <h2 className="marketing-title-section">Formules pour {module.name}</h2>
            </div>
            <Link to="/pricing" className="marketing-link">
              Voir tous les prix
            </Link>
          </div>
          <div className="marketing-grid-3">
            {module.plans.map((plan, index) => (
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
              summary="Si ce module est central pour ta recherche, la formule complete garde la suite du parcours dans le meme espace."
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
              Retour au catalogue
            </Link>
          </div>
          <div className="marketing-grid-3">
            {otherModules.map((item) => (
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
