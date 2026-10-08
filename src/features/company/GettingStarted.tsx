import { useState } from "react"
import { Check, Circle, ArrowRight, ChevronDown } from "lucide-react"
import { Link } from "react-router-dom"
import { Button, Card } from "@/components/ui"
import type { DashboardData } from "@/features/dashboard/api"

export function GettingStarted({
  userId,
  companyId,
  canEditCompany,
  data,
}: {
  userId: string
  companyId: string
  canEditCompany: boolean
  data: DashboardData
}) {
  const storageKey = `cadova.getting-started.${userId}.${companyId}`
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "hidden"
    } catch {
      return false
    }
  })
  const { firstQuote, replyTo, trackingChosen } = data.gettingStarted
  const firstSendNeedsReview = data.actions.some(
    (action) => action.quoteId === firstQuote?.id && action.kind === "delivery",
  )
  const steps = [
    {
      title: "Créer votre espace",
      detail: "Votre entreprise est enregistrée.",
      done: true,
      available: true,
      to: "/app/settings#entreprise",
      action: "Voir les paramètres",
    },
    {
      title: "Choisir votre adresse de réponse",
      detail: canEditCompany
        ? "Les réponses de vos clients arriveront à cette adresse."
        : "Le propriétaire de l’entreprise renseigne l’adresse qui recevra les réponses des clients.",
      done: Boolean(replyTo),
      available: data.reads.settings === "available",
      to: "/app/settings#company-email",
      action: canEditCompany ? "Renseigner l’adresse" : "Voir les coordonnées",
    },
    {
      title: "Ajouter votre premier devis",
      detail:
        "Importez un PDF ou une photo, puis vérifiez les informations. Vous pouvez aussi le saisir.",
      done: Boolean(firstQuote),
      available: true,
      to: "/app/quotes/new",
      action: "Importer un devis",
    },
    {
      title: "Choisir le suivi",
      detail: firstSendNeedsReview
        ? "Vérifiez d’abord le résultat de l’envoi dans le dossier avant de choisir la suite."
        : firstQuote?.status === "draft"
          ? "Envoyez le devis ou indiquez qu’il est déjà envoyé, puis choisissez une date de rappel ou les relances automatiques."
          : "Dans le dossier, choisissez une date de rappel ou activez les relances automatiques après vérification.",
      done: trackingChosen,
      available:
        trackingChosen ||
        (data.reads.automation === "available" && data.reads.sendJobs === "available"),
      to: firstQuote ? `/app/quotes/${firstQuote.id}` : "/app/quotes/new",
      action: firstSendNeedsReview
        ? "Vérifier l’envoi du premier devis"
        : firstQuote?.status === "draft"
          ? "Ouvrir le premier devis"
          : "Choisir le suivi",
    },
  ]
  if (steps.every((step) => step.done && step.available)) return null
  function setVisibility(next: boolean) {
    setHidden(next)
    try {
      if (next) localStorage.setItem(storageKey, "hidden")
      else localStorage.removeItem(storageKey)
    } catch {
      /* The preference still works for this page. */
    }
  }
  if (hidden)
    return (
      <div className="mb-6">
        <Button variant="ghost" onClick={() => setVisibility(false)}>
          Afficher le guide de démarrage
        </Button>
      </div>
    )
  const nextStep = steps.findIndex((step) => !step.done || !step.available)
  const next = steps[nextStep]
  const completed = steps.filter((step) => step.done && step.available).length
  return (
    <Card className="mb-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Vos premières étapes</h2>
          <p className="mt-1 text-sm text-muted">
            {completed} étapes terminées sur {steps.length}.
          </p>
        </div>
        <Button variant="ghost" onClick={() => setVisibility(true)} className="text-sm">
          Masquer le guide
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4 rounded-lg bg-background p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{next.title}</p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            {next.available
              ? next.detail
              : "Cette étape ne peut pas être vérifiée pour le moment. Réessayez le chargement de votre espace."}
          </p>
          {next.available && (
            <Link
              to={next.to}
              className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              {next.action}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
      <details className="group/start mt-4">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-medium text-ink-soft">
          Voir les étapes du démarrage
          <ChevronDown
            size={17}
            aria-hidden="true"
            className="shrink-0 transition-transform group-open/start:rotate-180"
          />
        </summary>
        <ol className="mt-3 grid gap-3 lg:grid-cols-2">
          {steps.map((step) => (
            <li
              key={step.title}
              className="flex min-w-0 items-start gap-3 rounded-lg border border-line p-4"
            >
              <span
                className={`mt-0.5 shrink-0 ${step.done && step.available ? "text-success" : "text-muted"}`}
                aria-hidden="true"
              >
                {step.done && step.available ? (
                  <Check size={19} />
                ) : (
                  <Circle size={19} />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {step.title}
                  <span className="sr-only">
                    {step.done && step.available
                      ? ", terminé"
                      : step.available
                        ? ", à faire"
                        : ", à vérifier"}
                  </span>
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {!step.available
                    ? "Cette étape ne peut pas être vérifiée pour le moment. Réessayez le chargement du tableau de bord."
                    : step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </details>
      <Link
        to="/notifications?view=messages"
        className="mt-1 inline-flex min-h-11 items-center text-sm text-muted underline underline-offset-4 hover:text-primary"
      >
        Besoin d’aide ? Contacter Cadova
      </Link>
    </Card>
  )
}
