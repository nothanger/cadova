import { useEffect, useState, type MouseEvent } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, FileText, Menu, ShieldCheck, Users, X } from "lucide-react"
import { CadovaLogo } from "@/components/CadovaLogo"
import { LinkButton } from "@/components/ui"
import { usePageTitle } from "@/lib/usePageTitle"
import { useAuth } from "@/features/auth/AuthContext"

const navItems = [
  { label: "Le produit", id: "produit" },
  { label: "Au quotidien", id: "fonctionnement" },
  { label: "Votre espace", id: "securite" },
]

export function LandingPage() {
  usePageTitle("Clients, devis et relances")
  const { session, loading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const destination = !loading && session ? "/app" : "/signup"
  const action = session ? "Ouvrir mon espace" : "Créer mon espace"

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false)
        document.getElementById("landing-menu-button")?.focus()
      }
    }
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [])

  function scrollToSection(id: string, event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    setMenuOpen(false)
    const section = document.getElementById(id)
    section?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    })
    section?.focus({ preventScroll: true })
  }

  return (
    <div className="min-h-screen bg-background text-ink">
      <a href="#contenu" className="skip-link">
        Aller au contenu
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <nav
          aria-label="Navigation principale"
          className="page-container flex h-[72px] items-center justify-between gap-4"
        >
          <Link to="/" aria-label="Cadova, accueil">
            <CadovaLogo className="h-7" />
          </Link>
          <div className="hidden items-center gap-7 lg:flex">
            {navItems.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => scrollToSection(id, e)}
                className="py-3 text-sm text-ink-soft transition-colors hover:text-primary"
              >
                {label}
              </a>
            ))}
          </div>
          <div className="hidden items-center gap-3 lg:flex">
            {!session && (
              <LinkButton to="/login" variant="ghost">
                Se connecter
              </LinkButton>
            )}
            <LinkButton to={destination}>{action}</LinkButton>
          </div>
          <button
            id="landing-menu-button"
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOpen}
            aria-controls="landing-menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-background lg:hidden"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </nav>
        {menuOpen && (
          <nav
            id="landing-menu"
            aria-label="Navigation mobile"
            className="page-container border-t border-line py-4 lg:hidden"
          >
            {navItems.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => scrollToSection(id, e)}
                className="block rounded-lg px-3 py-3 text-sm hover:bg-background"
              >
                {label}
              </a>
            ))}
            <div className="mt-3 grid gap-2 border-t border-line pt-4">
              {!session && (
                <LinkButton
                  to="/login"
                  variant="secondary"
                  onClick={() => setMenuOpen(false)}
                >
                  Se connecter
                </LinkButton>
              )}
              <LinkButton to={destination} onClick={() => setMenuOpen(false)}>
                {action}
              </LinkButton>
            </div>
          </nav>
        )}
      </header>

      <main id="contenu" tabIndex={-1}>
        <section
          id="produit"
          tabIndex={-1}
          className="page-container grid items-center gap-12 py-14 lg:grid-cols-[.9fr_1.1fr] lg:gap-16 lg:py-24"
        >
          <div className="max-w-xl">
            <p className="section-kicker">Clients, devis et relances</p>
            <h1 className="mt-5 text-[clamp(2.35rem,4vw,3rem)] font-semibold leading-[1.08] tracking-[-.045em]">
              Vos devis envoyés.
              <br />
              <span className="text-primary">La suite, au clair.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-ink-soft">
              Retrouvez les devis en attente, préparez vos relances et gardez une trace
              de vos échanges avec chaque client.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton to={destination}>
                {action}
                <ArrowRight size={16} aria-hidden="true" />
              </LinkButton>
              <a
                href="#fonctionnement"
                onClick={(e) => scrollToSection("fonctionnement", e)}
                className="ui-button border border-line-strong bg-surface text-ink hover:bg-primary-soft"
              >
                Voir le fonctionnement
              </a>
            </div>
            <p className="mt-5 text-sm text-muted">
              Pour les artisans, indépendants et petites entreprises.
            </p>
          </div>
          <ProductPreview />
        </section>

        <section
          id="fonctionnement"
          tabIndex={-1}
          className="border-y border-line bg-surface py-14 lg:py-20"
        >
          <div className="page-container">
            <div className="max-w-2xl">
              <p className="section-kicker">Au quotidien</p>
              <h2 className="section-title mt-4">
                Un dossier client.
                <br />
                Un suivi facile à retrouver.
              </h2>
            </div>
            <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
              <Step
                number="01"
                title="Rassemblez vos clients"
                text="Coordonnées, notes et devis associés restent dans une même fiche."
              />
              <Step
                number="02"
                title="Suivez vos devis"
                text="Enregistrez la référence, le montant et la date d’envoi. Mettez à jour le statut quand votre client répond."
              />
              <Step
                number="03"
                title="Préparez la prochaine action"
                text="Retrouvez les devis à relancer, préparez un message et notez vos échanges."
              />
            </div>
          </div>
        </section>

        <section
          id="securite"
          tabIndex={-1}
          className="bg-ink py-14 text-white lg:py-20"
        >
          <div className="page-container grid gap-10 lg:grid-cols-2 lg:gap-20">
            <div>
              <ShieldCheck size={28} className="text-[#b5d3bf]" aria-hidden="true" />
              <h2 className="section-title mt-5">
                Un espace pour
                <br />
                votre entreprise.
              </h2>
              <p className="mt-5 max-w-md leading-7 text-[#c4d0c9]">
                Vos informations commerciales restent dans votre espace. Vous choisissez
                les actions et gardez la main sur la relation client.
              </p>
            </div>
            <div className="divide-y divide-white/15">
              <Trust
                number="01"
                title="Espace privé"
                text="Vos clients et vos devis ne sont pas accessibles au public."
              />
              <Trust
                number="02"
                title="Entreprises séparées"
                text="Les données sont rattachées à votre entreprise et les accès sont contrôlés."
              />
              <Trust
                number="03"
                title="Relances sous votre contrôle"
                text="Préparez votre message, puis copiez-le ou ouvrez votre messagerie pour l’envoyer."
              />
            </div>
          </div>
        </section>

        <section className="page-container flex flex-col items-start justify-between gap-6 py-12 sm:flex-row sm:items-center lg:py-16">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Commencez par votre premier client.
            </h2>
            <p className="mt-2 text-sm text-muted">
              Créez votre espace, puis ajoutez les devis que vous souhaitez suivre.
            </p>
          </div>
          <LinkButton to={destination} className="shrink-0">
            {action}
            <ArrowRight size={16} aria-hidden="true" />
          </LinkButton>
        </section>
      </main>
      <Footer />
    </div>
  )
}

