import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Mail, ArrowRight, ArrowLeft, Loader2, CheckCircle2, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell } from "../components/AuthShell";

const COOLDOWN_SECONDS = 60;
const STORAGE_KEY = "cadova_reset_last_sent";

function getSecondsLeft(): number {
  try {
    const last = Number(localStorage.getItem(STORAGE_KEY) || "0");
    const elapsed = Math.floor((Date.now() - last) / 1000);
    return Math.max(0, COOLDOWN_SECONDS - elapsed);
  } catch {
    return 0;
  }
}

export function ForgotPassword() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(getSecondsLeft);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      const left = getSecondsLeft();
      setCooldown(left);
      if (left <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || cooldown > 0) return;
    setLoading(true);
    setError(null);

    const { error: err } = await sendPasswordReset(email.trim());
    setLoading(false);

    if (err) {
      const msg = err.message.toLowerCase();
      if (msg.includes("rate limit") || msg.includes("too many") || msg.includes("over_email")) {
        setError("Supabase limite les envois d'emails. Attends quelques minutes avant de reessayer, ou verifie tes spams.");
      } else {
        setError(err.message);
      }
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {}
      setCooldown(COOLDOWN_SECONDS);
      setSent(true);
    }
  };

  const canResend = !loading && cooldown <= 0;

  return (
    <AuthShell title="Recupere ton acces sans perdre ton travail.">
      {sent ? (
        <div className="text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-[18px] bg-emerald-50">
            <CheckCircle2 className="size-8 text-emerald-600" />
          </div>
          <h1 className="mb-3 text-[30px] font-extrabold tracking-[-0.055em] text-[var(--cadova-text)]">
            Email envoye.
          </h1>
          <p className="text-sm leading-7 text-[var(--cadova-muted)]">Un lien de reinitialisation a ete envoye a</p>
          <p className="mb-4 mt-1 text-sm font-bold text-[var(--cadova-text)]">{email}</p>
          <p className="mb-6 text-xs leading-6 text-[#a6abc0]">Verifie tes spams si tu ne le vois pas. Le lien expire dans 1 heure.</p>

          {cooldown > 0 ? (
            <div className="mb-6 inline-flex items-center gap-2 rounded-[8px] border border-[var(--cadova-border)] bg-white px-4 py-2.5 text-xs text-[var(--cadova-muted)]">
              <Clock className="size-3.5" />
              Renvoyer possible dans {cooldown}s
            </div>
          ) : (
            <button onClick={() => setSent(false)} className="mb-6 text-xs font-bold text-[var(--cadova-primary)]">
              Renvoyer l'email
            </button>
          )}

          <div>
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--cadova-primary)]">
              <ArrowLeft className="size-4" />
              Retour a la connexion
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h1 className="mb-3 text-[30px] font-extrabold tracking-[-0.055em] text-[var(--cadova-text)]">
              Mot de passe oublie ?
            </h1>
            <p className="text-sm leading-7 text-[var(--cadova-muted)]">
              Saisis ton email et on t'envoie un lien pour reinitialiser ton mot de passe.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-bold text-[var(--cadova-text)]">Adresse email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8c91a3]" />
                <input
                  type="email"
                  placeholder="vous@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="cadova-input w-full pl-11 pr-4"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-[8px] border border-orange-200 bg-orange-50 p-3.5 text-sm leading-relaxed text-orange-700">
                <p className="mb-1 font-bold">Limite d'envoi atteinte</p>
                <p>{error}</p>
              </div>
            )}

            {cooldown > 0 && !error && (
              <div className="flex items-center gap-2.5 rounded-[8px] border border-[var(--cadova-border)] bg-white p-3 text-sm text-[var(--cadova-muted)]">
                <Clock className="size-4 shrink-0" />
                <span>
                  Attends encore <strong>{cooldown}s</strong> avant de renvoyer un email.
                </span>
              </div>
            )}

            <button type="submit" disabled={!canResend || !email.trim()} className="cadova-button-primary w-full disabled:opacity-50">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : cooldown > 0 ? (
                <>
                  <Clock className="size-4" />
                  Patienter ({cooldown}s)
                </>
              ) : (
                <>
                  Envoyer le lien
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-[#a6abc0] hover:text-[var(--cadova-primary)]">
              <ArrowLeft className="size-3.5" />
              Retour a la connexion
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
