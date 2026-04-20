import { Link } from "react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { MarketingShell } from "../components/MarketingShell";
import { useSEO } from "../hooks/useSEO";
import { PRO_PRICING } from "../lib/payment-service";

const plans = [
  {
    name: "Gratuit",
    price: "0 €",
    note: "pour commencer",
    summary: "Pour créer tes premiers documents et suivre quelques candidatures.",
    cta: "Commencer gratuitement",
    href: "/signup",
    featured: false,
    highlights: [
      "CV limité",
      "Lettres limitées",
      "Suivi jusqu’à 5 candidatures",
      "Templates email de base",
    ],
  },
  {
    name: "Pro",
    price: PRO_PRICING.monthly.price,
    note: "par mois",
    summary: "Pour gérer toute ta recherche d’emploi sans limite.",
    cta: "Passer Pro",
    href: "/checkout",
    featured: true,
    highlights: [
      "Accès complet à tous les outils",
      "Suivi candidatures illimité",
      "Relances et historique email",
      "Paiement annuel disponible avec réduction",
    ],
  },
];

export function Pricing() {
  useSEO({
    title: "Tarifs Cadova",
    description: "Un plan gratuit pour commencer, un plan Pro à 8,99€/mois pour gérer toute ta recherche d’emploi.",
    noindex: false,
  });

  return (
    <MarketingShell>
      <section className="marketing-section marketing-hero">
        <div className="marketing-container marketing-panel" style={{ padding: 30 }}>
          <div style={{ maxWidth: 760 }}>
            <div className="marketing-kicker">Tarifs</div>
            <h1 className="marketing-title-section">Un seul espace pour gérer toute ta recherche.</h1>
            <p className="marketing-copy" style={{ marginTop: 16 }}>
              Cadova remplace les fichiers éparpillés, les tableaux bricolés et les relances oubliées par un espace clair pour avancer.
            </p>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="marketing-container">
          <div className="grid gap-5 lg:grid-cols-2">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-[8px] border bg-white p-6 shadow-sm ${
                  plan.featured ? "border-indigo-200 shadow-indigo-500/10" : "border-slate-200"
                }`}
              >
                {plan.featured && (
                  <span className="mb-5 inline-flex rounded-[8px] bg-indigo-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-indigo-600">
                    Le plus complet
                  </span>
                )}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-950">{plan.name}</h2>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">{plan.summary}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-slate-950">{plan.price}</p>
                    <p className="text-xs font-semibold text-slate-500">{plan.note}</p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {plan.highlights.map((highlight) => (
                    <div key={highlight} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>

                <Link
                  to={plan.href}
                  className={`mt-8 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] px-5 text-sm font-black ${
                    plan.featured ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-slate-100 text-slate-950"
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="size-4" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
