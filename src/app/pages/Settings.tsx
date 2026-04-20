import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { useSEO } from "../hooks/useSEO";
import {
  User, Bell, Shield, CreditCard, Check, Loader2, LogIn,
  Lock, Eye, EyeOff, ChevronDown, ChevronUp,
  Smartphone, ShieldCheck, ShieldOff, Copy, CheckCheck,
  KeyRound, AlertTriangle,
} from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";


function ChangePasswordSection() {
  const { updatePassword } = useAuth();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const strengthOf = (pw: string) => {
    if (pw.length === 0) return null;
    if (pw.length < 6) return { label: "Trop court", color: "#EF4444", w: "25%" };
    if (pw.length < 8) return { label: "Faible", color: "#F97316", w: "50%" };
    if (pw.length < 12) return { label: "Correct", color: "#EAB308", w: "75%" };
    return { label: "Fort", color: "#22C55E", w: "100%" };
  };

  const strength = strengthOf(newPw);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPw.length < 8) { setError("Minimum 8 caractères."); return; }
    if (newPw !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    const { error: err } = await updatePassword(current, newPw);
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
      toast.success("Mot de passe mis à jour !");
      setCurrent(""); setNewPw(""); setConfirm("");
      setTimeout(() => { setSuccess(false); setOpen(false); }, 2000);
    }
  };

  const inputStyle = {
    background: "white",
    border: "1.5px solid rgba(85,72,245,0.12)",
    color: "#0C0B1A",
    fontFamily: "DM Sans, sans-serif",
  };

  return (
    <div
      className="overflow-hidden rounded-3xl shadow-sm"
      style={{ border: "1px solid rgba(85,72,245,0.1)", background: "white" }}
    >
    
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-5 text-left transition-colors hover:bg-indigo-50/50"
      >
        <div className="flex items-center gap-3">
          <div
            className="size-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(85,72,245,0.08)" }}
          >
            <KeyRound className="size-4" style={{ color: "#5548F5" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#0C0B1A" }}>Mot de passe</p>
            <p className="text-xs" style={{ color: "#9CA3AF" }}>Modifier ton mot de passe de connexion</p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="size-4 shrink-0" style={{ color: "#9CA3AF" }} />
        ) : (
          <ChevronDown className="size-4 shrink-0" style={{ color: "#9CA3AF" }} />
        )}
      </button>

     
      {open && (
        <div
          className="px-5 pb-5 pt-1"
          style={{ borderTop: "1px solid rgba(85,72,245,0.06)" }}
        >
          {success ? (
            <div
              className="flex items-center gap-2 p-3 rounded-xl text-sm"
              style={{ background: "#ECFDF5", color: "#059669" }}
            >
              <Check className="size-4" /> Mot de passe mis à jour avec succès !
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 mt-3">
              
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6B6B8A" }}>
                  Mot de passe actuel
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5" style={{ color: "#9CA3AF" }} />
                  <input
                    type={showCurrent ? "text" : "password"}
                    placeholder="••••••••"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    required
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "#5548F5")}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(85,72,245,0.12)")}
                  />
                  <button type="button" onClick={() => setShowCurrent(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-60" style={{ color: "#9CA3AF" }}>
                    {showCurrent ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                <div className="flex justify-end mt-1">
                  <Link to="/forgot-password" className="text-xs hover:opacity-70 transition-opacity" style={{ color: "#5548F5" }}>
                    Mot de passe oublié ?
                  </Link>
                </div>
              </div>

              
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6B6B8A" }}>
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5" style={{ color: "#9CA3AF" }} />
                  <input
                    type={showNew ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    required
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "#5548F5")}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(85,72,245,0.12)")}
                  />
                  <button type="button" onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-60" style={{ color: "#9CA3AF" }}>
                    {showNew ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                {strength && (
                  <div className="mt-1.5 space-y-1">
                    <div className="h-0.5 rounded-full" style={{ background: "#F3F4F6" }}>
                      <div className="h-0.5 rounded-full transition-all duration-300"
                        style={{ width: strength.w, background: strength.color }} />
                    </div>
                    <p className="text-xs" style={{ color: strength.color }}>{strength.label}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6B6B8A" }}>
                  Confirmer le nouveau mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5" style={{ color: "#9CA3AF" }} />
                  <input
                    type={showConfirm ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "#5548F5")}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(85,72,245,0.12)")}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-60" style={{ color: "#9CA3AF" }}>
                    {showConfirm ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                {confirm.length > 0 && newPw !== confirm && (
                  <p className="text-xs mt-1" style={{ color: "#EF4444" }}>Les mots de passe ne correspondent pas</p>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-xl text-sm" style={{ background: "#FEF2F2", color: "#DC2626" }}>
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setCurrent(""); setNewPw(""); setConfirm(""); setError(null); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                  style={{ background: "#F3F4F6", color: "#6B6B8A" }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading || !current || !newPw || !confirm}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #5548F5, #8B5CF6)" }}
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  {loading ? "Mise à jour..." : "Confirmer"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}


type TotpStep = "idle" | "enrolling" | "scanning" | "verifying" | "active" | "disabling";

function TwoFactorSection() {
  const { enrollTotp, verifyTotp, unenrollTotp, getMfaFactors } = useAuth();
  const [step, setStep] = useState<TotpStep>("idle");
  const [loading, setLoading] = useState(true);
  const [qrUri, setQrUri] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const loadFactors = useCallback(async () => {
    setLoading(true);
    const { factors } = await getMfaFactors();
    const totpFactors = Array.isArray(factors)
      ? factors.filter((f: any) => f.factor_type === "totp" && f.status === "verified")
      : [];
    if (totpFactors.length > 0) {
      setFactorId(totpFactors[0].id);
      setStep("active");
    } else {
      setStep("idle");
    }
    setLoading(false);
  }, [getMfaFactors]);

  useEffect(() => { loadFactors(); }, [loadFactors]);

  const handleEnroll = async () => {
    setStep("enrolling");
    setError(null);
    const { qrUri: qr, secret: sec, factorId: fid, error: err } = await enrollTotp();
    if (err) {
      setError(err.message);
      setStep("idle");
      return;
    }
    setQrUri(qr);
    setSecret(sec);
    setFactorId(fid);
    setStep("scanning");
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) { setError("Le code doit faire 6 chiffres."); return; }
    setVerifying(true);
    const { error: err } = await verifyTotp(factorId, code);
    setVerifying(false);
    if (err) {
      setError(err.message);
    } else {
      toast.success("Authentification à 2 facteurs activée !");
      setCode("");
      setStep("active");
    }
  };

  const handleDisable = async () => {
    setDisabling(true);
    setError(null);
    const { error: err } = await unenrollTotp(factorId);
    setDisabling(false);
    if (err) {
      setError(err.message);
    } else {
      toast.success("2FA désactivée.");
      setStep("idle");
      setFactorId("");
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="overflow-hidden rounded-3xl shadow-sm"
      style={{ border: "1px solid rgba(85,72,245,0.1)", background: "white" }}
    >
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="size-9 rounded-xl flex items-center justify-center"
            style={{
              background: step === "active"
                ? "rgba(34,197,94,0.1)"
                : "rgba(85,72,245,0.08)"
            }}
          >
            {step === "active"
              ? <ShieldCheck className="size-4" style={{ color: "#22C55E" }} />
              : <Smartphone className="size-4" style={{ color: "#5548F5" }} />
            }
          </div>
          <div>
            <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "#0C0B1A" }}>
              Authentification à 2 facteurs
              {step === "active" && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: "rgba(34,197,94,0.1)", color: "#16A34A" }}
                >
                  Activée
                </span>
              )}
            </p>
            <p className="text-xs" style={{ color: "#9CA3AF" }}>
              {step === "active"
                ? "Ton compte est protégé par Google Authenticator / Authy"
                : "Protège ton compte avec une app d'authentification (TOTP)"}
            </p>
          </div>
        </div>

        {loading && <Loader2 className="size-4 animate-spin" style={{ color: "#9CA3AF" }} />}

        {!loading && step === "idle" && (
          <button
            onClick={handleEnroll}
            className="text-xs font-semibold px-3.5 py-2 rounded-xl transition-all hover:opacity-80"
            style={{ background: "rgba(85,72,245,0.08)", color: "#5548F5" }}
          >
            Activer
          </button>
        )}

        {!loading && step === "active" && (
          <button
            onClick={handleDisable}
            disabled={disabling}
            className="text-xs font-semibold px-3.5 py-2 rounded-xl transition-all hover:opacity-80 disabled:opacity-50"
            style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444" }}
          >
            {disabling ? <Loader2 className="size-3.5 animate-spin" /> : "Désactiver"}
          </button>
        )}
      </div>

      {step === "enrolling" && (
        <div
          className="px-5 pb-5 flex items-center gap-3"
          style={{ borderTop: "1px solid rgba(85,72,245,0.06)" }}
        >
          <Loader2 className="size-4 animate-spin mt-4" style={{ color: "#5548F5" }} />
          <p className="text-sm mt-4" style={{ color: "#6B6B8A" }}>Génération du QR code...</p>
        </div>
      )}

      {step === "scanning" && (
        <div
          className="px-5 pb-5 pt-2"
          style={{ borderTop: "1px solid rgba(85,72,245,0.06)" }}
        >
          <div className="grid md:grid-cols-2 gap-6 mt-2">
            <div>
              <p className="text-xs font-semibold mb-3" style={{ color: "#6B6B8A" }}>
                1. Scanne ce QR code avec ton app
              </p>
              <div
                className="rounded-xl p-3 flex items-center justify-center"
                style={{ background: "white", border: "1.5px solid rgba(85,72,245,0.12)" }}
              >
                {qrUri ? (
                  <img src={qrUri} alt="QR Code 2FA" className="w-40 h-40" />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center">
                    <Loader2 className="size-6 animate-spin" style={{ color: "#5548F5" }} />
                  </div>
                )}
              </div>
              <p className="text-xs mt-2" style={{ color: "#9CA3AF" }}>
                Compatible : Google Authenticator, Authy, 1Password...
              </p>
            </div>

            
            <div>
              <p className="text-xs font-semibold mb-3" style={{ color: "#6B6B8A" }}>
                Ou saisis le code manuellement
              </p>
              <div
                className="rounded-xl p-3 flex items-center justify-between gap-2"
                style={{ background: "#F8F7FF", border: "1.5px solid rgba(85,72,245,0.12)" }}
              >
                <span
                  className="text-xs break-all"
                  style={{ color: "#5548F5", fontFamily: "monospace", letterSpacing: "0.05em" }}
                >
                  {secret}
                </span>
                <button
                  type="button"
                  onClick={copySecret}
                  className="shrink-0 transition-opacity hover:opacity-70"
                  style={{ color: "#5548F5" }}
                  title="Copier"
                >
                  {copied ? <CheckCheck className="size-4" /> : <Copy className="size-4" />}
                </button>
              </div>

              <form onSubmit={handleVerify} className="mt-4 space-y-3">
                <p className="text-xs font-semibold" style={{ color: "#6B6B8A" }}>
                  2. Entre le code généré par l'app
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000 000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full py-3 px-4 rounded-xl text-center text-lg outline-none tracking-widest font-semibold transition-all"
                  style={{
                    background: "white",
                    border: "1.5px solid rgba(85,72,245,0.15)",
                    color: "#0C0B1A",
                    fontFamily: "monospace",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#5548F5")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(85,72,245,0.15)")}
                />
                {error && (
                  <p className="text-xs" style={{ color: "#DC2626" }}>{error}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setStep("idle"); setCode(""); setError(null); }}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                    style={{ background: "#F3F4F6", color: "#6B6B8A" }}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={verifying || code.length !== 6}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #5548F5, #8B5CF6)" }}
                  >
                    {verifying ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                    {verifying ? "Vérification..." : "Activer la 2FA"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      
      {step === "active" && error && (
        <div
          className="mx-5 mb-4 p-3 rounded-xl text-sm flex items-center gap-2"
          style={{ background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}
        >
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}


export function SettingsPage() {
  useSEO({ title: "Paramètres - Cadova", noindex: true });
  const { user, loading, updateProfile } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!name.trim()) { setError("Le nom ne peut pas être vide"); return; }
    setSaving(true);
    try {
      const updates: { name?: string } = {};
      if (name.trim() !== user?.name) updates.name = name.trim();
      if (Object.keys(updates).length === 0) {
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        return;
      }
      const { error: updateError } = await updateProfile(updates);
      if (updateError) {
        setError(updateError.message);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  };

  const card = "rounded-3xl p-6 space-y-4 shadow-sm";
  const cardStyle = { border: "1px solid rgba(85,72,245,0.1)", background: "white" };
  const sectionTitle = "flex items-center gap-2.5 mb-4";

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="size-8 animate-spin" style={{ color: "#5548F5" }} />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto text-center py-20">
          <div
            className="size-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(85,72,245,0.08)" }}
          >
            <LogIn className="size-7" style={{ color: "#5548F5" }} />
          </div>
          <h2 className="font-extrabold mb-2" style={{ fontFamily: "Syne, sans-serif", fontSize: "1.5rem" }}>
            Connexion requise
          </h2>
          <p className="text-sm mb-6" style={{ color: "#6B6B8A" }}>
            Tu dois être connecté pour accéder à tes paramètres.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #5548F5, #8B5CF6)" }}
          >
            <LogIn className="size-4" /> Se connecter
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div
        className="max-w-4xl mx-auto"
        style={{ fontFamily: "DM Sans, system-ui, sans-serif" }}
      >
       
        <div className="mb-8">
          <h1
            className="font-extrabold mb-2"
            style={{ fontFamily: "Syne, sans-serif", fontSize: "clamp(2.3rem, 5vw, 4rem)", color: "#0C0B1A", letterSpacing: "-0.05em" }}
          >
            Paramètres
          </h1>
          <p className="text-sm" style={{ color: "#9CA3AF" }}>
            Gère ton profil, ta sécurité et tes préférences
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">

          
          <div className={card} style={cardStyle}>
            <div className={sectionTitle}>
              <div
                className="size-9 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(85,72,245,0.08)" }}
              >
                <User className="size-4" style={{ color: "#5548F5" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "#0C0B1A" }}>Profil</p>
                <p className="text-xs" style={{ color: "#9CA3AF" }}>Informations de ton compte</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex items-center gap-4">
                <div
                  className="size-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, #5548F5, #8B5CF6)" }}
                >
                  {name.charAt(0).toUpperCase() || "?"}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#0C0B1A" }}>{name || "-"}</p>
                  <p className="text-xs" style={{ color: "#9CA3AF" }}>{email}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6B6B8A" }}>
                  Nom complet
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ton nom complet"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: "white",
                    border: "1.5px solid rgba(85,72,245,0.12)",
                    color: "#0C0B1A",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#5548F5")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(85,72,245,0.12)")}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#6B6B8A" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl text-sm cursor-not-allowed"
                  style={{
                    background: "#F9F9F9",
                    border: "1.5px solid rgba(0,0,0,0.06)",
                    color: "#9CA3AF",
                  }}
                />
                <p className="text-xs mt-1" style={{ color: "#C4C4D4" }}>
                  L'email ne peut pas être modifié pour le moment
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl text-sm" style={{ background: "#FEF2F2", color: "#DC2626" }}>
                  {error}
                </div>
              )}
              {saved && (
                <div className="p-3 rounded-xl text-sm flex items-center gap-2" style={{ background: "#ECFDF5", color: "#059669" }}>
                  <Check className="size-4" /> Modifications enregistrées !
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #5548F5, #8B5CF6)" }}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </form>
          </div>

         
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <Shield className="size-4" style={{ color: "#5548F5" }} />
              <p className="text-sm font-semibold" style={{ color: "#0C0B1A" }}>Sécurité</p>
            </div>

            <div className="space-y-3">
              <ChangePasswordSection />
              <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-100">
                    <ShieldOff className="size-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#0C0B1A" }}>Double authentification</p>
                    <p className="text-xs leading-5" style={{ color: "#9CA3AF" }}>
                      Masquee jusqu'a ce que la verification au login soit entierement active.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={card} style={cardStyle}>
            <div className={sectionTitle}>
              <div className="size-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(85,72,245,0.08)" }}>
                <Bell className="size-4" style={{ color: "#5548F5" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "#0C0B1A" }}>Notifications</p>
                <p className="text-xs" style={{ color: "#9CA3AF" }}>Gère tes préférences d'alertes</p>
              </div>
            </div>
            {[
              { label: "Emails de mise à jour", desc: "Nouvelles fonctionnalités et annonces" },
              { label: "Rappels candidatures", desc: "Dates limites et relances automatiques" },
            ].map((n) => (
              <div key={n.label} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium" style={{ color: "#0C0B1A" }}>{n.label}</p>
                  <p className="text-xs" style={{ color: "#9CA3AF" }}>{n.desc}</p>
                </div>
                <div
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-all hover:opacity-80"
                  style={{ background: "rgba(85,72,245,0.08)", color: "#5548F5" }}
                >
                  Activé
                </div>
              </div>
            ))}
          </div>

         
          <div className={card} style={cardStyle}>
            <div className={sectionTitle}>
              <div className="size-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(85,72,245,0.08)" }}>
                <CreditCard className="size-4" style={{ color: "#5548F5" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "#0C0B1A" }}>Abonnement</p>
                <p className="text-xs" style={{ color: "#9CA3AF" }}>Plan actuel et facturation</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: "#0C0B1A" }}>
                  Plan {user.subscription === "premium" ? "Pro" : "Gratuit"}
                </p>
                <p className="text-xs" style={{ color: "#9CA3AF" }}>
                  {user.subscription === "premium"
                    ? "Accès illimité à tous les modules"
                    : "1 CV, 1 lettre, analyse ATS basique"}
                </p>
              </div>
              {user.subscription !== "premium" && (
                <button
                  className="text-xs font-bold px-3.5 py-2 rounded-xl text-white transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #5548F5, #8B5CF6)" }}
                >
                  Passer à Pro
                </button>
              )}
            </div>
          </div>


        </div>
      </div>
    </AppLayout>
  );
}
