import { Link } from "react-router";
import { MarketingShell } from "../components/MarketingShell";
import { useSEO } from "../hooks/useSEO";
import { cadovaModules } from "../lib/module-data";

const rows = [
  {
    label: "Role principal",
    getValue: (slug: string) =>
      ({
        reussia: "Mettre le dossier au propre",
        oralia: "S'entrainer avant l'entretien",
        trackia: "Ne plus perdre le fil",
        skillia: "Rendre le profil lisible",
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
    description: "Compare les modules Cadova selon ce qui te bloque maintenant dans ta recherche.",
    noindex: false,
  });

  return (
    <MarketingShell>
      <section className="marketing-section marketing-hero">
        <div className="marketing-container marketing-panel" style={{ padding: 30 }}>
          <div style={{ maxWidth: 800 }}>
            <div className="marketing-kicker">Comparaison</div>
            <h1 className="marketing-title-section">Le bon module depend de ce qui te bloque aujourd'hui.</h1>
            <p className="marketing-copy" style={{ marginTop: 16 }}>
              Si ton dossier est faible, commence par ReussIA. Si un entretien approche, prends OralIA. Le dashboard rassemble ensuite tes contenus et tes progres.
            </p>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container marketing-table-wrap">
          <div className="marketing-table">
            <div className="marketing-table-row marketing-table-head">
              <div className="marketing-table-cell" />
              {cadovaModules.map((module) => (
                <div key={module.slug} className="marketing-table-cell" style={{ borderTop: 0 }}>
                  <module.icon size={18} style={{ color: module.accentColor }} />
                  <div style={{ marginTop: 12, fontWeight: 800, color: "#161426" }}>{module.name}</div>
                  <div style={{ marginTop: 6 }}>{module.tagline}</div>
                </div>
              ))}
            </div>

            {rows.map((row) => (
              <div key={row.label} className="marketing-table-row">
                <div className="marketing-table-cell">{row.label}</div>
                {cadovaModules.map((module) => (
                  <div key={`${row.label}-${module.slug}`} className="marketing-table-cell">
                    {row.getValue(module.slug)}
                  </div>
                ))}
              </div>
            ))}

            <div className="marketing-table-row">
              <div className="marketing-table-cell">Prochaine etape</div>
              {cadovaModules.map((module) => (
                <div key={`cta-${module.slug}`} className="marketing-table-cell">
                  <Link to={module.route} className="marketing-link" style={{ color: module.accentColor }}>
                    Voir si ca me correspond
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