function ProductPreview() {
  return (
    <figure className="min-w-0">
      <div className="overflow-hidden rounded-xl border border-line-strong bg-surface shadow-[0_12px_32px_rgba(24,39,37,.06)]">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <span className="text-sm font-semibold">Votre espace Cadova</span>
          <span className="rounded-md bg-background px-2 py-1 text-xs text-muted">
            Aperçu
          </span>
        </div>
        <div className="flex">
          <div className="hidden w-32 shrink-0 space-y-2 border-r border-line bg-[#fafbf7] p-3 sm:block">
            <p className="rounded-md px-2 py-2 text-xs text-muted">Tableau de bord</p>
            <p className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-muted">
              <Users size={14} />
              Clients
            </p>
            <p className="flex items-center gap-2 rounded-md bg-primary-soft px-2 py-2 text-xs font-semibold text-primary">
              <FileText size={14} />
              Devis
            </p>
          </div>
          <div className="min-w-0 flex-1 p-5 sm:p-6">
            <h2 className="text-xl font-semibold tracking-tight">Devis</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Le suivi de vos échanges commerciaux.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-primary-soft px-3 py-2 font-semibold text-primary">
                Tous
              </span>
              <span className="px-2 py-2 text-muted">À relancer</span>
              <span className="px-2 py-2 text-muted">Acceptés</span>
            </div>
            <div className="mt-4 border-y border-line">
              <div className="grid grid-cols-3 gap-3 bg-background px-3 py-3 text-xs font-medium text-muted">
                <span>Référence</span>
                <span>Client</span>
                <span className="text-right">Statut</span>
              </div>
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <FileText size={24} className="text-primary" aria-hidden="true" />
                <p className="mt-4 text-sm font-medium">Vos devis, au même endroit</p>
                <p className="mt-2 max-w-56 text-xs leading-5 text-muted">
                  Référence, client, montant et statut pour retrouver chaque dossier.
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted">
              <ShieldCheck
                size={16}
                className="mt-0.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              Chaque entreprise dispose de son propre espace.
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-xs leading-5 text-muted">
        Vue de l’interface, sans données client.
      </figcaption>
    </figure>
  )
}
function Step({
  number,
  title,
  text,
}: {
  number: string
  title: string
  text: string
}) {
  return (
    <article className="border-t border-line pt-6">
      <span className="font-mono text-sm text-primary">{number}</span>
      <h3 className="mt-4 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-muted">{text}</p>
    </article>
  )
}
function Trust({
  number,
  title,
  text,
}: {
  number: string
  title: string
  text: string
}) {
  return (
    <div className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4 py-6 first:pt-0 last:pb-0">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/5 font-mono text-sm text-[#c3dbc9]">
        {number}
      </span>
      <div className="pt-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[#c4d0c9]">{text}</p>
      </div>
    </div>
  )
}
function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="page-container py-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row">
          <CadovaLogo className="h-6 self-start" />
          <nav
            aria-label="Informations légales"
            className="flex flex-wrap gap-x-5 gap-y-3 text-xs text-muted"
          >
            <Link to="/privacy" className="hover:text-primary">
              Confidentialité
            </Link>
            <Link to="/terms" className="hover:text-primary">
              Conditions d’utilisation
            </Link>
            <Link to="/legal-notice" className="hover:text-primary">
              Mentions légales
            </Link>
            <Link to="/cookies" className="hover:text-primary">
              Cookies
            </Link>
          </nav>
        </div>
        <p className="mt-6 text-xs text-muted">© {new Date().getFullYear()} Cadova</p>
      </div>
    </footer>
  )
}
