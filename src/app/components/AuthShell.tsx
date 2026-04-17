import type { ReactNode } from "react";
import { CheckCircle, Star } from "lucide-react";
import { Link } from "react-router";
import { CadovaLogo } from "./CadovaLogo";

const defaultPerks = [
  "14 jours pour essayer sans carte bancaire",
  "Un CV plus clair, meme si tu pars d'un brouillon",
  "Des entrainements d'entretien sans pression",
  "Tu arretes quand tu veux",
];

export function AuthShell({
  children,
  title = "Un endroit calme pour reprendre tes candidatures.",
  perks = defaultPerks,
}: {
  children: ReactNode;
  title?: string;
  perks?: string[];
}) {
  return (
    <div className="grid min-h-[100svh] bg-[#f7f7f9] lg:grid-cols-[38%_62%]" style={{ fontFamily: "Sora, system-ui, sans-serif" }}>
      <aside className="relative hidden overflow-hidden bg-[var(--cadova-navy)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="absolute inset-0 opacity-100"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px), radial-gradient(circle at 85% 10%, rgba(80,68,245,0.24), transparent 25%), radial-gradient(circle at 12% 92%, rgba(80,68,245,0.14), transparent 24%)",
            backgroundSize: "48px 48px, 48px 48px, auto, auto",
          }}
        />

        <Link to="/" className="relative z-10 inline-flex">
          <CadovaLogo width={84} white />
        </Link>

        <div className="relative z-10 max-w-[560px]">
          <h1 className="max-w-[14ch] text-[34px] font-extrabold leading-[1.08] tracking-[-0.055em] text-white xl:text-[38px]">
            {title}
          </h1>
          <div className="mt-8 grid gap-5">
            {perks.map((perk) => (
              <div key={perk} className="flex items-center gap-3 text-sm text-white/76">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#5044f5]/28 text-[#b9b2ff]">
                  <CheckCircle className="size-3.5" />
                </span>
                <span>{perk}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 rounded-[18px] border border-white/10 bg-white/[0.045] p-5">
          <p className="mb-4 text-xs text-white/40">Des candidats qui avancent, chacun a son rythme</p>
          <div className="flex items-center gap-3">
            <div className="-space-x-2 flex">
              {["M", "T", "S", "A"].map((letter, index) => (
                <div
                  key={letter}
                  className="flex size-8 items-center justify-center rounded-full border-2 border-[var(--cadova-navy)] text-xs font-extrabold text-white"
                  style={{ background: ["#4053f5", "#d946ef", "#ef4444", "#d9f03f"][index] }}
                >
                  {letter}
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">Lyceens, etudiants, jeunes diplomes</p>
              <p className="flex items-center gap-2 text-xs text-white/36">
                <Star className="size-4" />
                <span>Un espace pour retrouver le fil</span>
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-h-[100svh] items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
        <div className="w-full max-w-[460px]">
          <div className="mb-10 flex justify-center lg:hidden">
            <CadovaLogo width={84} />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
