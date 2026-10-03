import { usePageTitle } from "@/lib/usePageTitle"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { CadovaLogo } from "@/components/CadovaLogo"

type LegalPageKind = "privacy" | "terms" | "legal-notice" | "cookies"
type Section = { title: string; content: ReactNode }
const legalPages: Record<
  LegalPageKind,
  { title: string; intro: string; sections: Section[] }
> = {
  privacy: {
    title: "Politique de confidentialité",
    intro: "Les données utilisées par Cadova pour le suivi des clients et des devis.",
    sections: [
      {
        title: "Responsable du traitement",
        content:
          "L’éditeur indiqué est Ethan Noto. Son statut, ses coordonnées professionnelles et le contact pour les demandes relatives aux données personnelles restent à renseigner.",
      },
      {
        title: "Données enregistrées",
        content:
          "Le service utilise votre adresse email pour votre compte, le nom de votre entreprise, les coordonnées et notes de vos clients, ainsi que les références, montants, statuts, dates et historiques de vos devis.",
      },
      {
        title: "Utilisation des données",
        content:
          "Ces informations servent à gérer l’accès à votre espace, afficher vos dossiers et organiser vos relances. Les bases légales des traitements et les obligations de chaque partie doivent être précisées par l’éditeur avant publication.",
      },
      {
        title: "Accès et prestataires",
        content:
          "Les données métier sont rattachées à une entreprise. Le code prévoit des contrôles d’accès Supabase et des rappels email via Resend. La liste des prestataires effectivement activés, les lieux d’hébergement et les garanties de transfert restent à confirmer.",
      },
      {
        title: "Conservation et suppression",
        content:
          "Les durées de conservation, le sort des sauvegardes et la procédure de suppression d’un compte doivent être précisés. Aucune durée ni suppression automatique ne peut être garantie par ce document à ce stade.",
      },
      {
        title: "Vos droits",
        content: (
          <>
            Vous pouvez, selon les conditions prévues par la réglementation, demander
            l’accès, la rectification, l’effacement, la limitation ou la portabilité de
            vos données, ou vous opposer à certains traitements. Le contact pour exercer
            ces droits reste à fournir. Vous pouvez consulter la{" "}
            <a href="https://www.cnil.fr" target="_blank" rel="noreferrer">
              CNIL <ExternalLink size={13} aria-hidden="true" className="inline" />
            </a>
            .
          </>
        ),
      },
    ],
  },
  terms: {
    title: "Conditions d’utilisation",
    intro:
      "Le fonctionnement du service et les responsabilités à préciser avant son ouverture commerciale.",
    sections: [
      {
        title: "Le service",
        content:
          "Cadova permet de conserver les coordonnées des clients, suivre les devis et préparer des relances. La préparation d’un message ne l’envoie pas automatiquement au client : vous utilisez votre propre messagerie.",
      },
      {
        title: "Votre compte",
        content:
          "Vous devez être autorisé à utiliser les données de l’entreprise et des clients que vous enregistrez. Gardez vos identifiants confidentiels et vérifiez les informations saisies.",
      },
      {
        title: "Utilisation",
        content:
          "Le service doit être utilisé dans le respect des lois et des droits des tiers. Les tentatives de contournement des contrôles d’accès ou d’accès aux données d’une autre entreprise sont interdites.",
      },
      {
        title: "Conditions à confirmer",
        content:
          "L’identité juridique de l’éditeur, les éventuels tarifs, les conditions de souscription, la disponibilité du service, la responsabilité, la résiliation et le droit applicable doivent être définis et validés avant publication. Si une offre payante est proposée, les conditions de vente correspondantes devront également être fournies.",
      },
    ],
  },
  "legal-notice": {
    title: "Mentions légales",
    intro: "Identification de l’éditeur et informations d’hébergement.",
    sections: [
      {
        title: "Éditeur",
        content: (
          <>
            Ethan Noto.
            <br />À fournir : statut ou raison sociale, adresse professionnelle,
            coordonnées de contact, informations d’immatriculation et, selon le statut,
            capital et numéro de TVA. Le directeur de publication doit également être
            confirmé.
          </>
        ),
      },
      {
        title: "Hébergement du site",
        content:
          "Le nom et les coordonnées de l’hébergeur du site restent à fournir. Supabase héberge la base de données ; cela ne suffit pas à identifier l’hébergeur du frontend.",
      },
      {
        title: "Données et contacts",
        content:
          "La base de données utilise Supabase. La région du projet, les coordonnées du prestataire et les contacts de l’éditeur pour les demandes générales et les données personnelles doivent être confirmés.",
      },
    ],
  },
  cookies: {
    title: "Cookies et stockage local",
    intro: "Les mécanismes utilisés pour conserver votre connexion.",
    sections: [
      {
        title: "Session de connexion",
        content:
          "Le client Supabase est configuré pour conserver la session dans le stockage local du navigateur. Ce mécanisme permet de maintenir votre connexion entre les visites.",
      },
      {
        title: "Publicité et mesure d’audience",
        content:
          "Aucun outil publicitaire ni de mesure d’audience n’est intégré dans le code de l’application examiné. Les éventuels mécanismes ajoutés par l’hébergeur ou par la configuration de production devront être vérifiés avant publication.",
      },
      {
        title: "Effacer le stockage",
        content:
          "Vous pouvez supprimer les données du site dans les paramètres de votre navigateur. Cela peut vous déconnecter. Si des traceurs facultatifs sont ajoutés, leur usage et les choix de consentement devront être documentés.",
      },
    ],
  },
}

