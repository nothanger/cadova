import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { MailCheck } from "lucide-react"
import { AuthShell } from "./AuthShell"
import { signUp } from "./api"
import { Button, Field, Input } from "@/components/ui"
import { humanizeError } from "@/lib/errors"

export function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [accountExists, setAccountExists] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirm, setConfirm] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError("")
    setAccountExists(false)
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.")
      return
    }
    setSubmitting(true)
    try {
      const { status } = await signUp(email.trim(), password)
      if (status === "account_exists") {
        setAccountExists(true)
      } else if (status === "confirmation_required") {
        setConfirm(true)
      } else {
        navigate("/onboarding", { replace: true })
      }
    } catch (err) {
      setError(humanizeError(err, "Inscription impossible."))
    } finally {
      setSubmitting(false)
    }
  }

  if (confirm) {
    return (
      <AuthShell
        title="Vérifiez votre email"
        subtitle="Une dernière étape avant de commencer."
        footer={
          <Link to="/login" className="font-medium text-primary hover:underline">
            Retour à la connexion
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <MailCheck size={22} />
          </div>
          <p className="text-sm text-ink-soft">
            Nous avons envoyé un lien de confirmation à <strong>{email}</strong>.
            Cliquez sur ce lien puis connectez-vous.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Créez votre espace pour suivre vos clients et vos devis."
      footer={
        <>
          Déjà un compte ?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {(error || accountExists) && (
          <p
            role="alert"
            className="rounded-[10px] bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {accountExists ? (
              <>
                Un compte existe déjà avec cette adresse.{" "}
                <Link
                  to="/login"
                  state={{ email: email.trim() }}
                  className="font-medium underline underline-offset-2 hover:decoration-2"
                >
                  Se connecter ici
                </Link>
                .
              </>
            ) : (
              error
            )}
          </p>
        )}
        <Field label="Email" htmlFor="email" required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            disabled={submitting}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setAccountExists(false)
            }}
          />
        </Field>
        <Field
          label="Mot de passe"
          htmlFor="password"
          required
          hint="Au moins 6 caractères."
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            disabled={submitting}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" loading={submitting} className="mt-2 w-full">
          Créer mon compte
        </Button>
        <p className="-mt-1 text-center text-xs leading-5 text-muted">
          En créant un compte, vous acceptez les{" "}
          <Link to="/terms" className="font-medium text-primary hover:underline">
            conditions d’utilisation
          </Link>{" "}
          et reconnaissez avoir lu notre{" "}
          <Link to="/privacy" className="font-medium text-primary hover:underline">
            politique de confidentialité
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  )
}
