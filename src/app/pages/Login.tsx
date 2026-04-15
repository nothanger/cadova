import { Link, useLocation, useNavigate } from "react-router";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Lock,
  Mail,
  MessageSquareText,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CadovaLogo } from "../components/CadovaLogo";
import { useSEO } from "../hooks/useSEO";

const workspaceItems = [
  {
    icon: FileText,
    title: "CV et versions sauvegardes",
    description: "Retrouve tes candidatures pretes a l'envoi sans repartir de zero.",
  },
  {
    icon: SearchCheck,
    title: "Historique ATS",
    description: "Garde un suivi clair des scores, corrections et points de blocage.",
  },
  {
    icon: MessageSquareText,
    title: "Simulations d'entretien",
    description: "Relance tes sessions et observe tes progres avant chaque rendez-vous.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Suivi des candidatures",
    description: "Centralise tes relances, statuts et prochaines actions au meme endroit.",
  },
];

const trustItems = [
  "Connexion securisee",
  "Tes donnees restent privees",
  "Acces a ton espace Cadova",
];

export function Login() {
  useSEO({
    title: "Connexion | Cadova",
    description:
      "Connecte-toi a Cadova pour retrouver ton espace de candidature, tes analyses ATS et tes simulations d'entretien.",
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

  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ||
    "/dashboard";

  useEffect(() => {
    if (awaitingRedirect && user) {
      navigate(from, { replace: true });
    }
  }, [awaitingRedirect, from, navigate, user]);

  const canSubmit =
    email.trim().length > 3 && password.trim().length > 0 && !loading;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!canSubmit) return;

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await signIn(email.trim(), password);

      if (error) {
        const message =
          error.message || "Email ou mot de passe incorrect. Verifie tes acces.";
        setErrorMessage(message);
        toast.error(message);
        setLoading(false);
        return;
      }

      setSuccessMessage("Connexion validee. Ouverture de ton espace...");
      toast.success("Connexion securisee");
      setAwaitingRedirect(true);
    } catch {
      setErrorMessage("Impossible de se connecter pour le moment.");
      toast.error("Impossible de se connecter pour le moment.");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#F5F4FF]"
      style={{ fontFamily: "DM Sans, system-ui, sans-serif" }}
    >
      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,520px)]">
        <section className="hidden px-8 py-8 lg:flex lg:flex-col lg:justify-between xl:px-12 xl:py-10">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center text-[#0F1021] transition-opacity hover:opacity-70"
            >
              <CadovaLogo width={86} />
            </Link>
            <div className="inline-flex items-center gap-2 rounded-[8px] border border-[#D9D7F7] bg-white/80 px-3 py-2 text-[13px] text-[#555A78] shadow-[0_12px_30px_rgba(15,16,33,0.05)]">
              <ShieldCheck className="h-4 w-4 text-[#5B57E8]" />
              Connexion securisee
            </div>
          </div>

          <div className="max-w-[620px] space-y-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-[8px] border border-[#D9D7F7] bg-white/85 px-3 py-2 text-sm text-[#5E6280]">
                <Lock className="h-4 w-4 text-[#5B57E8]" />
                Acces a ton espace Cadova
              </div>
              <div className="space-y-4">
                <h1
                  className="max-w-[12ch] text-[46px] font-semibold leading-[1.02] tracking-normal text-[#0F1021] xl:text-[56px]"
                  style={{ fontFamily: "Syne, sans-serif" }}
                >
                  Retrouve ton espace de travail sans friction.
                </h1>
                <p className="max-w-[56ch] text-[17px] leading-8 text-[#5E6280]">
                  Tes documents, tes analyses et ton suivi restent regroupes dans
                  une interface claire, prete a reprendre la ou tu t'etais arrete.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {workspaceItems.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[8px] border border-[#D8D6F3] bg-white/86 p-5 shadow-[0_18px_45px_rgba(15,16,33,0.05)]"
                >
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#EEF0FF] text-[#5B57E8]">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-base font-semibold text-[#0F1021]">
                      {item.title}
                    </h2>
                    <p className="text-sm leading-6 text-[#626784]">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-[#626784]">
            {trustItems.map((item) => (
              <div key={item} className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#5B57E8]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
          <div className="w-full max-w-[460px] rounded-[8px] border border-[#D9D7F7] bg-white px-5 py-6 shadow-[0_24px_70px_rgba(15,16,33,0.08)] sm:px-8 sm:py-8">
            <div className="mb-8 flex items-start justify-between gap-4">
              <Link
                to="/"
                className="inline-flex items-center text-[#0F1021] transition-opacity hover:opacity-70 lg:hidden"
              >
                <CadovaLogo width={78} />
              </Link>
              <div className="ml-auto inline-flex items-center gap-2 rounded-[8px] border border-[#E3E2F5] bg-[#F7F7FF] px-3 py-2 text-[13px] text-[#59607A]">
                <ShieldCheck className="h-4 w-4 text-[#5B57E8]" />
                Tes donnees restent privees
              </div>
            </div>

            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-[8px] border border-[#E3E2F5] bg-[#F8F8FE] px-3 py-2 text-[13px] text-[#5D6280]">
                <Lock className="h-4 w-4 text-[#5B57E8]" />
                Connexion securisee
              </div>
              <div className="space-y-2">
                <h1
                  className="text-[34px] font-semibold leading-[1.05] tracking-normal text-[#0F1021]"
                  style={{ fontFamily: "Syne, sans-serif" }}
                >
                  Bon retour.
                </h1>
                <p className="text-[15px] leading-7 text-[#616783]">
                  Connecte-toi pour retrouver ton tableau de bord, tes analyses ATS
                  et tes simulations d'entretien.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-[#141628]"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A7FA0]" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    disabled={loading}
                    className="h-12 w-full rounded-[8px] border border-[#D7D8E8] bg-white pl-10 pr-4 text-[15px] text-[#0F1021] outline-none transition focus:border-[#7C7AEF] focus:ring-4 focus:ring-[#7C7AEF]/10 disabled:cursor-not-allowed disabled:bg-[#F5F5FA]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-[#141628]"
                  >
                    Mot de passe
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-[#5B57E8] transition-opacity hover:opacity-70"
                  >
                    Mot de passe oublie ?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A7FA0]" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Entrez votre mot de passe"
                    disabled={loading}
                    className="h-12 w-full rounded-[8px] border border-[#D7D8E8] bg-white pl-10 pr-12 text-[15px] text-[#0F1021] outline-none transition focus:border-[#7C7AEF] focus:ring-4 focus:ring-[#7C7AEF]/10 disabled:cursor-not-allowed disabled:bg-[#F5F5FA]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#656B88] transition hover:bg-[#F3F4FD] hover:text-[#20253B]"
                    aria-label={
                      showPassword
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="inline-flex items-center gap-3 text-sm text-[#555B77]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border border-[#C9CBE0] text-[#5B57E8] focus:ring-[#5B57E8]/20"
                  />
                  Rester connecte sur cet appareil
                </label>
                <span className="text-xs text-[#8A8FAA]">
                  {rememberMe ? "Session memorisee" : "Session standard"}
                </span>
              </div>

              <div className="space-y-3">
                <div
                  className={`rounded-[8px] border px-4 py-3 text-sm leading-6 ${
                    errorMessage
                      ? "border-[#F1C7C7] bg-[#FFF7F7] text-[#9D3E3E]"
                      : successMessage
                        ? "border-[#CFE7D6] bg-[#F6FCF8] text-[#2E6F4B]"
                        : "border-[#E8E7F6] bg-[#FAFAFE] text-[#69708C]"
                  }`}
                >
                  {errorMessage ||
                    successMessage ||
                    "Accede a tes documents, ton suivi et tes modules depuis un seul espace."}
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[#14162A] px-4 text-sm font-semibold text-white transition hover:bg-[#1C1F38] disabled:cursor-not-allowed disabled:bg-[#B8BCD3]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Verification en cours...
                    </>
                  ) : (
                    <>
                      Continuer
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 grid gap-3 rounded-[8px] border border-[#ECEBFA] bg-[#FAFAFE] p-4 text-sm text-[#5D6481] sm:hidden">
              {workspaceItems.slice(0, 2).map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-[8px] bg-white text-[#5B57E8] shadow-[0_8px_20px_rgba(15,16,33,0.05)]">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-[#16182A]">{item.title}</p>
                    <p className="mt-1 leading-6">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-3 border-t border-[#ECEBFA] pt-6">
              <p className="text-sm text-[#5E6481]">
                Pas encore de compte ?{" "}
                <Link
                  to="/signup"
                  className="font-semibold text-[#5B57E8] transition-opacity hover:opacity-70"
                >
                  Creer un compte
                </Link>
              </p>
              <Link
                to="/"
                className="inline-flex items-center text-sm text-[#7B809B] transition-opacity hover:opacity-70"
              >
                Retour a l'accueil
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
