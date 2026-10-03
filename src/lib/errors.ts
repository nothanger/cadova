import type { PostgrestError } from "@supabase/supabase-js"

/**
 * Turn a raw Supabase/Postgres error into a human, French message. The raw
 * error is still logged for developers; the user never sees "PGRST116".
 */
export function humanizeError(
  err: unknown,
  fallback = "Une erreur est survenue.",
): string {
  if (err && typeof err === "object" && "message" in err) {
    const e = err as PostgrestError
    const code = e.code ?? ""
    const msg = e.message ?? ""

    if (code === "23505" || /duplicate key/i.test(msg)) {
      return "Cette référence de devis existe déjà pour votre entreprise."
    }
    if (code === "23514" || /check constraint/i.test(msg)) {
      return "Les données saisies ne respectent pas les règles attendues."
    }
    if (code === "23503" || /foreign key/i.test(msg)) {
      return "Le client sélectionné est introuvable ou n’appartient pas à votre entreprise."
    }
    if (/row-level security|not authorized|permission denied/i.test(msg)) {
      return "Vous n’avez pas l’autorisation d’effectuer cette action."
    }
    if (/invalid login credentials/i.test(msg)) {
      return "Email ou mot de passe incorrect."
    }
    if (/user already registered/i.test(msg)) {
      return "Un compte existe déjà avec cet email."
    }
    if (/email not confirmed/i.test(msg)) {
      return "Veuillez confirmer votre adresse email avant de vous connecter."
    }
    if (/email rate limit exceeded/i.test(msg)) {
      return "Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer."
    }
  }
  console.error("[Cadova] error:", err)
  return fallback
}
