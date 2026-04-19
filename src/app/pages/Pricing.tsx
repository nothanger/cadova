import { Link } from "react-router";
import { MarketingShell } from "../components/MarketingShell";
import { PricingCard } from "../components/PricingCard";
import { useSEO } from "../hooks/useSEO";
import { cadovaBundle, cadovaModules } from "../lib/module-data";

const pricingItems = [
  "bundle",
  ...cadovaModules,
];

const recommendations = [
  {
    title: "Lyceen / premier stage",
    need: "Tu dois rendre un premier dossier propre, sans trop savoir ce qu'on attend.",
    recommendation: "ReussIA",
    reason: "Tu poses un CV lisible, une lettre correcte et tu verifies les mots importants avant d'envoyer.",
    ctaLabel: "Commencer par ReussIA",
    ctaHref: "/signup",
    accentColor: "#5044f5",
  },
  {
    title: "Etudiant / alternance",
    need: "Tu as plusieurs offres, plusieurs dates, et ca commence a partir dans tous les sens.",
    recommendation: "Cadova Complet",
    reason: "Tu gardes le dossier, l'entretien, le suivi et ton profil dans le meme espace.",
    ctaLabel: "Choisir Cadova Complet",
    ctaHref: "/signup",
    accentColor: "#5044f5",
  },
  {
    title: "Entretien qui arrive",
    need: "Tu as peur de bloquer, de parler trop vite ou de repondre trop vague.",
    recommendation: "OralIA",
    reason: "Tu t'entraines avant le jour J et tu vois quelles reponses manquent de structure.",
    ctaLabel: "Preparer mon entretien",
    ctaHref: "/signup",
    accentColor: "#d946ef",
  },
];

export function Pricing() {
  useSEO({
    title: "Formules Cadova",
    description: "Choisis le module Cadova qui correspond a ton besoin du moment ou garde tout dans la formule complete.",
    noindex: false,
  });

  return (
    <MarketingShell>
      <section className="marketing-section marketing-hero">
        <div className="marketing-container marketing-panel" style={{ padding: 30 }}>
          <div style={{ maxWidth: 760 }}>
            <div className="marketing-kicker">Formules</div>
            <h1 className="marketing-title-section">Prends seulement ce qui t'aide maintenant.</h1>
            <p className="marketing-copy" style={{ marginTop: 16 }}>
              Si tu as juste un CV a remettre au propre, prends un module. Si ta recherche part sur plusieurs semaines avec entretiens, relances et profil a tenir, Cadova Complet sera plus confortable.
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
                  badge="Le plus pratique"
                  subtitle="Les 4 modules ensemble"
                  summary="Pour garder toute ta recherche au meme endroit, surtout quand les candidatures s'enchainent."
                  highlights={[
                    "CV, lettre, ATS, entretien, suivi et profil",
                    "Un dashboard qui garde la memoire",
                    "Plus simple pour une recherche active",
                  ]}
                  accentColor="#5044F5"
                  ctaLabel="Me simplifier la recherche"
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
              <div className="marketing-kicker">Petit repere</div>
              <h2 className="marketing-title-section">Quelle formule te correspond ?</h2>
            </div>
            <p className="marketing-copy marketing-section-intro">
              Pars de ta situation reelle. Le bon choix, c'est celui qui enleve le blocage le plus urgent.
            </p>
          </div>

          <div className="marketing-recommendation-grid">
            {recommendations.slice(0, 3).map((item) => (
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
                  <span>Je te conseille</span>
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

    </MarketingShell>
  );
}
