import {
  Suspense,
  lazy,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react"
import { Link } from "react-router-dom"
import { ArrowRight, BellRing, FolderKanban, Menu, ShieldCheck, X } from "lucide-react"
import { CadovaLogo } from "@/components/CadovaLogo"
import { LinkButton } from "@/components/ui"
import { useAuth } from "@/features/auth/AuthContext"
import { usePageTitle } from "@/lib/usePageTitle"

const FollowupScene = lazy(() =>
  import("./FollowupScene").then((module) => ({ default: module.FollowupScene })),
)

const navItems = [
  { label: "Produit", id: "produit" },
  { label: "Usage", id: "usage" },
  { label: "Cadre", id: "cadre" },
]

const productLines = [
  "Clients regroupés par dossier.",
  "Devis suivis par statut.",
  "Relances préparées, jamais imposées.",
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
      <header className="sticky top-0 z-40 border-b border-line bg-background/95 backdrop-blur">
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
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface lg:hidden"
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
                className="block rounded-lg px-3 py-3 text-sm hover:bg-surface"
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
          className="relative isolate overflow-hidden border-b border-line"
        >
          <div className="page-container relative grid items-center pb-2 pt-8 md:min-h-[calc(100svh-120px)] md:grid-cols-[0.92fr_1.08fr] md:py-14 lg:py-20">
            <div className="min-w-0 max-w-2xl">
              <p className="section-kicker">Cadova</p>
              <h1 className="mt-5 max-w-[12ch] text-[2.65rem] font-semibold leading-[1.02] tracking-normal min-[390px]:text-[3.2rem] lg:text-[4.5rem] xl:text-[5.25rem]">
                Le suivi commercial, sans bruit.
              </h1>
              <p className="mt-7 max-w-md text-base leading-7 text-ink-soft">
                Un espace net pour retrouver vos clients, vos devis et la prochaine
                relance utile.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton to={destination}>
                  {action}
                  <ArrowRight size={16} aria-hidden="true" />
                </LinkButton>
                <a
                  href="#usage"
                  onClick={(e) => scrollToSection("usage", e)}
                  className="ui-button border border-line-strong bg-background text-ink hover:bg-primary-soft"
                >
                  Voir l’usage
                </a>
              </div>
            </div>
            <div className="relative -mx-4 mt-3 h-[260px] min-w-0 min-[390px]:h-[300px] md:-mr-8 md:ml-0 md:mt-0 md:h-[520px] lg:h-[600px]">
              <Suspense fallback={null}>
                <FollowupScene />
              </Suspense>
            </div>
          </div>
        </section>

        <section id="usage" tabIndex={-1} className="py-10 lg:py-20">
          <div className="page-container grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="section-kicker">Usage</p>
              <h2 className="section-title mt-4">
                Une page de travail, pas une promesse.
              </h2>
            </div>
            <div className="grid gap-3">
              {productLines.map((line, index) => (
                <article
                  key={line}
                  className="grid grid-cols-[52px_minmax(0,1fr)] items-center border-t border-line py-5 last:border-b"
                >
                  <span className="font-mono text-sm text-primary">0{index + 1}</span>
                  <p className="text-[clamp(1.45rem,3.4vw,3rem)] font-semibold leading-tight tracking-[-.045em]">
                    {line}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-ink text-white">
          <div className="page-container grid gap-0 lg:grid-cols-3">
            <Feature
              icon={<FolderKanban size={22} />}
              title="Dossiers propres"
              text="Coordonnées, notes et devis restent attachés au bon client."
            />
            <Feature
              icon={<BellRing size={22} />}
              title="Relances prêtes"
              text="Cadova aide à préparer la suite. Vous décidez du moment et du message."
            />
            <Feature
              icon={<ShieldCheck size={22} />}
              title="Espace séparé"
              text="Chaque entreprise travaille dans son propre espace."
            />
          </div>
        </section>

        <section id="cadre" tabIndex={-1} className="py-14 lg:py-20">
          <div className="page-container grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-end">
            <div>
              <p className="section-kicker">Cadre</p>
              <h2 className="mt-4 max-w-xl text-[clamp(2.4rem,6vw,5.6rem)] font-semibold leading-[0.92] tracking-[-.06em]">
                Vos devis restent vos devis.
              </h2>
            </div>
            <div className="max-w-lg lg:justify-self-end">
              <p className="text-base leading-7 text-ink-soft">
                L’outil ne remplace pas la relation client. Il garde les informations
                lisibles, prépare le suivi et laisse la décision à la personne qui
                connaît le dossier.
              </p>
              <div className="mt-8">
                <LinkButton to={destination}>
                  {action}
                  <ArrowRight size={16} aria-hidden="true" />
                </LinkButton>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: ReactNode
  title: string
  text: string
}) {
  return (
    <article className="border-white/15 py-8 lg:border-l lg:px-8 lg:first:border-l-0">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-[#bfc3ff]">
        {icon}
      </div>
      <h3 className="mt-6 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/68">{text}</p>
    </article>
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
