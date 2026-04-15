import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { ModuleCard } from "../components/ModuleCard";
import { PricingCard } from "../components/PricingCard";
import { MarketingShell } from "../components/MarketingShell";
import { useSEO } from "../hooks/useSEO";
import { cadovaBundle, cadovaModules, moduleHighlights } from "../lib/module-data";

export function Modules() {
  useSEO({
    title: "Modules Cadova",
    description: "Vue d'ensemble des modules Cadova: ReussIA, OralIA, TrackIA et SkillIA.",
    noindex: false,
  });

  return (
    <MarketingShell>
        <section style={{ padding: "72px 20px 48px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto" }}>
            <div style={{ maxWidth: 760 }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "#827b98" }}>Catalogue produit</div>
              <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(2.6rem, 7vw, 4.8rem)", lineHeight: 1, letterSpacing: "-0.04em", margin: "12px 0 16px" }}>
                Les modules Cadova
              </h1>
              <p style={{ maxWidth: 640, fontSize: 18, lineHeight: 1.7, color: "#5f5874", margin: 0 }}>
                Chaque module couvre un moment precis du parcours candidat. Tu peux partir d'un besoin unique ou comparer l'ensemble avant de choisir ta formule.
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
              <Link to="/modules/comparaison" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 8, background: "#140f26", color: "white", fontWeight: 700 }}>
                Comparer les modules
                <ArrowRight size={18} />
              </Link>
              <Link to="/pricing" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 8, border: "1px solid rgba(20,15,38,0.12)", color: "#140f26", fontWeight: 700, background: "white" }}>
                Voir les formules
              </Link>
            </div>
          </div>
        </section>

        <section style={{ padding: "0 20px 56px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
            {cadovaModules.map((module) => (
              <ModuleCard key={module.slug} module={module} />
            ))}
          </div>
        </section>

        <section style={{ background: "white", padding: "56px 20px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18 }}>
              {moduleHighlights.map((item) => (
                <div key={item.title} style={{ padding: 20, borderRadius: 8, background: "#f8f7fc", border: "1px solid rgba(20,15,38,0.08)" }}>
                  <item.icon size={18} style={{ color: "#5548f5" }} />
                  <div style={{ marginTop: 14, fontSize: 20, fontWeight: 700 }}>{item.title}</div>
                  <p style={{ margin: "10px 0 0", color: "#625b76", lineHeight: 1.65 }}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: "56px 20px 80px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto" }}>
            <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.8fr)" }}>
              <div style={{ background: "#120d23", color: "white", borderRadius: 8, padding: 28 }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.46)" }}>
                  Vue d'ensemble
                </div>
                <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(2rem, 4vw, 3.2rem)", lineHeight: 1.05, margin: "12px 0 14px" }}>
                  Un produit modulaire, mais pense comme un ensemble.
                </h2>
                <p style={{ margin: 0, maxWidth: 560, color: "rgba(255,255,255,0.72)", lineHeight: 1.7 }}>
                  Tu peux prendre un seul module ou entrer dans une formule plus complete. L'interet n'est pas d'empiler des outils, mais de garder un parcours net du premier brouillon au suivi des candidatures.
                </p>
              </div>

              <PricingCard
                title={cadovaBundle.name}
                price={cadovaBundle.priceMonthly}
                note={cadovaBundle.note}
                summary="La formule la plus simple si tu veux tout faire dans le meme espace."
                highlights={cadovaBundle.highlights}
                accentColor="#5548f5"
                ctaLabel="Voir le pricing"
                ctaHref="/pricing"
                featured
              />
            </div>
          </div>
        </section>
    </MarketingShell>
  );
}
