import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { AuthShell } from "../components/AuthShell";

type PageState = "loading" | "ready" | "success" | "invalid";

export function ResetPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setPageState("ready");
    });

    const timeout = setTimeout(() => {
      setPageState((s) => (s === "loading" ? "invalid" : s));
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const passwordStrength = () => {
    const len = password.length;
    if (len === 0) return { label: "", color: "transparent", width: "0%" };
    if (len < 6) return { label: "Trop court", color: "#dc2626", width: "25%" };
    if (len < 8) return { label: "Faible", color: "#f97316", width: "50%" };
    if (len < 12) return { label: "Correct", color: "#eab308", width: "75%" };
    return { label: "Fort", color: "#16a34a", width: "100%" };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const { error: err } = await resetPassword(password);
    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      setPageState("success");
      toast.success("Mot de passe mis a jour !");
      setTimeout(() => navigate("/dashboard", { replace: true }), 2500);
    }
  };

  const strength = passwordStrength();

  return (
    <AuthShell title="Reprends ton espace Cadova en securite.">
      {pageState === "loading" && (
        <div className="text-center">
          <div className="mx-auto mb-4 size-12 animate-spin rounded-full border-2 border-[rgba(80,68,245,0.16)] border-t-[var(--cadova-primary)]" />
          <p className="text-sm text-[var(--cadova-muted)]">Verification du lien...</p>
        </div>
      )}

      {pageState === "invalid" && (
        <div className="text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-[18px] bg-red-50">
            <AlertTriangle className="size-8 text-red-600" />
          </div>
          <h1 className="mb-3 text-[30px] font-extrabold tracking-[-0.055em] text-[var(--cadova-text)]">Lien expire</h1>
          <p className="mb-8 text-sm leading-7 text-[var(--cadova-muted)]">
            Ce lien de reinitialisation est invalide ou a expire. Demande-en un nouveau depuis la page de connexion.
          </p>
          <Link to="/forgot-password" className="cadova-button-primary px-6">
            Demander un nouveau lien
            <ArrowRight className="size-4" />
          </Link>
        </div>
      )}

      {pageState === "success" && (
        <div className="text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-[18px] bg-emerald-50">
            <CheckCircle2 className="size-8 text-emerald-600" />
          </div>
          <h1 className="mb-3 text-[30px] font-extrabold tracking-[-0.055em] text-[var(--cadova-text)]">
            Mot de passe mis a jour.
          </h1>
          <p className="text-sm text-[var(--cadova-muted)]">Redirection vers ton espace...</p>
        </div>
      )}

      {pageState === "ready" && (
        <>
          <div className="mb-8">
            <h1 className="mb-3 text-[30px] font-extrabold tracking-[-0.055em] text-[var(--cadova-text)]">
              Nouveau mot de passe
            </h1>
            <p className="text-sm leading-7 text-[var(--cadova-muted)]">Choisis un mot de passe fort de 8 caracteres minimum.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-bold text-[var(--cadova-text)]">Nouveau mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8c91a3]" />
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="cadova-input w-full pl-11 pr-12"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#8c91a3] hover:bg-[var(--cadova-primary-soft)]">
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="h-1 rounded-full bg-[var(--cadova-bg-alt)]">
                    <div className="h-1 rounded-full transition-all duration-300" style={{ width: strength.width, background: strength.color }} />
                  </div>
                  <p className="text-xs" style={{ color: strength.color }}>{strength.label}</p>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-[var(--cadova-text)]">Confirmer le mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8c91a3]" />
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  disabled={loading}
                  className="cadova-input w-full pl-11 pr-12"
                />
                <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#8c91a3] hover:bg-[var(--cadova-primary-soft)]">
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {confirm.length > 0 && password !== confirm && (
                <p className="mt-1 text-xs text-red-600">Les mots de passe ne correspondent pas</p>
              )}
            </div>

            {error && <div className="rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            <button type="submit" disabled={loading || !password || !confirm} className="cadova-button-primary w-full disabled:opacity-60">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Mise a jour...
                </>
              ) : (
                <>
                  Mettre a jour le mot de passe
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
