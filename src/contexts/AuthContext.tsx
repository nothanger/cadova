import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { supabase, API_URL } from "@/lib/supabase";
import { publicAnonKey } from "/utils/supabase/info";

// ===============================================
// Types
// ===============================================

interface UserProfile {
  id: string;
  email: string;
  name: string;
  subscription: "free" | "premium";
  credits: {
    cv: number;
    coverLetter: number;
    atsAnalysis: number;
    interview: number;
  };
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  accessToken: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<UserProfile, "name" | "email">>) => Promise<{ error: Error | null }>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<{ error: Error | null }>;
  sendPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  resetPassword: (newPassword: string) => Promise<{ error: Error | null }>;
  enrollTotp: () => Promise<{ qrUri: string; secret: string; factorId: string; error: Error | null }>;
  verifyTotp: (factorId: string, code: string) => Promise<{ error: Error | null }>;
  unenrollTotp: (factorId: string) => Promise<{ error: Error | null }>;
  getMfaFactors: () => Promise<{ factors: any[]; error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ===============================================
// Cache helpers (sessionStorage)
// ===============================================
const CACHE_KEY = "cadova_user_cache";
const CACHE_TOKEN_KEY = "cadova_token_cache";

function getCachedUser(): UserProfile | null {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  return null;
}

function setCachedUser(user: UserProfile | null) {
  try {
    if (user) {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(CACHE_KEY);
    }
  } catch {}
}

// ===============================================
// AuthProvider
// ===============================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Restore cached user instantly — no blank screen on reload
  const [user, setUser] = useState<UserProfile | null>(getCachedUser);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  // If we have a cached user, skip the loading state entirely
  const [loading, setLoading] = useState(!getCachedUser());
  const initDone = useRef(false);
  // Track if signIn just happened to avoid double fetchProfile
  const justSignedIn = useRef(false);

  const updateUser = useCallback((u: UserProfile | null) => {
    setUser(u);
    setCachedUser(u);
  }, []);

  // Construit le profil utilisateur UNIQUEMENT depuis Supabase Auth.
  // On n'appelle plus l'Edge Function /user/profile qui renvoie 401
  // car elle nécessite un backend custom non configuré ici.
  // Supabase Auth contient toutes les données nécessaires (id, email, metadata).
  const buildUserFromSession = useCallback(async (token: string) => {
    try {
      const { data: authData } = await supabase.auth.getUser(token);
      if (authData?.user) {
        updateUser({
          id: authData.user.id,
          email: authData.user.email || "",
          name: authData.user.user_metadata?.name || "Utilisateur",
          subscription: authData.user.user_metadata?.subscription || "free",
          credits: authData.user.user_metadata?.credits || {
            cv: 1, coverLetter: 0, atsAnalysis: 0, interview: 0,
          },
        });
      }
    } catch {
      // Silencieux — on garde l'état courant
    }
  }, [updateUser]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          setAccessToken(session.access_token);

          if (event === "SIGNED_IN") {
            // Si signIn() a déjà positionné le user via updateUser(),
            // on ne refait pas un appel réseau inutile.
            if (justSignedIn.current) {
              justSignedIn.current = false;
              // Rafraîchissement silencieux en arrière-plan pour sync les metadata
              buildUserFromSession(session.access_token);
            } else {
              buildUserFromSession(session.access_token);
            }
          }

          if (event === "INITIAL_SESSION") {
            if (getCachedUser()) {
              // Cache présent → UI instantanée, refresh en arrière-plan
              buildUserFromSession(session.access_token);
            } else {
              // Pas de cache → on attend le profil avant d'afficher
              buildUserFromSession(session.access_token).then(() => {
                if (!initDone.current) {
                  initDone.current = true;
                  setLoading(false);
                }
              });
              return;
            }
          }

          if (event === "TOKEN_REFRESHED") {
            buildUserFromSession(session.access_token);
          }
        } else {
          updateUser(null);
          setAccessToken(null);
        }

        if (!initDone.current) {
          initDone.current = true;
          setLoading(false);
        }
      }
    );

    const timeout = setTimeout(() => {
      if (!initDone.current) {
        initDone.current = true;
        setLoading(false);
      }
    }, 2000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [buildUserFromSession, updateUser]);

  // =============================================
  // Sign In — FAST: sets user instantly from Supabase metadata
  // =============================================
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: new Error(error.message) };
      }

      if (data.session) {
        // Mark that we just signed in — so onAuthStateChange won't block
        justSignedIn.current = true;
        setAccessToken(data.session.access_token);

        // Set user INSTANTLY from Supabase metadata — no server call needed
        const metaName = data.user.user_metadata?.name;
        // Fallback: use part before @ in email if no name in metadata
        const displayName = metaName || email.split("@")[0] || "Utilisateur";
        updateUser({
          id: data.user.id,
          email: data.user.email || email,
          name: displayName,
          subscription: "free",
          credits: { cv: 1, coverLetter: 0, atsAnalysis: 0, interview: 0 },
        });
        // Full profile (credits, subscription) loads in background via onAuthStateChange
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  // =============================================
  // Sign Up — FAST: sets user instantly
  // =============================================
  const signUp = async (email: string, password: string, name: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ email, password, name }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        return { error: new Error(result.error || "Erreur lors de l'inscription") };
      }

      // Auto-login after signup
      justSignedIn.current = true;
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        return { error: new Error(signInError.message) };
      }

      if (data.session) {
        setAccessToken(data.session.access_token);
        updateUser({
          id: data.user.id,
          email: data.user.email || email,
          name: name,
          subscription: "free",
          credits: { cv: 1, coverLetter: 0, atsAnalysis: 0, interview: 0 },
        });
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  // =============================================
  // Sign Out — sécurisé et sans race condition
  // =============================================
  const signOut = async () => {
    // On purge d'abord le state React et le cache local,
    // AVANT l'appel réseau — ça évite les race conditions
    // où onAuthStateChange reçoit des événements dans le mauvais ordre.
    updateUser(null);
    setAccessToken(null);
    try {
      sessionStorage.clear();
    } catch {}

    try {
      // scope: "local" (défaut) = nettoie la session locale + invalide
      // le refresh token côté serveur pour CETTE session uniquement.
      //
      // NE PAS utiliser scope: "global" ici : cela révoque tous les tokens
      // serveur et déclenche un événement SIGNED_OUT asynchrone qui peut
      // arriver APRÈS un nouveau SIGNED_IN si l'utilisateur se reconnecte
      // rapidement, causant une déconnexion involontaire.
      await supabase.auth.signOut();
    } catch (err) {
      console.error("❌ Erreur sign out Supabase:", err);
    }
  };

  // =============================================
  // Update Profile — via Supabase Auth user_metadata uniquement
  // (pas d'Edge Function custom pour éviter les 401)
  // =============================================
  const updateProfile = async (updates: Partial<Pick<UserProfile, "name" | "email">>) => {
    try {
      if (!user) return { error: new Error("Non connecté") };

      // Met à jour user_metadata dans Supabase Auth
      const { error } = await supabase.auth.updateUser({
        data: {
          ...(updates.name ? { name: updates.name } : {}),
        },
      });

      if (error) return { error: new Error(error.message) };

      // Mise à jour immédiate du state local + cache
      updateUser({ ...user, ...updates });
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  // =============================================
  // Update Password (utilisateur déjà connecté)
  // =============================================
  const updatePassword = async (_currentPassword: string, newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  // =============================================
  // Envoyer un email de réinitialisation
  // =============================================
  const sendPasswordReset = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  // =============================================
  // Réinitialiser le mot de passe (depuis le lien email)
  // =============================================
  const resetPassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  // =============================================
  // Enroll TOTP — retourne QR code SVG + secret
  // API: supabase.auth.mfa.enroll({ factorType: 'totp' })
  // Response: { data: { id, totp: { qr_code, secret, uri } } }
  // =============================================
  const enrollTotp = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) return { qrUri: "", secret: "", factorId: "", error: new Error(error.message) };
      const totp = (data as any).totp;
      return {
        qrUri: totp.qr_code,   // déjà en data:image/svg+xml
        secret: totp.secret,
        factorId: data.id,
        error: null,
      };
    } catch (err) {
      return { qrUri: "", secret: "", factorId: "", error: err as Error };
    }
  };

  // =============================================
  // Vérifier et activer TOTP
  // API: supabase.auth.mfa.challengeAndVerify({ factorId, code })
  // =============================================
  const verifyTotp = async (factorId: string, code: string) => {
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  // =============================================
  // Désactiver TOTP
  // =============================================
  const unenrollTotp = async (factorId: string) => {
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  // =============================================
  // Lister les facteurs MFA actifs
  // =============================================
  const getMfaFactors = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return { factors: [], error: new Error(error.message) };
      return { factors: data as any[], error: null };
    } catch (err) {
      return { factors: [], error: err as Error };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, accessToken, signIn, signUp, signOut, updateProfile, updatePassword, sendPasswordReset, resetPassword, enrollTotp, verifyTotp, unenrollTotp, getMfaFactors }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}