import { useEffect, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { updatePassword } from "./api"
import { AuthShell } from "./AuthShell"
import { Button, Field, Input } from "@/components/ui"
import { humanizeError } from "@/lib/errors"

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  /* Supabase redirects here with #access_token&type=recovery in the URL hash.
     We wait for the PASSWORD_RECOVERY event to confirm the session is valid. */
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.")
      return
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.")
      return
    }
    setError("")
    setSubmitting(true)
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(() => navigate("/login", { replace: true }), 2500)
    } catch (err) {
      setError(humanizeError(err, "Impossible de mettre à jour le mot de passe."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Nouveau mot de passe"
      subtitle="Choisissez un mot de passe sécurisé pour votre compte Cadova."
      footer={null}
    >
      {done ? (
        <div className="rounded-[10px] bg-success-soft px-4 py-3 text-sm text-success">
          Mot de passe mis à jour. Redirection vers la connexion…
        </div>
      ) : !ready ? (
        <p className="text-sm text-muted">
          Vérification du lien de réinitialisation en cours…
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error && (
            <p
              role="alert"
              className="rounded-[10px] bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          )}
          <Field label="Nouveau mot de passe" htmlFor="password" required>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Confirmer le mot de passe" htmlFor="confirm" required>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={submitting} className="mt-2 w-full">
            Mettre à jour le mot de passe
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
