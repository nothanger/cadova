import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { AuthShell } from "./AuthShell"
import { resetPassword } from "./api"
import { Button, Field, Input } from "@/components/ui"
import { humanizeError } from "@/lib/errors"

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError("")
    setSubmitting(true)
    try {
      await resetPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(humanizeError(err, "Impossible d'envoyer le lien de réinitialisation."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Mot de passe oublié"
      subtitle="Recevez un lien pour choisir un nouveau mot de passe."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-[10px] bg-success-soft px-4 py-3 text-sm text-success">
          Un email de réinitialisation a été envoyé à <strong>{email}</strong>. Vérifiez
          votre boîte de réception et cliquez sur le lien.
        </div>
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
          <Field label="Email" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={submitting} className="mt-2 w-full">
            Envoyer le lien
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
