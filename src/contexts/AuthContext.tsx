import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { supabase, API_URL } from "@/lib/supabase";
import { getStoredSubscription, type BillingInterval, type SubscriptionPlan } from "@/app/lib/payment-service";



interface UserProfile {
  id: string;
  email: string;
  name: string;
  plan?: "free" | "pro";
  free_generation_used?: boolean;
  subscription: SubscriptionPlan;
  billingInterval?: BillingInterval;
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
  upgradeToPro: (billing: BillingInterval) => Promise<{ error: Error | null }>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<{ error: Error | null }>;
  sendPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  resetPassword: (newPassword: string) => Promise<{ error: Error | null }>;
  deleteAccount: () => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<UserProfile | null>;
  enrollTotp: () => Promise<{ qrUri: string; secret: string; factorId: string; error: Error | null }>;
  verifyTotp: (factorId: string, code: string) => Promise<{ error: Error | null }>;
  unenrollTotp: (factorId: string) => Promise<{ error: Error | null }>;
  getMfaFactors: () => Promise<{ factors: any[]; error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);


const CACHE_KEY = "cadova_user_cache";

function normalizeProfile(profile: any, fallback?: Partial<UserProfile>): UserProfile {
  const plan = profile?.plan || (profile?.subscription === "premium" ? "pro" : profile?.subscription) || fallback?.plan || fallback?.subscription || "free";
  const freeGenerationUsed = profile?.free_generation_used === true || fallback?.free_generation_used === true;

  return {
    id: profile?.id || fallback?.id || "",
    email: profile?.email || fallback?.email || "",
    name: profile?.name || fallback?.name || "Utilisateur",
    plan: plan === "pro" ? "pro" : "free",
    subscription: plan === "pro" ? "pro" : "free",
    billingInterval: profile?.billingInterval || fallback?.billingInterval,
    free_generation_used: freeGenerationUsed,
    credits: profile?.credits || fallback?.credits || {
      cv: freeGenerationUsed ? 0 : 1,
      coverLetter: 0,
      atsAnalysis: 0,
      interview: 0,
    },
  };
}

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



export function AuthProvider({ children }: { children: React.ReactNode }) {
  
  const [user, setUser] = useState<UserProfile | null>(getCachedUser);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(!getCachedUser());
  const initDone = useRef(false);

  const justSignedIn = useRef(false);

  const updateUser = useCallback((u: UserProfile | null) => {
    setUser(u);
    setCachedUser(u);
  }, []);


  const fetchServerProfile = useCallback(async (token: string, fallback?: Partial<UserProfile>) => {
    const response = await fetch(`${API_URL}/user/profile`, {
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error("Profile fetch failed");
    const data = await response.json();
    const profile = normalizeProfile(data.profile, fallback);
    updateUser(profile);
    return profile;
  }, [updateUser]);

  const buildUserFromSession = useCallback(async (token: string) => {
    try {
      const { data: authData } = await supabase.auth.getUser(token);
      if (authData?.user) {
        const storedSubscription = getStoredSubscription(authData.user.id);
        await fetchServerProfile(token, {
          id: authData.user.id,
          email: authData.user.email || "",
          name: authData.user.user_metadata?.name || "Utilisateur",
          subscription: storedSubscription?.plan || authData.user.user_metadata?.subscription || "free",
          billingInterval: storedSubscription?.billing || authData.user.user_metadata?.billingInterval,
          credits: authData.user.user_metadata?.credits || {
            cv: 1, coverLetter: 0, atsAnalysis: 0, interview: 0,
          },
        });
      }
    } catch {
      try {
        const { data: authData } = await supabase.auth.getUser(token);
        if (authData?.user) {
          const storedSubscription = getStoredSubscription(authData.user.id);
          updateUser(normalizeProfile(null, {
            id: authData.user.id,
            email: authData.user.email || "",
            name: authData.user.user_metadata?.name || "Utilisateur",
            subscription: storedSubscription?.plan || authData.user.user_metadata?.subscription || "free",
            billingInterval: storedSubscription?.billing || authData.user.user_metadata?.billingInterval,
          }));
        }
      } catch {}
    }
  }, [fetchServerProfile, updateUser]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          setAccessToken(session.access_token);

          if (event === "SIGNED_IN") {
          
            if (justSignedIn.current) {
              justSignedIn.current = false;
              
              buildUserFromSession(session.access_token);
            } else {
              buildUserFromSession(session.access_token);
            }
          }

          if (event === "INITIAL_SESSION") {
            if (getCachedUser()) {
             
              buildUserFromSession(session.access_token);
            } else {
              
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
       
        justSignedIn.current = true;
        setAccessToken(data.session.access_token);

        const metaName = data.user.user_metadata?.name;
        const storedSubscription = getStoredSubscription(data.user.id);
       
        const displayName = metaName || email.split("@")[0] || "Utilisateur";
        updateUser({
          id: data.user.id,
          email: data.user.email || email,
          name: displayName,
          subscription: storedSubscription?.plan || data.user.user_metadata?.subscription || "free",
          billingInterval: storedSubscription?.billing || data.user.user_metadata?.billingInterval,
          credits: { cv: 1, coverLetter: 0, atsAnalysis: 0, interview: 0 },
        });
       
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };


  const signUp = async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: { name },
        },
      });

      if (error) {
        return { error: new Error(error.message) };
      }

      if (data.session && data.user) {
        justSignedIn.current = true;
        setAccessToken(data.session.access_token);
        updateUser({
          id: data.user.id,
          email: data.user.email || email,
          name: name,
          subscription: "free",
          billingInterval: undefined,
          credits: { cv: 1, coverLetter: 0, atsAnalysis: 0, interview: 0 },
        });
      } else {
        updateUser(null);
        setAccessToken(null);
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };


  const signOut = async () => {
   
    updateUser(null);
    setAccessToken(null);
    try {
      sessionStorage.clear();
    } catch {}

    try {

      await supabase.auth.signOut();
    } catch (err) {
      console.error("❌ Erreur sign out Supabase:", err);
    }
  };

 
  const updateProfile = async (updates: Partial<Pick<UserProfile, "name" | "email">>) => {
    try {
      if (!user) return { error: new Error("Non connecté") };

      const { error } = await supabase.auth.updateUser({
        data: {
          ...(updates.name ? { name: updates.name } : {}),
        },
      });

      if (error) return { error: new Error(error.message) };
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || accessToken;

      if (token) {
        try {
          const response = await fetch(`${API_URL}/user/profile`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json; charset=UTF-8",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(updates),
          });
          const result = await response.json().catch(() => ({}));
          if (response.ok && result.profile) {
            updateUser(normalizeProfile(result.profile, user));
          } else {
            updateUser({ ...user, ...updates });
          }
        } catch {
          updateUser({ ...user, ...updates });
        }
      } else {
        updateUser({ ...user, ...updates });
      }
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const upgradeToPro = async (billing: BillingInterval) => {
    try {
      if (!user) return { error: new Error("Non connecté") };

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || accessToken;

      if (token) {
        const response = await fetch(`${API_URL}/billing/activate-pro`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ billingInterval: billing }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.error) {
          return { error: new Error(result.error || "Activation Pro impossible") };
        }
        updateUser(normalizeProfile(result.profile, user));
        return { error: null };
      }

      updateUser({
        ...user,
        plan: "pro",
        subscription: "pro",
        billingInterval: billing,
        credits: {
          cv: 999,
          coverLetter: 999,
          atsAnalysis: 999,
          interview: 999,
        },
      });

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const refreshProfile = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || accessToken;
    if (!token) return null;
    try {
      return await fetchServerProfile(token, user || undefined);
    } catch {
      return user;
    }
  };


  const updatePassword = async (_currentPassword: string, newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

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

  
  const resetPassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const deleteAccount = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || accessToken;

      if (!token) {
        return { error: new Error("Session expiree. Reconnecte-toi avant de supprimer ton compte.") };
      }

      const res = await fetch(`${API_URL}/user/delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.error) {
        return { error: new Error(result.error || "Suppression impossible pour le moment.") };
      }
      await signOut();
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };


  const enrollTotp = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) return { qrUri: "", secret: "", factorId: "", error: new Error(error.message) };
      const totp = (data as any).totp;
      return {
        qrUri: totp.qr_code,  
        secret: totp.secret,
        factorId: data.id,
        error: null,
      };
    } catch (err) {
      return { qrUri: "", secret: "", factorId: "", error: err as Error };
    }
  };


  const verifyTotp = async (factorId: string, code: string) => {
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };


  const unenrollTotp = async (factorId: string) => {
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

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
    <AuthContext.Provider value={{ user, loading, accessToken, signIn, signUp, signOut, updateProfile, upgradeToPro, updatePassword, sendPasswordReset, resetPassword, deleteAccount, refreshProfile, enrollTotp, verifyTotp, unenrollTotp, getMfaFactors }}>
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
