import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { CadovaLogo } from "../components/CadovaLogo";

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
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPageState("ready");
      }
    });

    
    const timeout = setTimeout(() => {
      setPageState((s) => s === "loading" ? "invalid" : s);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const passwordStrength = (): { label: string; color: string; width: string } => {
    const len = password.length;
    if (len === 0) return { label: "", color: "transparent", width: "0%" };
    if (len < 6) return { label: "Trop court", color: "#EF4444", width: "25%" };
    if (len < 8) return { label: "Faible", color: "#F97316", width: "50%" };
    if (len < 12) return { label: "Correct", color: "#EAB308", width: "75%" };
    return { label: "Fort", color: "#22C55E", width: "100%" };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
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
      toast.success("Mot de passe mis à jour !");
      setTimeout(() => navigate("/dashboard", { replace: true }), 2500);
    }
  };

  const strength = passwordStrength();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "#FAFAFA", fontFamily: "DM Sans, system-ui, sans-serif" }}
    >
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-10">
          <CadovaLogo width={72} />
        </div>

        
        {pageState === "loading" && (
          <div className="text-center">
            <div
              className="size-12 rounded-full border-2 animate-spin mx-auto mb-4"
              style={{ borderColor: "rgba(85,72,245,0.15)", borderTopColor: "#5548F5" }}
            />
            <p className="text-sm" style={{ color: "#6B6B8A" }}>Vérification du lien…</p>
          </div>
        )}

        
        {pageState === "invalid" && (
          <div className="text-center">
            <div
              className="size-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ background: "#FEF2F2" }}
            >
              <AlertTriangle className="size-8" style={{ color: "#DC2626" }} />
            </div>
            <h1
              className="font-extrabold mb-3"
              style={{ fontFamily: "Syne, sans-serif", fontSize: "1.75rem", color: "#0C0B1A" }}
            >
              Lien expiré
            </h1>
            <p className="text-sm mb-8" style={{ color: "#6B6B8A" }}>
              Ce lien de réinitialisation est invalide ou a expiré (durée de vie : 1 heure).
              Demande-en un nouveau depuis la page de connexion.
            </p>
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-2 py-3 px-6 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #5548F5, #8B5CF6)" }}
            >
              Demander un nouveau lien
              <ArrowRight className="size-4" />
            </Link>
          </div>
        )}

        
        {pageState === "success" && (
          <div className="text-center">
            <div
              className="size-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ background: "#ECFDF5" }}
            >
              <CheckCircle2 className="size-8" style={{ color: "#059669" }} />
            </div>
            <h1
              className="font-extrabold mb-3"
              style={{ fontFamily: "Syne, sans-serif", fontSize: "1.75rem", color: "#0C0B1A" }}
            >
              Mot de passe mis à jour !
            </h1>
            <p className="text-sm" style={{ color: "#6B6B8A" }}>
              Redirection vers ton espace…
            </p>
          </div>
        )}

       
        {pageState === "ready" && (
          <>
            <div className="mb-8">
              <h1
                className="font-extrabold mb-2"
                style={{ fontFamily: "Syne, sans-serif", fontSize: "1.75rem", color: "#0C0B1A" }}
              >
                Nouveau mot de passe
              </h1>
              <p className="text-sm" style={{ color: "#6B6B8A" }}>
                Choisis un mot de passe fort (8 caractères minimum).
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
             
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: "#0C0B1A" }}>
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4" style={{ color: "#6B7280" }} />
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-11 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{
                      background: "white",
                      border: "1.5px solid rgba(85,72,245,0.15)",
                      color: "#0C0B1A",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#5548F5")}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(85,72,245,0.15)")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-60"
                    style={{ color: "#6B7280" }}
                  >
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                
                {password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="h-1 rounded-full" style={{ background: "#F3F4F6" }}>
                      <div
                        className="h-1 rounded-full transition-all duration-300"
                        style={{ width: strength.width, background: strength.color }}
                      />
                    </div>
                    <p className="text-xs" style={{ color: strength.color }}>
                      {strength.label}
                    </p>
                  </div>
                )}
              </div>

             
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: "#0C0B1A" }}>
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4" style={{ color: "#6B7280" }} />
                  <input
                    type={showConfirm ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-11 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{
                      background: "white",
                      border: "1.5px solid rgba(85,72,245,0.15)",
                      color: "#0C0B1A",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#5548F5")}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(85,72,245,0.15)")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-60"
                    style={{ color: "#6B7280" }}
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {confirm.length > 0 && password !== confirm && (
                  <p className="text-xs mt-1" style={{ color: "#EF4444" }}>
                    Les mots de passe ne correspondent pas
                  </p>
                )}
              </div>

              {error && (
                <div
                  className="p-3 rounded-xl text-sm"
                  style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password || !confirm}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, #5548F5, #8B5CF6)",
                  boxShadow: "0 6px 24px rgba(85,72,245,0.4)",
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Mise à jour…
                  </>
                ) : (
                  <>
                    Mettre à jour le mot de passe
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
