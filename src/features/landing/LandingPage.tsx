import { useEffect, useState, type MouseEvent, type ReactNode } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  Check,
  FileText,
  Menu,
  Plus,
  ShieldCheck,
  Users,
  WalletCards,
  X,
} from "lucide-react"
import { CadovaLogo } from "@/components/CadovaLogo"
import { useAuth } from "@/features/auth/AuthContext"

const container =
  "mx-auto w-[min(calc(100%-32px),1180px)] md:w-[min(calc(100%-48px),1180px)]"
const eyebrow = "text-xs font-bold tracking-[0.03em] text-primary"
const heading = "font-semibold leading-[1.12] tracking-[-0.035em] text-ink"
const navItems = [
  { label: "Produit", id: "produit" },
  { label: "Fonctionnement", id: "fonctionnement" },
  { label: "Sécurité", id: "securite" },
]

export function LandingPage() {
  const { session, loading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) =>
      event.key === "Escape" && setMenuOpen(false)
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [])

  const closeMenu = () => setMenuOpen(false)

  const scrollToSection =
    (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault()
      closeMenu()
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
    }

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-ink">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
      >
        Aller au contenu
      </a>
      <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur-md">
        <nav
          aria-label="Navigation principale"
          className={`${container} flex h-[76px] items-center justify-between`}
        >
          <Link to="/" aria-label="Retour à l'accueil">
            <CadovaLogo variant="full" className="h-7" />
          </Link>
          <div className="hidden items-center gap-8 lg:flex">
            {navItems.map(({ label, id }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={scrollToSection(id)}
                className="border-b border-transparent py-1 text-sm font-medium text-ink-soft transition-colors hover:border-primary hover:text-ink"
              >
                {label}
              </a>
            ))}
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            {!loading && session ? (
              <NavAppLink />
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink"
                >
                  Se connecter
                </Link>
                <PrimaryLink to="/signup" compact>
                  Commencer gratuitement
                </PrimaryLink>
              </>
            )}
          </div>
          <button
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-background lg:hidden"
          >
            {menuOpen ? <X size={20} /> : <Menu size={22} />}
          </button>
        </nav>
        {menuOpen && (
          <div className="border-t border-line bg-white lg:hidden">
            <div className={`${container} flex flex-col gap-1 py-4`}>
              {navItems.map(({ label, id }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={scrollToSection(id)}
                  className="rounded-lg px-3 py-3 text-sm font-medium text-ink hover:bg-background"
                >
                  {label}
                </a>
              ))}
              <div className="mt-2 grid gap-2 border-t border-line pt-4">
                {!loading && session ? (
                  <NavAppLink onClick={closeMenu} />
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={closeMenu}
                      className="flex min-h-11 items-center justify-center rounded-[10px] border border-line text-sm font-semibold text-ink"
                    >
                      Se connecter
                    </Link>
                    <PrimaryLink to="/signup" onClick={closeMenu}>
                      Commencer gratuitement
                    </PrimaryLink>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <main id="contenu">
        <section
          id="produit"
          className={`${container} grid items-center gap-[54px] py-[70px] lg:grid-cols-[.8fr_1.2fr] lg:gap-[72px] lg:py-[92px]`}
        >
          <div className="mx-auto max-w-[510px] text-center lg:mx-0 lg:text-left">
            <p className={eyebrow}>Le suivi des devis, sans l’oubli</p>
            <h1 className={`${heading} mt-5 text-[clamp(2.9rem,5vw,4.3rem)]`}>
              Ne laissez plus vos devis{" "}
              <span className="text-primary">sans réponse.</span>
            </h1>
            <p className="mt-6 text-[1.06rem] leading-[1.7] text-muted">
              Cadova FollowUp vous montre quels devis relancer et combien
              d’argent est encore en attente, sans vous imposer un CRM
              compliqué.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <PrimaryLink to="/signup">
                Commencer gratuitement{" "}
                <ArrowRight size={16} aria-hidden="true" />
              </PrimaryLink>
              <Link
                to="/login"
                className="inline-flex min-h-[52px] items-center justify-center rounded-[10px] border border-line bg-white px-6 text-sm font-semibold text-ink transition hover:-translate-y-0.5 hover:bg-background"
              >
                Se connecter
              </Link>
            </div>
            <p className="mt-5 text-sm text-ink-soft">
              <Check
                size={15}
                className="mr-1 inline text-success"
                aria-hidden="true"
              />
              Simple à prendre en main · Pensé pour les petites entreprises
            </p>
          </div>
          <ProductPreview />
        </section>

        <section className="bg-background py-[70px] lg:py-[112px]">
          <div className={`${container} text-center`}>
            <p className={eyebrow}>Le quotidien, simplifié</p>
            <h2
              className={`${heading} mx-auto mt-5 max-w-[760px] text-[clamp(2.25rem,4vw,3.6rem)]`}
            >
              Un devis envoyé n’est pas encore une vente.
            </h2>
            <p className="mx-auto mt-5 max-w-[760px] leading-[1.7] text-muted">
              Entre les chantiers, les clients et l’administratif, une relance
              peut facilement être oubliée. Cadova rassemble les informations
              utiles et fait remonter les devis qui demandent votre attention.
            </p>
            <div className="mx-auto mt-12 grid max-w-[980px] gap-[22px] text-left md:grid-cols-2">
              <WithoutCadova />
              <WithCadova />
            </div>
          </div>
        </section>

        <section
          id="fonctionnement"
          className={`${container} py-[70px] lg:py-[112px]`}
        >
          <p className={eyebrow}>Comment ça fonctionne</p>
          <h2
            className={`${heading} mt-5 max-w-[700px] text-[clamp(2.25rem,4vw,3.6rem)]`}
          >
            Du devis envoyé à la bonne relance, en trois étapes.
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <Step
              number="01"
              title="Ajoutez votre client"
              description="Centralisez les coordonnées et les informations utiles de votre prospect."
              visual="client"
            />
            <Step
              number="02"
              title="Enregistrez le devis"
              description="Indiquez sa référence, son montant, sa date d’envoi et son statut."
              visual="quote"
            />
            <Step
              number="03"
              title="Agissez au bon moment"
              description="Cadova identifie les devis envoyés qui méritent une relance et les place dans vos priorités."
              visual="followup"
            />
          </div>
        </section>

        <section className="bg-background py-[70px] lg:py-[112px]">
          <div className={container}>
            <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
              <div>
                <p className={eyebrow}>L’essentiel, sans complexité</p>
                <h2
                  className={`${heading} mt-5 max-w-[590px] text-[clamp(2.25rem,4vw,3.6rem)]`}
                >
                  Tout ce qu’il faut pour mieux suivre vos devis.
                </h2>
              </div>
              <p className="max-w-[430px] leading-[1.7] text-muted">
                Cadova regroupe les informations réellement utiles pour vous
                aider à suivre les opportunités en attente, sans transformer
                votre quotidien en gestion de CRM.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Feature
                icon={<Users />}
                title="Clients centralisés"
                text="Retrouvez les coordonnées et les devis associés à chaque client."
              />
              <Feature
                icon={<FileText />}
                title="Devis structurés"
                text="Suivez les références, montants, dates d’envoi et statuts au même endroit."
              />
              <Feature
                icon={<Check />}
                title="Priorités du jour"
                text="Identifiez rapidement les devis envoyés qui nécessitent une relance."
              />
              <Feature
                icon={<WalletCards />}
                title="Montants en attente"
                text="Visualisez combien d’argent reste lié à vos devis encore ouverts."
              />
            </div>
          </div>
        </section>

        <section
          id="securite"
          className="scroll-mt-[76px] flex min-h-[calc(100vh-76px)] items-center bg-ink py-[70px] text-white lg:py-[112px]"
        >
          <div
            className={`${container} grid w-full max-w-[960px] gap-14 lg:grid-cols-2 lg:gap-20`}
          >
            <div className="text-center lg:text-left">
              <p className="text-xs font-bold tracking-[.03em] text-[#b9bbff]">
                Confiance & sécurité
              </p>
              <h2 className="mt-5 text-[clamp(2.25rem,4vw,3.6rem)] font-semibold leading-[1.12] tracking-[-.035em]">
                Les données de votre entreprise méritent une vraie séparation.
              </h2>
              <p className="mx-auto mt-6 max-w-[480px] leading-[1.7] text-[#b9c0d0] lg:mx-0">
                Cadova est conçu pour que chaque entreprise travaille dans son
                propre espace et que les informations commerciales restent
                accessibles uniquement aux personnes autorisées.
              </p>
            </div>
            <div className="mx-auto w-full max-w-[440px] divide-y divide-[#2a3144]">
              <Trust
                number="01"
                title="Espace privé"
                text="Vos clients et vos devis ne sont pas publiquement accessibles."
              />
              <Trust
                number="02"
                title="Entreprises séparées"
                text="Les informations de chaque entreprise sont isolées."
              />
              <Trust
                number="03"
                title="Accès contrôlés"
                text="Les droits sont vérifiés avant l’accès aux données."
              />
              <Trust
                number="04"
                title="Décision humaine"
                text="Cadova vous aide à prioriser. Vous gardez le contrôle de la relation client."
              />
            </div>
          </div>
        </section>

        <section className={`${container} py-[70px] lg:py-[112px]`}>
          <div className="relative overflow-hidden rounded-[20px] bg-primary px-5 py-[74px] text-center text-white md:rounded-[28px] md:px-10">
            <i
              aria-hidden="true"
              className="absolute -left-24 -top-28 h-64 w-64 rounded-full border border-white/20"
            />
            <i
              aria-hidden="true"
              className="absolute -bottom-36 -right-20 h-72 w-72 rounded-full border border-white/20"
            />
            <div className="relative mx-auto max-w-[650px]">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[.1em] text-white/75">
                Commencez simplement
              </p>
              <h2 className="mt-5 text-[clamp(2.25rem,4vw,3.6rem)] font-semibold leading-[1.12] tracking-[-.035em]">
                Les bons devis méritent une relance.
              </h2>
              <p className="mt-5 leading-[1.7] text-white/85">
                Créez votre espace Cadova et retrouvez immédiatement les devis
                qui demandent votre attention.
              </p>
              <Link
                to="/signup"
                className="mt-8 inline-flex min-h-[52px] items-center gap-2 rounded-[10px] bg-white px-6 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-0.5"
              >
                Commencer gratuitement <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

function PrimaryLink({
  to,
  children,
  compact = false,
  onClick,
}: {
  to: string
  children: ReactNode
  compact?: boolean
  onClick?: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] bg-primary px-6 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(90,92,255,.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-primary-hover ${
        compact ? "h-[42px] px-4" : "min-h-[52px]"
      }`}
    >
      {children}
    </Link>
  )
}
function NavAppLink({ onClick }: { onClick?: () => void }) {
  return (
    <PrimaryLink to="/app" onClick={onClick} compact>
      Ouvrir Cadova <ArrowRight size={15} />
    </PrimaryLink>
  )
}

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[620px]">
      <div
        aria-hidden="true"
        className="absolute -right-14 -top-12 h-72 w-72 rounded-full bg-primary-soft"
      />
      <div className="relative overflow-hidden rounded-[22px] border border-line bg-white shadow-[0_32px_80px_rgba(11,16,32,.14)]">
        <div className="grid h-[42px] grid-cols-3 items-center border-b border-line px-4 text-[10px] text-muted">
          <div className="flex gap-1.5">
            <i className="h-2 w-2 rounded-full bg-line" />
            <i className="h-2 w-2 rounded-full bg-line" />
            <i className="h-2 w-2 rounded-full bg-line" />
          </div>
          <span className="text-center font-medium text-ink-soft">
            Espace Cadova
          </span>
          <span className="text-right">Données sécurisées</span>
        </div>
        <div className="flex min-h-[410px] bg-background sm:min-h-[470px]">
          <aside className="hidden w-[105px] flex-col border-r border-line bg-white p-3 sm:flex">
            <CadovaLogo variant="full" className="h-5 w-[76px]" alt="Cadova" />
            <div className="mt-9 space-y-2">
              <span className="flex h-8 items-center gap-2 rounded-lg bg-primary-soft px-2 text-primary">
                <FileText size={14} />
                <i className="h-1.5 w-8 rounded bg-primary/50" />
              </span>
              <span className="flex h-8 items-center gap-2 px-2 text-muted">
                <Users size={14} />
                <i className="h-1.5 w-7 rounded bg-line-strong" />
              </span>
              <span className="flex h-8 items-center gap-2 px-2 text-muted">
                <Check size={14} />
                <i className="h-1.5 w-9 rounded bg-line-strong" />
              </span>
            </div>
          </aside>
          <div className="min-w-0 flex-1 p-5 sm:p-7">
            <h3 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
              Dashboard
            </h3>
            <p className="mt-1 text-[11px] text-muted">
              Bonjour Cadova — voici ce qui mérite votre attention.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniStat label="À relancer" value="2" />
              <MiniStat label="Argent en attente" value="12 420 €" />
            </div>
            <div className="mt-5 rounded-xl border border-line bg-white">
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <p className="text-xs font-semibold text-ink">
                  À relancer en priorité
                </p>
                <span className="text-[10px] font-medium text-primary">
                  Voir tous
                </span>
              </div>
              <div className="divide-y divide-line">
                <QuoteRow
                  name="Atelier Mistral"
                  reference="DEV-2026-041"
                  amount="1 250 €"
                  meta="Envoyé il y a 5 jours"
                  tone="warning"
                  label="À relancer"
                />
                <QuoteRow
                  name="Studio Nova"
                  reference="DEV-2026-044"
                  amount="890 €"
                  meta="Envoyé il y a 2 jours"
                  tone="primary"
                  label="En attente"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-warning/20 bg-warning-soft p-3">
              <div>
                <p className="text-xs font-semibold text-warning">
                  Deux devis à relancer
                </p>
                <p className="mt-0.5 text-[10px] text-ink-soft">
                  Ils attendent votre retour depuis 3 jours.
                </p>
              </div>
              <span className="whitespace-nowrap rounded-lg bg-white px-3 py-2 text-[10px] font-semibold text-ink shadow-sm">
                Voir les devis
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background p-3">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-ink">
        {value}
      </p>
    </div>
  )
}
function QuoteRow({
  name,
  reference,
  amount,
  meta,
  tone,
  label,
}: {
  name: string
  reference: string
  amount: string
  meta: string
  tone: string
  label: string
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 p-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-ink">{name}</p>
        <p className="mt-0.5 text-[10px] text-muted">
          {reference} · {meta}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold text-ink">{amount}</p>
        <span
          className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold ${
            tone === "warning"
              ? "bg-warning-soft text-warning"
              : "bg-primary-soft text-primary"
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
function WithoutCadova() {
  const list = [
    "Retrouver les devis",
    "Noter les dates d’envoi",
    "Calculer les montants",
    "Se souvenir des relances",
    "Vérifier chaque statut",
    "Décider quoi faire aujourd’hui",
  ]
  return (
    <div className="rounded-[18px] border border-line bg-white p-6">
      <p className="font-mono text-[11px] font-semibold tracking-[.1em] text-muted">
        SANS SUIVI CLAIR
      </p>
      <h3 className="mt-4 text-xl font-semibold tracking-tight text-ink">
        Tout vérifier manuellement
      </h3>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {list.map((item) => (
          <p key={item} className="flex gap-2 text-sm text-ink-soft">
            <i className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" />
            {item}
          </p>
        ))}
      </div>
    </div>
  )
}
function WithCadova() {
  return (
    <div className="rounded-[18px] bg-ink p-6 text-white">
      <p className="font-mono text-[11px] font-semibold tracking-[.1em] text-[#b9bbff]">
        AVEC CADOVA
      </p>
      <h3 className="mt-4 text-xl font-semibold tracking-tight">
        Les priorités remontent automatiquement
      </h3>
      <div className="mt-7 flex items-center gap-4 rounded-xl bg-[#171d31] p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
          <Check size={20} />
        </span>
        <div>
          <p className="text-sm font-semibold">2 devis à relancer</p>
          <p className="mt-0.5 text-xs text-[#b9c0d0]">3 450 € concernés</p>
        </div>
      </div>
      <p className="mt-6 text-sm leading-relaxed text-[#b9c0d0]">
        Vous savez quoi regarder. Vous gardez la décision et la relation avec
        votre client.
      </p>
    </div>
  )
}
function Step({
  number,
  title,
  description,
  visual,
}: {
  number: string
  title: string
  description: string
  visual: "client" | "quote" | "followup"
}) {
  return (
    <article className="rounded-[18px] border border-line bg-white p-5 sm:p-7">
      <div className="flex h-[150px] items-center justify-center rounded-xl bg-background">
        {visual === "client" && (
          <div className="relative w-32 rounded-lg border border-line bg-white p-3 shadow-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
              AM
            </span>
            <i className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
              <Plus size={13} />
            </i>
            <div className="mt-3 space-y-1.5">
              <i className="block h-1.5 w-16 rounded bg-line" />
              <i className="block h-1.5 w-10 rounded bg-line" />
            </div>
          </div>
        )}
        {visual === "quote" && (
          <div className="w-28 rounded-lg border border-line bg-white p-3 shadow-sm">
            <FileText size={17} className="text-primary" />
            <div className="mt-3 space-y-1.5">
              <i className="block h-1.5 rounded bg-line" />
              <i className="block h-1.5 w-3/4 rounded bg-line" />
              <i className="block h-1.5 w-1/2 rounded bg-primary" />
            </div>
          </div>
        )}
        {visual === "followup" && (
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-[0_8px_20px_rgba(90,92,255,.28)]">
            <Check size={29} />
            <span className="absolute -right-5 -top-2 rounded-full bg-warning-soft px-2 py-1 text-[10px] font-semibold text-warning">
              J+3
            </span>
          </div>
        )}
      </div>
      <p className="mt-6 font-mono text-xs font-semibold text-primary">
        {number}
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-ink">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
    </article>
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
    <article className="rounded-[14px] border border-line bg-white p-6">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
        {icon}
      </span>
      <h3 className="mt-5 text-base font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
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
    <div className="grid grid-cols-[36px_1fr] gap-4 py-5 first:pt-0 last:pb-0">
      <span className="font-mono text-sm font-semibold text-[#b9bbff]">
        {number}
      </span>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-[#b9c0d0]">{text}</p>
      </div>
    </div>
  )
}
function Footer() {
  return (
    <footer className="bg-ink text-white">
      <div className={`${container} py-12`}>
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div>
            <CadovaLogo variant="full" className="h-7 brightness-0 invert" />
            <p className="mt-4 text-sm text-[#b9c0d0]">
              Le suivi simple de vos devis.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#d9deea]">
            <a href="#produit" className="hover:text-white">
              Produit
            </a>
            <Link to="/login" className="hover:text-white">
              Se connecter
            </Link>
            <Link to="/signup" className="hover:text-white">
              Commencer
            </Link>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-4 border-t border-[#2a3144] pt-5 text-xs text-[#9ea7ba] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Cadova. Tous droits réservés.</p>
          <nav
            aria-label="Informations légales"
            className="flex flex-wrap gap-x-4 gap-y-2"
          >
            <Link to="/privacy" className="hover:text-white">
              Confidentialité
            </Link>
            <Link to="/terms" className="hover:text-white">
              CGU
            </Link>
            <Link to="/legal-notice" className="hover:text-white">
              Mentions légales
            </Link>
            <Link to="/cookies" className="hover:text-white">
              Cookies
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
