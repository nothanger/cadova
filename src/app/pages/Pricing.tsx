import { Link } from "react-router";
import { MarketingShell } from "../components/MarketingShell";
import { PricingCard } from "../components/PricingCard";
import { useSEO } from "../hooks/useSEO";
import { cadovaBundle, cadovaModules, cadovaPlans } from "../lib/module-data";

const pricingItems = [
  "bundle",
  ...cadovaModules,
];

const recommendations = [
  {
    title: "Lyceen / premier stage",
    need: "Premier dossier a rendre lisible rapidement.",
    recommendation: "ReussIA",
    reason: "Tu construis ton CV, ta lettre et ton score ATS sans partir d'une page blanche.",
    ctaLabel: "Choisir ReussIA",
    ctaHref: "/signup",
    accentColor: "#5044f5",
  },
  {
    title: "Etudiant / alternance",
    need: "Recherche active avec plusieurs candidatures en parallele.",
    recommendation: "Cadova Complet",
    reason: "Tu relies candidature, entretien, suivi et profil dans un meme rythme.",
    ctaLabel: "Choisir Cadova Complet",
    ctaHref: "/signup",
    accentColor: "#5044f5",
  },
  {
    title: "Besoin principal : entretien",
    need: "Un oral approche et tu veux structurer tes reponses.",
    recommendation: "OralIA",
    reason: "Tu t'entraines sur des questions concretes avec un feedback directement exploitable.",
    ctaLabel: "Tester OralIA",
    ctaHref: "/signup",
    accentColor: "#d946ef",
  },
  {
    title: "Besoin principal : suivi",
    need: "Tu envoies beaucoup et tu perds le fil.",
    recommendation: "TrackIA",
    reason: "Tu gardes une vue claire sur tes statuts, relances et opportunites actives.",
    ctaLabel: "Decouvrir TrackIA",
    ctaHref: "/signup",
    accentColor: "#14b8a6",
  },
  {
    title: "Profil / LinkedIn / competences",
    need: "Ton positionnement doit devenir plus net.",
    recommendation: "SkillIA",
    reason: "Tu rends ton profil public plus coherent avec les postes que tu vises.",
    ctaLabel: "Lancer SkillIA",
    ctaHref: "/signup",
    accentColor: "#2563eb",
  },
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
        <div className="marketing-container">
          <div className="marketing-section-head">
            <div>
              <div className="marketing-kicker">Recommandation</div>
              <h2 className="marketing-title-section">Quelle formule te correspond ?</h2>
            </div>
            <p className="marketing-copy marketing-section-intro">
              Choisis selon ton profil, ton besoin principal et l'urgence de ta recherche.
            </p>
          </div>

          <div className="marketing-recommendation-grid">
            {recommendations.map((item) => (
              <article
                key={item.title}
                className="marketing-recommendation-card"
                style={{ borderColor: `${item.accentColor}2e` }}
              >
                <span className="marketing-recommendation-accent" style={{ background: item.accentColor }} />
                <div>
                  <h3>{item.title}</h3>
                  <p className="marketing-recommendation-need">{item.need}</p>
                </div>
                <div className="marketing-recommendation-result">
                  <span>Module conseille</span>
                  <strong style={{ color: item.accentColor }}>{item.recommendation}</strong>
                </div>
                <p className="marketing-card-copy">{item.reason}</p>
                <Link
                  to={item.ctaHref}
                  className="marketing-button-primary marketing-recommendation-cta"
                  style={{ background: item.accentColor, boxShadow: "none" }}
                >
                  {item.ctaLabel}
                </Link>
              </article>
            ))}
          </div>
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
