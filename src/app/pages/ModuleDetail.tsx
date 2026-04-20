import { Link, useParams } from "react-router";
import { CheckCircle2 } from "lucide-react";
import { MarketingShell } from "../components/MarketingShell";
import { useSEO } from "../hooks/useSEO";
import { cadovaModules, getModuleBySlug } from "../lib/module-data";
import { PRO_PRICING } from "../lib/payment-service";

export function ModuleDetail() {
  const { slug } = useParams();
  const module = getModuleBySlug(slug);

  useSEO({
    title: module ? `${module.name} - Cadova` : "Outil Cadova",
    description: module?.fullDescription ?? "Détail d’un outil Cadova.",
    noindex: false,
  });

  if (!module) {
    return (
      <div className="marketing-empty">
        <div style={{ textAlign: "center" }}>
          <h1>Outil introuvable</h1>
          <Link to="/modules" className="marketing-link">
            Retour aux outils
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
              <Link to="/pricing" className="marketing-button-secondary">
                Voir les tarifs
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
            <div className="marketing-kicker">Fonctions clés</div>
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
            <div className="marketing-kicker">Ce que ça change</div>
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
              <div className="marketing-kicker">Cas d’usage</div>
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
              <div className="marketing-kicker">Accès</div>
              <h2 className="marketing-title-section">{module.name} est inclus dans Cadova.</h2>
            </div>
            <Link to="/pricing" className="marketing-link">
              Voir les tarifs
            </Link>
          </div>
          <div className="marketing-grid-2 marketing-pricing-pair">
            <div className="marketing-detail-block">
              <div className="marketing-kicker">Gratuit</div>
              <h3 style={{ marginTop: 12, fontSize: 28, fontWeight: 900, color: "#161426" }}>0 €</h3>
              <p className="marketing-card-copy" style={{ marginTop: 12 }}>
                Pour tester les outils essentiels et commencer ton dossier.
              </p>
              <Link to="/signup" className="marketing-button-secondary" style={{ marginTop: 22 }}>
                Commencer
              </Link>
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
                Accès complet à tous les outils, au suivi illimité et aux relances.
              </p>
              <Link to="/checkout" className="marketing-button-primary marketing-pricing-cta-featured" style={{ marginTop: 22 }}>
                Passer Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container">
          <div className="marketing-section-head">
            <div>
              <div className="marketing-kicker">Continuer</div>
              <h2 className="marketing-title-section">Voir les autres outils</h2>
            </div>
            <Link to="/modules" className="marketing-link">
              Retour aux outils
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
