import { supabase } from "@/lib/supabase"
import { isExistingAccountError } from "@/lib/errors"

/** Sign up with email + password. Supabase may require email confirmation. */
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
    },
  })
  if (error) {
    if (isExistingAccountError(error)) return { status: "account_exists" } as const
    throw error
  }
  // With confirmation enabled, Supabase can mask an existing account as a
  // successful signup with no identities. Invited accounts can do the same.
  if (
    !data.session &&
    data.user &&
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0
  ) {
    return { status: "account_exists" } as const
  }
  // New accounts and existing accounts awaiting confirmation share this flow.
  return {
    status: data.session ? "signed_in" : "confirmation_required",
  } as const
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
