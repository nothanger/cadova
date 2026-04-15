import { Link, useParams } from "react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CadovaLogo } from "../components/CadovaLogo";
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
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f4f1ff", fontFamily: "DM Sans, system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <h1>Module introuvable</h1>
          <Link to="/modules">Retour aux modules</Link>
        </div>
      </div>
    );
  }

  const otherModules = cadovaModules.filter((item) => item.slug !== module.slug);

  return (
    <div style={{ background: "#f4f1ff", color: "#140f26", fontFamily: "DM Sans, system-ui, sans-serif", minHeight: "100vh" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          backdropFilter: "blur(16px)",
          background: "rgba(244,241,255,0.88)",
          borderBottom: "1px solid rgba(20,15,38,0.08)",
        }}
      >
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <Link to="/" style={{ display: "inline-flex", alignItems: "center" }}>
            <CadovaLogo width={72} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Link to="/modules" style={{ color: "#5b5570", textDecoration: "none", fontSize: 14 }}>
              Tous les modules
            </Link>
            <Link to="/modules/comparaison" style={{ color: "#5b5570", textDecoration: "none", fontSize: 14 }}>
              Comparer
            </Link>
            <Link to="/pricing" style={{ color: "#5b5570", textDecoration: "none", fontSize: 14 }}>
              Pricing
            </Link>
            <Link to={module.ctaHref} style={{ textDecoration: "none", background: module.accentColor, color: "white", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700 }}>
              {module.ctaLabel}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section style={{ padding: "72px 20px 48px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)", gap: 24, alignItems: "start" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, background: module.hoverBackground, border: `1px solid ${module.hoverBorder}`, color: module.accentColor, fontSize: 12, fontWeight: 700 }}>
                <module.icon size={14} />
                {module.name}
              </div>
              <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(2.8rem, 7vw, 4.8rem)", lineHeight: 1, letterSpacing: "-0.04em", margin: "16px 0 14px" }}>
                {module.tagline}
              </h1>
              <p style={{ maxWidth: 720, margin: 0, fontSize: 18, lineHeight: 1.72, color: "#5f5874" }}>{module.fullDescription}</p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
                <Link to={module.ctaHref} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 8, background: module.accentColor, color: "white", fontWeight: 700 }}>
                  {module.ctaLabel}
                  <ArrowRight size={18} />
                </Link>
                <Link to="/modules/comparaison" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 8, border: "1px solid rgba(20,15,38,0.12)", color: "#140f26", fontWeight: 700, background: "white" }}>
                  Comparer avec les autres modules
                </Link>
              </div>
            </div>

            <div
              style={{
                background: "linear-gradient(160deg, #13152A 0%, #191c34 60%, #211a43 100%)",
                color: "white",
                borderRadius: 8,
                padding: 28,
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 18px 42px rgba(20,15,38,0.18)",
              }}
            >
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)", marginBottom: 8 }}>{module.previewTitle}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{module.shortDescription}</div>
              <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
                {module.previewMetrics.map((metric) => (
                  <div key={metric.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ color: "rgba(255,255,255,0.76)" }}>{metric.label}</span>
                    <strong style={{ color: "white" }}>{metric.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section style={{ background: "white", padding: "56px 20px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <div style={{ padding: 22, borderRadius: 8, background: "#f8f7fc", border: "1px solid rgba(20,15,38,0.08)" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#8d86a2" }}>Pour qui</div>
              <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                {module.targetAudience.map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "start", gap: 10, color: "#4f4764" }}>
                    <CheckCircle2 size={16} style={{ color: module.accentColor, marginTop: 3 }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: 22, borderRadius: 8, background: "#f8f7fc", border: "1px solid rgba(20,15,38,0.08)" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#8d86a2" }}>Fonctions cles</div>
              <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                {module.features.map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "start", gap: 10, color: "#4f4764" }}>
                    <CheckCircle2 size={16} style={{ color: module.accentColor, marginTop: 3 }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: 22, borderRadius: 8, background: "#f8f7fc", border: "1px solid rgba(20,15,38,0.08)" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#8d86a2" }}>Ce que ca change</div>
              <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                {module.benefits.map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "start", gap: 10, color: "#4f4764" }}>
                    <CheckCircle2 size={16} style={{ color: module.accentColor, marginTop: 3 }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section style={{ padding: "56px 20px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto" }}>
            <div style={{ maxWidth: 620 }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#8d86a2" }}>Cas d'usage</div>
              <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.05, margin: "12px 0 14px" }}>
                Quand {module.name} est le bon choix
              </h2>
            </div>
            <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              {module.useCases.map((item, index) => (
                <div key={item} style={{ background: "white", borderRadius: 8, padding: 22, border: "1px solid rgba(20,15,38,0.08)" }}>
                  <div style={{ fontSize: 12, color: module.accentColor, marginBottom: 12 }}>Use case {index + 1}</div>
                  <p style={{ margin: 0, color: "#5f5874", lineHeight: 1.7 }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ background: "white", padding: "56px 20px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 22 }}>
              <div>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#8d86a2" }}>Pricing</div>
                <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.05, margin: "12px 0 0" }}>
                  Formules pour {module.name}
                </h2>
              </div>
              <Link to="/pricing" style={{ textDecoration: "none", color: "#140f26", fontWeight: 700 }}>
                Voir tous les prix
              </Link>
            </div>
            <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
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
                summary="Si ce module est au coeur de ta recherche, la formule complete t'evite de sortir du produit au moment de suivre ou preparer la suite."
                highlights={cadovaBundle.highlights}
                accentColor="#5548f5"
                ctaLabel="Voir la formule complete"
                ctaHref="/pricing"
              />
            </div>
          </div>
        </section>

        <section style={{ padding: "56px 20px 80px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 22 }}>
              <div>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#8d86a2" }}>Continuer</div>
                <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.05, margin: "12px 0 0" }}>
                  Voir les autres modules
                </h2>
              </div>
              <Link to="/modules" style={{ textDecoration: "none", color: "#140f26", fontWeight: 700 }}>
                Retour au catalogue
              </Link>
            </div>
            <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {otherModules.map((item) => (
                <Link key={item.slug} to={item.route} style={{ textDecoration: "none", color: "inherit", background: "white", borderRadius: 8, padding: 20, border: "1px solid rgba(20,15,38,0.08)" }}>
                  <item.icon size={18} style={{ color: item.accentColor }} />
                  <div style={{ marginTop: 14, fontSize: 20, fontWeight: 700 }}>{item.name}</div>
                  <p style={{ margin: "10px 0 0", color: "#625b76", lineHeight: 1.6 }}>{item.shortDescription}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
