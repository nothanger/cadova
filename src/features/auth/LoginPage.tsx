import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AuthShell } from "./AuthShell"
import { signIn } from "./api"
import { Button, Field, Input } from "@/components/ui"
import { humanizeError } from "@/lib/errors"

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError("")
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
      // The router redirects based on session + company membership.
      navigate("/app", { replace: true })
    } catch (err) {
      setError(humanizeError(err, "Connexion impossible."))
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Connexion"
      subtitle="Accédez à votre espace Cadova FollowUp."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link
            to="/signup"
            className="font-medium text-primary hover:underline"
          >
            Créer un compte
          </Link>
        </>
      }
    >
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
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-ink">
              Mot de passe <span className="text-danger">*</span>
            </label>
            <Link
              to="/forgot-password"
              className="text-xs text-primary hover:underline"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" loading={submitting} className="mt-2 w-full">
          Se connecter
        </Button>
      </form>
    </AuthShell>
  )
}
