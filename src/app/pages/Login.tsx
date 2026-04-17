import { Link, useLocation, useNavigate } from "react-router";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useSEO } from "../hooks/useSEO";
import { AuthShell } from "../components/AuthShell";

export function Login() {
  useSEO({
    title: "Connexion | Cadova",
    description: "Retrouve tes candidatures, tes documents et tes prochaines actions dans Cadova.",
    noindex: false,
  });

  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [awaitingRedirect, setAwaitingRedirect] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard";

  useEffect(() => {
    if (awaitingRedirect && user) {
      navigate(from, { replace: true });
    }
  }, [awaitingRedirect, from, navigate, user]);

  const canSubmit = email.trim().length > 3 && password.trim().length > 0 && !loading;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await signIn(email.trim(), password);

      if (error) {
        const message = error.message || "Email ou mot de passe incorrect. Verifie tes acces.";
        setErrorMessage(message);
        toast.error(message);
        setLoading(false);
        return;
      }

      setSuccessMessage("C'est bon, on rouvre ton espace.");
      toast.success("Bon retour");
      setAwaitingRedirect(true);
    } catch {
      setErrorMessage("La connexion bloque pour le moment. Reessaie dans quelques instants.");
      toast.error("Connexion impossible pour le moment.");
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Reprends la ou tu t'etais arrete.">
      <div className="mb-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-[8px] border border-[var(--cadova-border)] bg-white px-3 py-2 text-[13px] font-semibold text-[var(--cadova-muted)]">
          <ShieldCheck className="size-4 text-[var(--cadova-primary)]" />
          Espace personnel
        </div>
        <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.055em] text-[var(--cadova-text)]">
          Content de te revoir.
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--cadova-muted)]">
          Connecte-toi pour retrouver tes CV, tes relances, tes simulations et les petites choses a finir.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-bold text-[var(--cadova-text)]">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8c91a3]" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              disabled={loading}
              className="cadova-input w-full pl-11 pr-4"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="password" className="text-sm font-bold text-[var(--cadova-text)]">
              Mot de passe
            </label>
            <Link to="/forgot-password" className="text-sm font-semibold text-[var(--cadova-primary)]">
              Mot de passe oublie ?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8c91a3]" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ton mot de passe"
              disabled={loading}
              className="cadova-input w-full pl-11 pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#697085] transition hover:bg-[var(--cadova-primary-soft)] hover:text-[var(--cadova-text)]"
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <label className="inline-flex items-center gap-3 text-sm text-[var(--cadova-muted)]">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="size-4 rounded border-[var(--cadova-border)] text-[var(--cadova-primary)] focus:ring-[var(--cadova-primary)]/20"
            />
            Rester connecte
          </label>
          <span className="text-xs text-[#a6abc0]">{rememberMe ? "On garde la porte ouverte" : "Connexion ponctuelle"}</span>
        </div>

        <div
          className={`rounded-[8px] border px-4 py-3 text-sm leading-6 ${
            errorMessage
              ? "border-red-200 bg-red-50 text-red-700"
              : successMessage
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-[var(--cadova-border)] bg-white text-[var(--cadova-muted)]"
          }`}
        >
          {errorMessage || successMessage || "Tu retrouves ton espace exactement la ou tu l'as laisse."}
        </div>

        <button type="submit" disabled={!canSubmit} className="cadova-button-primary w-full disabled:bg-[#b8bcd3] disabled:shadow-none">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              On verifie...
            </>
          ) : (
            <>
              Continuer
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 border-t border-[var(--cadova-border)] pt-6 text-sm text-[var(--cadova-muted)]">
        Pas encore de compte ?{" "}
        <Link to="/signup" className="font-bold text-[var(--cadova-primary)]">
          Commencer tranquille
        </Link>
      </div>
      <Link to="/" className="mt-3 inline-flex text-xs text-[#a6abc0] hover:text-[var(--cadova-primary)]">
        Retour a l'accueil
      </Link>
    </AuthShell>
  );
}
