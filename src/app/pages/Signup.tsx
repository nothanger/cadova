import { Link, useNavigate } from "react-router";
import { Loader2, ArrowRight, Lock, Mail, User, CheckCircle, AlertCircle, Star } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CadovaLogo } from "../components/CadovaLogo";
import { useSEO } from "../hooks/useSEO";

const perks = [
  "14 jours d'essai gratuit, sans carte bancaire",
  "CV optimisé ATS en moins de 2 minutes",
  "Simulation d'entretien avec feedback IA",
  "Annulation à tout moment",
];

export function Signup() {
  useSEO({
    title: "Créer un compte — Cadova",
    description: "Inscris-toi gratuitement sur Cadova et accède à tous tes outils IA pour l'emploi : CV, lettres de motivation, simulation d'entretien.",
    noindex: false,
  });
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailExistsError, setEmailExistsError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailExistsError(false);

    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    setLoading(true);
    try {
      const { error } = await signUp(email, password, name);
      if (error) {
        
        const isEmailExists =
          (error as any).code === "email_exists" ||
          error.message?.toLowerCase().includes("already been registered") ||
          error.message?.toLowerCase().includes("already registered") ||
          error.message?.toLowerCase().includes("email_exists") ||
          (error as any).status === 422;

        if (isEmailExists) {
          setEmailExistsError(true);
          setLoading(false);
          return;
        }
        toast.error(error.message || "Erreur lors de la création du compte");
        setLoading(false);
      } else {
        toast.success("Compte cree. Verifie ton email pour activer la connexion.");
        navigate("/login", { replace: true });
      }
    } catch {
      toast.error("Erreur inattendue");
      setLoading(false);
    }
  };

  const inputStyle = {
    background: "white",
    border: "1.5px solid rgba(85,72,245,0.15)",
    color: "#0C0B1A",
    fontFamily: "DM Sans, sans-serif",
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "DM Sans, system-ui, sans-serif" }}>

     
      <div
        className="hidden lg:flex lg:w-[42%] xl:w-[38%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "#0C0B1A" }}
      >
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: "radial-gradient(circle, #5548F5, transparent)" }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-3xl opacity-15 pointer-events-none" style={{ background: "radial-gradient(circle, #EC4899, transparent)" }} />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "50px 50px" }} />

        <div className="relative z-10">
          <CadovaLogo width={80} white />
        </div>

        <div className="relative z-10">
          <h2 className="text-2xl font-extrabold text-white mb-8 leading-tight" style={{ fontFamily: "Syne, sans-serif" }}>
            Tout ce dont tu as besoin pour décrocher ton job.
          </h2>
          <div className="space-y-4">
            {perks.map((perk, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="size-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(85,72,245,0.3)" }}>
                  <CheckCircle className="size-3.5" style={{ color: "#A78BFA" }} />
                </div>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>{perk}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.76)" }}>Rejoins nos utilisateurs satisfaits</p>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {["M", "T", "S", "A"].map((l, i) => (
                <div key={i} className="size-8 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white" style={{ borderColor: "#0C0B1A", background: `hsl(${i * 60 + 240}, 65%, 55%)` }}>
                  {l}
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">10 000+ étudiants</p>
              <p className="text-xs flex items-center gap-2" style={{ color: "rgba(255,255,255,0.72)" }}>
                <Star className="w-5 h-5 text-current" />
                <span>Note moyenne 4.8/5</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── PANNEAU DROIT — formulaire ── */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12" style={{ background: "#FAFAFA" }}>
        <div className="w-full max-w-md">

          {/* Logo mobile */}
          <div className="lg:hidden flex justify-center mb-10">
            <CadovaLogo width={80} />
          </div>

          <div className="mb-10">
            <h1 className="font-extrabold mb-2" style={{ fontFamily: "Syne, sans-serif", fontSize: "2rem", color: "#0C0B1A" }}>
              Créer un compte
            </h1>
            <p className="text-sm" style={{ color: "#6B6B8A" }}>
              Gratuit pendant 14 jours. Aucune carte bancaire requise.
            </p>
          </div>

          
          {emailExistsError && (
            <div
              className="flex items-start gap-3 p-4 rounded-xl mb-5"
              style={{ background: "rgba(239,68,68,0.07)", border: "1.5px solid rgba(239,68,68,0.25)" }}
            >
              <AlertCircle className="size-5 flex-shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#EF4444" }}>
                  Cette adresse email est déjà utilisée.
                </p>
                <p className="text-xs mt-1" style={{ color: "#6B6B8A" }}>
                  Tu as déjà un compte Cadova.{" "}
                  <Link to="/login" className="font-semibold underline" style={{ color: "#5548F5" }}>
                    Connecte-toi ici →
                  </Link>
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
           
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "#0C0B1A" }}>Nom complet</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4" style={{ color: "#6B7280" }} />
                <input
                  type="text"
                  placeholder="Jean Dupont"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "#5548F5")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(85,72,245,0.15)")}
                />
              </div>
            </div>

            
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "#0C0B1A" }}>Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4" style={{ color: "#6B7280" }} />
                <input
                  type="email"
                  placeholder="vous@exemple.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (emailExistsError) setEmailExistsError(false); }}
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    ...inputStyle,
                    borderColor: emailExistsError ? "rgba(239,68,68,0.5)" : "rgba(85,72,245,0.15)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = emailExistsError ? "rgba(239,68,68,0.7)" : "#5548F5")}
                  onBlur={(e) => (e.target.style.borderColor = emailExistsError ? "rgba(239,68,68,0.5)" : "rgba(85,72,245,0.15)")}
                />
              </div>
            </div>

           
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "#0C0B1A" }}>Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4" style={{ color: "#6B7280" }} />
                <input
                  type="password"
                  placeholder="Minimum 6 caractères"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "#5548F5")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(85,72,245,0.15)")}
                />
              </div>
              <p className="text-xs mt-1.5" style={{ color: "#6B7280" }}>Chiffré et stocké de manière sécurisée</p>
            </div>

           
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{
                background: "linear-gradient(135deg, #5548F5, #8B5CF6)",
                boxShadow: "0 6px 24px rgba(85,72,245,0.4)",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Création…
                </>
              ) : (
                <>
                  Créer mon compte
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-xs text-center mt-5" style={{ color: "#6B7280" }}>
            En créant un compte, tu acceptes nos{" "}
            <span className="cursor-pointer hover:opacity-70" style={{ color: "#5548F5" }}>CGU</span>
            {" "}et notre{" "}
            <span className="cursor-pointer hover:opacity-70" style={{ color: "#5548F5" }}>politique de confidentialité</span>
          </p>

          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: "#6B7280" }}>
              Déjà un compte ?{" "}
              <Link to="/login" className="font-semibold hover:opacity-70" style={{ color: "#5548F5" }}>
                Se connecter
              </Link>
            </p>
          </div>

          <div className="mt-4 text-center">
            <Link to="/" className="text-xs hover:opacity-70" style={{ color: "#6B7280" }}>
              ← Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
