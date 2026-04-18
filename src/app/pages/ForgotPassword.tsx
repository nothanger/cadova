import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Mail, ArrowRight, ArrowLeft, Loader2, CheckCircle2, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { CadovaLogo } from "../components/CadovaLogo";

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

  // Décompte du cooldown
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
        setError(
          "Supabase limite les envois d'emails à ~2 par heure sur le plan gratuit. " +
          "Attends quelques minutes avant de réessayer, ou vérifie tes spams — l'email est peut-être déjà arrivé."
        );
      } else {
        setError(err.message);
      }
    } else {
     
      try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
      setCooldown(COOLDOWN_SECONDS);
      setSent(true);
    }
  };

  const canResend = !loading && cooldown <= 0;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "#FAFAFA", fontFamily: "DM Sans, system-ui, sans-serif" }}
    >
      <div className="w-full max-w-md">
        
        <div className="flex justify-center mb-10">
          <CadovaLogo width={72} />
        </div>

        {sent ? (
          
          <div className="text-center">
            <div
              className="size-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ background: "linear-gradient(135deg, #ECFDF5, #D1FAE5)" }}
            >
              <CheckCircle2 className="size-8" style={{ color: "#059669" }} />
            </div>
            <h1
              className="font-extrabold mb-3"
              style={{ fontFamily: "Syne, sans-serif", fontSize: "1.75rem", color: "#0C0B1A" }}
            >
              Email envoyé !
            </h1>
            <p className="text-sm mb-2" style={{ color: "#6B6B8A" }}>
              Un lien de réinitialisation a été envoyé à
            </p>
            <p className="text-sm font-semibold mb-4" style={{ color: "#0C0B1A" }}>
              {email}
            </p>
            <p className="text-xs mb-6" style={{ color: "#9CA3AF" }}>
              Vérifie tes spams si tu ne le vois pas. Le lien expire dans 1 heure.
            </p>

           
            {cooldown > 0 ? (
              <div
                className="flex items-center justify-center gap-2 text-xs mb-6 py-2.5 px-4 rounded-xl"
                style={{ background: "#F3F4F6", color: "#9CA3AF" }}
              >
                <Clock className="size-3.5" />
                Renvoyer possible dans {cooldown}s
              </div>
            ) : (
              <button
                onClick={() => setSent(false)}
                className="text-xs font-semibold mb-6 transition-opacity hover:opacity-70"
                style={{ color: "#5548F5" }}
              >
                Renvoyer l'email
              </button>
            )}

            <div>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-70"
                style={{ color: "#5548F5" }}
              >
                <ArrowLeft className="size-4" />
                Retour à la connexion
              </Link>
            </div>
          </div>
        ) : (
          
          <>
            <div className="mb-8">
              <h1
                className="font-extrabold mb-2"
                style={{ fontFamily: "Syne, sans-serif", fontSize: "1.75rem", color: "#0C0B1A" }}
              >
                Mot de passe oublié ?
              </h1>
              <p className="text-sm" style={{ color: "#6B6B8A" }}>
                Saisis ton email et on t'envoie un lien pour réinitialiser ton mot de passe.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: "#0C0B1A" }}>
                  Adresse email
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4"
                    style={{ color: "#9CA3AF" }}
                  />
                  <input
                    type="email"
                    placeholder="vous@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{
                      background: "white",
                      border: "1.5px solid rgba(85,72,245,0.15)",
                      color: "#0C0B1A",
                      fontFamily: "DM Sans, sans-serif",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#5548F5")}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(85,72,245,0.15)")}
                  />
                </div>
              </div>

              {/* Erreur */}
              {error && (
                <div
                  className="p-3.5 rounded-xl text-sm leading-relaxed"
                  style={{ background: "#FFF7ED", border: "1px solid #FED7AA", color: "#C2410C" }}
                >
                  <p className="font-semibold mb-1">Limite d'envoi atteinte</p>
                  <p>{error}</p>
                </div>
              )}

              {/* Cooldown actif */}
              {cooldown > 0 && !error && (
                <div
                  className="flex items-center gap-2.5 p-3 rounded-xl text-sm"
                  style={{ background: "#F3F4F6", color: "#6B6B8A" }}
                >
                  <Clock className="size-4 shrink-0" />
                  <span>
                    Attends encore <strong>{cooldown}s</strong> avant de renvoyer un email.
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={!canResend || !email.trim()}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, #5548F5, #8B5CF6)",
                  boxShadow: canResend ? "0 6px 24px rgba(85,72,245,0.4)" : "none",
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Envoi en cours…
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
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
                style={{ color: "#9CA3AF" }}
              >
                <ArrowLeft className="size-3.5" />
                Retour à la connexion
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}