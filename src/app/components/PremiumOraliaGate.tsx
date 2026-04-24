import { Link } from "react-router";
import { LockKeyhole, Mic, Sparkles } from "lucide-react";
import { AppLayout } from "./AppLayout";

export function PremiumOraliaGate() {
  return (
    <AppLayout>
      <div className="mx-auto grid min-h-[calc(100svh-8rem)] max-w-4xl place-items-center px-2">
        <div className="w-full overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.10)]">
          <div className="grid md:grid-cols-[1fr_300px]">
            <section className="p-6 md:p-8">
              <div className="mb-6 flex size-12 items-center justify-center rounded-[8px] bg-pink-50 text-pink-600">
                <Mic className="size-6" />
              </div>
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-pink-600">OralIA Pro</p>
              <h1 className="text-3xl font-black leading-tight text-slate-950 md:text-5xl">
                OralIA est réservé au plan Pro
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
                Débloque les entraînements d’entretien avec Cadova Pro et prépare tes réponses avec un feedback complet.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/checkout"
                  className="inline-flex min-h-11 items-center justify-center rounded-[8px] bg-gradient-to-r from-indigo-600 to-sky-600 px-5 text-sm font-black !text-white shadow-lg shadow-indigo-500/20"
                >
                  Passer au Pro
                </Link>
                <Link
                  to="/dashboard"
                  className="inline-flex min-h-11 items-center justify-center rounded-[8px] border border-slate-200 px-5 text-sm font-bold text-slate-700"
                >
                  Retour à l’accueil
                </Link>
              </div>
            </section>
            <aside className="bg-slate-950 p-6 text-white md:p-8">
              <div className="flex h-full min-h-64 flex-col justify-between">
                <LockKeyhole className="size-8 text-white/80" />
                <div className="space-y-4">
                  {["Questions d’entretien", "Feedback méthode STAR", "Rapport de progression"].map((item) => (
                    <div key={item} className="flex items-center gap-3 text-sm font-semibold text-white/85">
                      <Sparkles className="size-4 text-pink-300" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