export function LegalPage({ kind }: { kind: LegalPageKind }) {
  const page = legalPages[kind]
  usePageTitle(page.title)
  return (
    <div className="min-h-screen bg-surface">
      <a href="#legal-content" className="skip-link">
        Aller au contenu
      </a>
      <header className="border-b border-line">
        <div className="page-container flex h-[72px] items-center justify-between gap-4">
          <Link to="/" aria-label="Cadova, accueil">
            <CadovaLogo className="h-7" />
          </Link>
          <Link to="/" className="ui-button text-ink-soft hover:bg-background">
            <ArrowLeft size={16} aria-hidden="true" />
            Accueil
          </Link>
        </div>
      </header>
      <main
        id="legal-content"
        tabIndex={-1}
        className="mx-auto max-w-3xl px-6 py-12 sm:px-8 sm:py-16"
      >
        <p className="section-kicker">Informations légales</p>
        <h1 className="section-title mt-4">{page.title}</h1>
        <p className="mt-5 text-base leading-7 text-ink-soft">{page.intro}</p>
        <p className="mt-7 rounded-lg border border-warning/20 bg-warning-soft p-4 text-sm leading-6 text-warning">
          Ce document doit être complété et validé par l’éditeur avant la mise en
          production. Les informations manquantes sont indiquées ci-dessous.
        </p>
        <div className="mt-8 divide-y divide-line border-y border-line">
          {page.sections.map((section) => (
            <section key={section.title} className="py-7">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <div className="mt-3 text-sm leading-7 text-ink-soft [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4">
                {section.content}
              </div>
            </section>
          ))}
        </div>
      </main>
      <footer className="border-t border-line bg-background">
        <nav
          aria-label="Pages légales"
          className="page-container flex flex-wrap gap-x-6 gap-y-3 py-7 text-sm text-muted"
        >
          {(
            [
              ["privacy", "Confidentialité"],
              ["terms", "Conditions d’utilisation"],
              ["legal-notice", "Mentions légales"],
              ["cookies", "Cookies"],
            ] as const
          ).map(([slug, label]) => (
            <Link
              key={slug}
              to={`/${slug}`}
              aria-current={kind === slug ? "page" : undefined}
              className={
                kind === slug ? "font-semibold text-primary" : "hover:text-primary"
              }
            >
              {label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  )
}
