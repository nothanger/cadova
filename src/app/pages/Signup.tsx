import { Link, useNavigate } from "react-router";
import { Loader2, ArrowRight, Lock, Mail, User, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useSEO } from "../hooks/useSEO";
import { AuthShell } from "../components/AuthShell";

export function Signup() {
  useSEO({
    title: "Commencer avec Cadova",
    description: "Cree ton espace Cadova pour avancer sur ton CV, tes entretiens, tes relances et ton profil.",
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
      toast.error("Le mot de passe doit contenir au moins 6 caracteres");
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

          toast.error(error.message || "La creation du compte bloque pour le moment.");
        setLoading(false);
      } else {
        toast.success("Bienvenue, ton espace est pret.");
        navigate("/dashboard", { replace: true });
      }
    } catch {
      toast.error("Quelque chose a bloque. Reessaie dans un instant.");
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="mb-10 text-center lg:text-left">
        <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.055em] text-[var(--cadova-text)]">
          On te cree un espace ?
        </h1>
        <p className="mt-3 text-sm leading-7 text-[var(--cadova-muted)]">
          Tu peux tester pendant 14 jours, sans carte bancaire. Juste de quoi poser ta recherche au propre.
        </p>
      </div>

      {emailExistsError && (
        <div className="mb-5 flex items-start gap-3 rounded-[8px] border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-bold text-red-600">Cette adresse est deja connue ici.</p>
            <p className="mt-1 text-xs text-[var(--cadova-muted)]">
              Tu as surement deja un compte Cadova.{" "}
              <Link to="/login" className="font-bold text-[var(--cadova-primary)] underline">
                Connecte-toi ici
              </Link>
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-bold text-[var(--cadova-text)]">Ton nom</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8c91a3]" />
            <input
              type="text"
              placeholder="Ethan Martin"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              className="cadova-input w-full pl-11 pr-4"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[var(--cadova-text)]">Email</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8c91a3]" />
            <input
              type="email"
              placeholder="toi@exemple.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailExistsError) setEmailExistsError(false);
              }}
              required
              disabled={loading}
              className="cadova-input w-full pl-11 pr-4"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-[var(--cadova-text)]">Mot de passe</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8c91a3]" />
            <input
              type="password"
              placeholder="Au moins 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
              className="cadova-input w-full pl-11 pr-4"
            />
          </div>
          <p className="mt-2 text-xs text-[#a6abc0]">Garde-le simple a retenir, mais pas trop evident.</p>
        </div>

        <button type="submit" disabled={loading} className="cadova-button-primary w-full">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creation de ton espace...
            </>
          ) : (
            <>
              Commencer maintenant
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-5 text-center text-xs leading-6 text-[#a6abc0]">
        En creant ton espace, tu acceptes nos{" "}
        <span className="font-semibold text-[var(--cadova-primary)]">CGU</span> et notre{" "}
        <span className="font-semibold text-[var(--cadova-primary)]">politique de confidentialite</span>
      </p>

      <div className="mt-6 text-center text-sm text-[var(--cadova-muted)]">
        Deja un compte ?{" "}
        <Link to="/login" className="font-bold text-[var(--cadova-primary)]">
          Revenir a mon espace
        </Link>
      </div>

      <div className="mt-4 text-center">
        <Link to="/" className="text-xs text-[#a6abc0] hover:text-[var(--cadova-primary)]">
          Retour a l'accueil
        </Link>
      </div>
    </AuthShell>
  );
}
