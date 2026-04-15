import { Link } from "react-router";
import { CadovaLogo } from "../components/CadovaLogo";
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
              Modules
            </Link>
            <Link to="/modules/comparaison" style={{ color: "#5b5570", textDecoration: "none", fontSize: 14 }}>
              Comparer
            </Link>
            <Link to="/signup" style={{ textDecoration: "none", background: "#5548f5", color: "white", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700 }}>
              Commencer
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section style={{ padding: "72px 20px 42px" }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#827b98" }}>Pricing</div>
            <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(2.6rem, 7vw, 4.8rem)", lineHeight: 1, letterSpacing: "-0.04em", margin: "12px 0 16px" }}>
              Des formules lisibles, module par module.
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.7, color: "#5f5874", margin: 0 }}>
              Tu peux commencer petit avec un seul module ou prendre la formule complete si tu veux construire, preparer et suivre sans sortir de Cadova.
            </p>
          </div>
        </section>

        <section style={{ padding: "0 20px 56px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
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
              accentColor="#5548f5"
              ctaLabel="Choisir Cadova complet"
              ctaHref="/signup"
              featured
            />
          </div>
        </section>

        <section style={{ background: "white", padding: "56px 20px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {cadovaPlans.map((plan) => (
              <div key={plan.name} style={{ padding: 24, borderRadius: 8, background: "#f8f7fc", border: "1px solid rgba(20,15,38,0.08)" }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#827b98" }}>{plan.name}</div>
                <p style={{ margin: "14px 0 0", color: "#5f5874", lineHeight: 1.7 }}>{plan.summary}</p>
                <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
                  {plan.bulletPoints.map((item) => (
                    <div key={item} style={{ color: "#4f4764" }}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
