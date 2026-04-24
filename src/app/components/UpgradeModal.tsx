import { Link } from "react-router";
import { LockKeyhole, Sparkles, X } from "lucide-react";

type UpgradeModalProps = {
  open: boolean;
  onClose: () => void;
};

export function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[5000] grid place-items-center bg-slate-950/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[8px] border border-white/15 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
        <div className="relative p-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-[8px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>

          <div className="mb-5 flex size-12 items-center justify-center rounded-[8px] bg-indigo-50 text-indigo-600">
            <LockKeyhole className="size-5" />
          </div>

          <h2 className="text-2xl font-black text-slate-950">Passe à Cadova Pro</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Tu as utilisé ta génération gratuite. Débloque les CV, lettres, analyses et OralIA en illimité.
          </p>

          <div className="mt-5 rounded-[8px] border border-indigo-100 bg-indigo-50/70 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-indigo-900">
              <Sparkles className="size-4" />
              Accès complet Cadova
            </p>
            <p className="mt-1 text-xs leading-5 text-indigo-700">
              Générations illimitées, analyse ATS, lettres, CV et entraînements d’entretien.
            </p>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-[8px] px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
            >
              Plus tard
            </button>
            <Link
              to="/checkout"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center rounded-[8px] bg-gradient-to-r from-indigo-600 to-sky-600 px-5 text-sm font-black !text-white shadow-lg shadow-indigo-500/20 transition hover:opacity-95"
            >
              Débloquer Pro
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
