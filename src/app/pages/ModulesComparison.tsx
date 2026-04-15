import { Link } from "react-router";
import { MarketingShell } from "../components/MarketingShell";
import { useSEO } from "../hooks/useSEO";
import { cadovaModules } from "../lib/module-data";

const rows = [
  {
    label: "Role principal",
    getValue: (slug: string) =>
      ({
        reussia: "Construire les candidatures",
        oralia: "Preparer l'oral",
        trackia: "Suivre les candidatures",
        skillia: "Clarifier le profil",
      }[slug] || ""),
  },
  {
    label: "Pour qui",
    getValue: (slug: string) => cadovaModules.find((module) => module.slug === slug)?.targetAudience[0] ?? "",
  },
  {
    label: "Usage type",
    getValue: (slug: string) => cadovaModules.find((module) => module.slug === slug)?.useCases[0] ?? "",
  },
  {
    label: "Fonction cle",
    getValue: (slug: string) => cadovaModules.find((module) => module.slug === slug)?.features[0] ?? "",
  },
  {
    label: "Prix d'entree",
    getValue: (slug: string) => cadovaModules.find((module) => module.slug === slug)?.plans[0]?.priceMonthly ?? "",
  },
];

export function ModulesComparison() {
  useSEO({
    title: "Comparaison des modules Cadova",
    description: "Compare ReussIA, OralIA, TrackIA et SkillIA selon usage, cible et pricing.",
    noindex: false,
  });

  return (
    <MarketingShell>
        <section style={{ padding: "72px 20px 42px" }}>
          <div style={{ maxWidth: 780, margin: "0 auto" }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#827b98" }}>Comparaison</div>
            <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(2.6rem, 7vw, 4.8rem)", lineHeight: 1, letterSpacing: "-0.04em", margin: "12px 0 16px" }}>
              Quel module te sert vraiment maintenant ?
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.7, color: "#5f5874", margin: 0 }}>
              Cette vue sert a trancher vite. Tu vois ce que chaque module fait, pour qui il est le plus utile, et a quel niveau de prix il commence.
            </p>
          </div>
        </section>

        <section style={{ padding: "0 20px 56px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", overflowX: "auto" }}>
            <div style={{ minWidth: 980, background: "white", borderRadius: 8, border: "1px solid rgba(20,15,38,0.08)", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "220px repeat(4, minmax(180px, 1fr))", background: "#f8f7fc" }}>
                <div style={{ padding: 18, borderRight: "1px solid rgba(20,15,38,0.08)" }} />
                {cadovaModules.map((module) => (
                  <div key={module.slug} style={{ padding: 18, borderRight: "1px solid rgba(20,15,38,0.08)" }}>
                    <module.icon size={18} style={{ color: module.accentColor }} />
                    <div style={{ marginTop: 12, fontWeight: 700 }}>{module.name}</div>
                    <div style={{ marginTop: 6, color: "#6b6480", lineHeight: 1.55, fontSize: 14 }}>{module.tagline}</div>
                  </div>
                ))}
              </div>

              {rows.map((row) => (
                <div key={row.label} style={{ display: "grid", gridTemplateColumns: "220px repeat(4, minmax(180px, 1fr))", borderTop: "1px solid rgba(20,15,38,0.08)" }}>
                  <div style={{ padding: 18, fontWeight: 700, color: "#433d58", borderRight: "1px solid rgba(20,15,38,0.08)" }}>{row.label}</div>
                  {cadovaModules.map((module) => (
                    <div key={`${row.label}-${module.slug}`} style={{ padding: 18, color: "#655e79", lineHeight: 1.6, borderRight: "1px solid rgba(20,15,38,0.08)" }}>
                      {row.getValue(module.slug)}
                    </div>
                  ))}
                </div>
              ))}

              <div style={{ display: "grid", gridTemplateColumns: "220px repeat(4, minmax(180px, 1fr))", borderTop: "1px solid rgba(20,15,38,0.08)" }}>
                <div style={{ padding: 18, fontWeight: 700, color: "#433d58", borderRight: "1px solid rgba(20,15,38,0.08)" }}>Voir le detail</div>
                {cadovaModules.map((module) => (
                  <div key={`cta-${module.slug}`} style={{ padding: 18, borderRight: "1px solid rgba(20,15,38,0.08)" }}>
                    <Link to={module.route} style={{ textDecoration: "none", color: module.accentColor, fontWeight: 700 }}>
                      Ouvrir la page module
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
    </MarketingShell>
  );
}
