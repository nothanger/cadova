import { useState } from "react";
import { Link } from "react-router";
import { Check, CreditCard, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "../components/AppLayout";
import { Button } from "../components/ui/button";
import { useSEO } from "../hooks/useSEO";
import { confirmProCheckout, PRO_PRICING, type BillingInterval } from "../lib/payment-service";
import { useAuth } from "@/contexts/AuthContext";

export function Checkout() {
  useSEO({ title: "Checkout Pro - Cadova", noindex: true });
  const { user, upgradeToPro } = useAuth();
  const [billing, setBilling] = useState<BillingInterval>("monthly");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const startCheckout = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await confirmProCheckout(user.id, billing);
      const { error } = await upgradeToPro(billing);
      if (error) throw error;
      setSuccess(true);
      toast.success("Plan Pro activé.");
    } catch {
      toast.error("Impossible d’activer le plan Pro pour le moment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-5xl place-items-center" style={{ fontFamily: "DM Sans, system-ui, sans-serif" }}>
        <div className="grid w-full overflow-hidden rounded-[8px] border border-black/5 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.10)] lg:grid-cols-[1fr_420px]">
          <section className="p-6 md:p-8">
            <div className="mb-8">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-500">Cadova Pro</p>
              <h1 className="font-black leading-tight text-slate-950" style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(2rem, 4vw, 3.4rem)", letterSpacing: "-0.05em" }}>
                Toute ta recherche d’emploi au même endroit.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                Ce checkout prépare le flux d’abonnement. Aucun paiement réel n’est traité dans cette version temporaire.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(["monthly", "yearly"] as BillingInterval[]).map((option) => {
                const price = PRO_PRICING[option];
                const selected = billing === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setBilling(option)}
                    className={`rounded-[8px] border p-4 text-left transition-all ${
                      selected ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-slate-200 bg-white hover:border-indigo-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-950">{price.label}</p>
                        <p className="mt-2 text-2xl font-black text-slate-950">{price.price}</p>
                        <p className="text-xs font-semibold text-slate-500">{price.note}</p>
                      </div>
                      <span className={`flex size-5 items-center justify-center rounded-full border ${selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>
                        {selected && <Check className="size-3" />}
                      </span>
                    </div>
                    {"savings" in price && (
                      <p className="mt-3 inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-indigo-600">
                        {price.savings}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-8 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              {[
                "CV, lettres, ATS et entretiens",
                "Suivi candidatures illimité",
                "Relances et templates email",
                "Historique centralisé",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <aside className="bg-slate-950 p-6 text-white md:p-8">
            {success ? (
              <div className="flex h-full min-h-[360px] flex-col justify-center">
                <div className="mb-5 flex size-14 items-center justify-center rounded-[8px] bg-emerald-500/15 text-emerald-300">
                  <ShieldCheck className="size-7" />
                </div>
                <h2 className="text-2xl font-black">Plan Pro activé</h2>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  Ton espace Cadova est débloqué. Tu peux maintenant suivre toutes tes candidatures et utiliser les outils sans limite temporaire.
                </p>
                <Link to="/dashboard" className="mt-8 inline-flex min-h-11 items-center justify-center rounded-[8px] bg-white px-5 text-sm font-black text-slate-950">
                  Retour à l’accueil
                </Link>
              </div>
            ) : (
              <div className="flex h-full min-h-[360px] flex-col">
                <div className="mb-8 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-white/70">
                    <LockKeyhole className="size-4" />
                    Flux sécurisé
                  </div>
                  <CreditCard className="size-5 text-white/35" />
                </div>

                <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-black">Cadova Pro</p>
                      <p className="mt-1 text-xs text-white/60">{PRO_PRICING[billing].label}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black">{PRO_PRICING[billing].price}</p>
                      <p className="text-xs text-white/60">{PRO_PRICING[billing].note}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-auto">
                  <p className="mb-4 text-xs leading-5 text-white/60">
                    Version temporaire sans transaction réelle. Le code est isolé pour remplacer ce flux par Stripe ensuite.
                  </p>
                  <Button onClick={startCheckout} disabled={loading} className="h-12 w-full gap-2 bg-white font-black text-slate-950 hover:bg-white/90">
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                    Continuer
                  </Button>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
