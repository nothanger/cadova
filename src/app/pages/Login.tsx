import { Link, useNavigate, useLocation } from "react-router";
import { Input } from "../components/ui/input";
import { Loader2, ArrowRight, Lock, Mail, Star } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CadovaLogo } from "../components/CadovaLogo";
import { useSEO } from "../hooks/useSEO";

export function Login() {
  useSEO({
    title: "Connexion — Cadova",
    description: "Connecte-toi à Cadova pour accéder à tes outils IA : CV, lettres, entretiens, candidatures.",
    noindex: false,
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingRedirect, setAwaitingRedirect] = useState(false);

  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ||
    "/dashboard";

 
  useEffect(() => {
    if (awaitingRedirect && user) {
      navigate(from, { replace: true });
    }
  }, [user, awaitingRedirect, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error.message || "Email ou mot de passe incorrect");
        setLoading(false);
      } else {
        toast.success("Connexion réussie !");
       
        setAwaitingRedirect(true);
      }
    } catch {
      toast.error("Erreur inattendue lors de la connexion");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "DM Sans, system-ui, sans-serif" }}>

      <div
        className="hidden lg:flex lg:w-[42%] xl:w-[38%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "#0C0B1A" }}
      >
     
        <div
          className="absolute top-0 left-0 w-80 h-80 rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{ background: "radial-gradient(circle, #5548F5, transparent)" }}
        />
        <div
          className="absolute bottom-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ background: "radial-gradient(circle, #8B5CF6, transparent)" }}
        />
       
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />

        <div className="relative z-10">
          <CadovaLogo width={80} white />
        </div>

        <div className="relative z-10">
          <blockquote
            className="text-xl font-semibold leading-relaxed mb-6 text-white"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            "J'ai décroché mon alternance en 2 semaines grâce à Cadova. Le score ATS a tout changé."
          </blockquote>
          <div className="flex items-center gap-3">
            <div
              className="size-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #5548F5, #8B5CF6)" }}
            >
              ML
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Marie L.</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.76)" }}>
                Étudiante Marketing · Lyon
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex gap-6">
          {[
            { value: "10K+", label: "Étudiants" },
            { value: "89%", label: "Réussite" },
            { value: "4.8", label: "Note", icon: Star },
          ].map((s) => (
            <div key={s.label}>
              <div
                className="text-xl font-extrabold text-white flex items-center gap-2"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                {"icon" in s && s.icon ? <s.icon className="w-5 h-5 text-current" /> : null}
                {s.value}
              </div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.72)" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      
      <div className="flex-1 flex items-center justify-center p-6 md:p-12" style={{ background: "#FAFAFA" }}>
        <div className="w-full max-w-md">
          
          <div className="lg:hidden flex justify-center mb-10">
            <CadovaLogo width={80} />
          </div>

          <div className="mb-10">
            <h1
              className="font-extrabold mb-2"
              style={{ fontFamily: "Syne, sans-serif", fontSize: "2rem", color: "#0C0B1A" }}
            >
              Bon retour !
            </h1>
            <p className="text-sm" style={{ color: "#6B6B8A" }}>
              Connecte-toi pour accéder à ton espace Cadova.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "#0C0B1A" }}>
                Email
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4"
                  style={{ color: "#6B7280" }}
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

        
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold" style={{ color: "#0C0B1A" }}>
                  Mot de passe
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ color: "#5548F5" }}
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4"
                  style={{ color: "#6B7280" }}
                />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #5548F5, #8B5CF6)",
                boxShadow: "0 6px 24px rgba(85,72,245,0.4)",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Connexion…
                </>
              ) : (
                <>
                  Se connecter
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm" style={{ color: "#6B7280" }}>
              Pas encore de compte ?{" "}
              <Link
                to="/signup"
                className="font-semibold transition-opacity hover:opacity-70"
                style={{ color: "#5548F5" }}
              >
                Créer un compte gratuit
              </Link>
            </p>
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/"
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: "#6B7280" }}
            >
              ← Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
