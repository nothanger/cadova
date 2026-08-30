import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react"
import { CadovaLogo } from "@/components/CadovaLogo"

type LegalPageKind = "privacy" | "terms" | "legal-notice" | "cookies"

type Section = {
  title: string
  content: ReactNode
}

const legalPages: Record<LegalPageKind, {
  eyebrow: string
  title: string
  intro: string
  sections: Section[]
}> = {
  privacy: {
    eyebrow: "Vie privée & RGPD",
    title: "Politique de confidentialité",
    intro:
      "Cette politique explique comment Cadova FollowUp traite les données personnelles nécessaires au fonctionnement du service.",
    sections: [
      {
        title: "1. Responsable du traitement",
        content: (
          <>
            Le responsable du traitement est la société CADOVA, [forme
            juridique] en cours de constitution. Pour toute question concernant
            vos données personnelles, vous pouvez nous contacter à l’adresse{" "}
            <a href="mailto:privacy@cadova.fr">privacy@cadova.fr</a>.
          </>
        ),
      },
      {
        title: "2. Données traitées",
        content: (
          <>
            Nous traitons les données de compte (adresse email), les données
            d’entreprise et les données que vous saisissez dans Cadova,
            notamment les coordonnées de vos clients, les devis, leurs montants,
            statuts et dates de relance. Les données de connexion et journaux
            techniques peuvent également être traités pour assurer la sécurité
            du service.
          </>
        ),
      },
      {
        title: "3. Finalités et bases légales",
        content: (
          <>
            Ces données sont utilisées pour créer et administrer votre compte,
            fournir le suivi des devis et les rappels demandés, assurer la
            sécurité et répondre à nos obligations légales. Les traitements
            nécessaires au service reposent sur l’exécution du contrat ; ceux
            relatifs à la sécurité et à l’amélioration du service reposent sur
            notre intérêt légitime. Vous pouvez retirer votre consentement aux
            communications facultatives à tout moment.
          </>
        ),
      },
      {
        title: "4. Rôles et confidentialité des données client",
        content: (
          <>
            Pour les données de vos prospects et clients saisies dans Cadova,
            votre entreprise agit en principe comme responsable du traitement et
            Cadova comme sous-traitant. Chaque espace entreprise est isolé : les
            données ne sont accessibles qu’aux utilisateurs autorisés de votre
            organisation et aux personnes habilitées à maintenir le service.
          </>
        ),
      },
      {
        title: "5. Sous-traitants et transferts",
        content: (
          <>
            Cadova utilise Supabase pour l’hébergement des données et Resend
            pour l’envoi des emails de rappel. Ces prestataires n’accèdent aux
            données que pour fournir leurs services. Tout transfert hors de
            l’Espace économique européen est encadré par les garanties requises
            par la réglementation applicable.
          </>
        ),
      },
      {
        title: "6. Durées de conservation",
        content: (
          <>
            Les données de compte et de votre espace sont conservées pendant la
            durée de votre utilisation du service, puis supprimées ou
            anonymisées dans un délai raisonnable, sauf obligation légale de
            conservation. Les données de sécurité sont conservées pour une durée
            limitée et proportionnée.
          </>
        ),
      },
      {
        title: "7. Vos droits",
        content: (
          <>
            Vous pouvez demander l’accès, la rectification, l’effacement, la
            limitation ou la portabilité de vos données, ou vous opposer à
            certains traitements. Contactez-nous à{" "}
            <a href="mailto:privacy@cadova.fr">privacy@cadova.fr</a>. Vous
            pouvez aussi introduire une réclamation auprès de la CNIL (
            <a href="https://www.cnil.fr" target="_blank" rel="noreferrer">
              cnil.fr <ExternalLink size={13} className="inline" />
            </a>
            ).
          </>
        ),
      },
      {
        title: "8. Sécurité",
        content: (
          <>
            Nous appliquons des mesures techniques et organisationnelles
            raisonnables pour protéger les données, notamment une
            authentification, des contrôles d’accès et une séparation des
            espaces entreprise. Aucun système n’étant infaillible, nous vous
            invitons aussi à conserver un mot de passe robuste et confidentiel.
          </>
        ),
      },
    ],
  },
  terms: {
    eyebrow: "Conditions d’utilisation",
    title: "Conditions générales d’utilisation",
    intro:
      "Les présentes conditions encadrent l’accès et l’utilisation de Cadova FollowUp.",
    sections: [
      {
        title: "1. Le service",
        content: (
          <>
            Cadova FollowUp est un service SaaS (Software as a Service) édité
            par la société Cadova. Il permet aux professionnels de centraliser
            le suivi de leurs devis, d’organiser leurs relances commerciales et
            d’automatiser l’envoi de rappels et notifications selon les
            paramètres définis par l’utilisateur.
          </>
        ),
      },
      {
        title: "2. Création de compte",
        content: (
          <>
            Vous devez fournir des informations exactes, conserver vos
            identifiants confidentiels et être habilité à engager l’entreprise
            pour laquelle vous créez un espace. Vous êtes responsable des
            actions réalisées depuis votre compte et devez nous signaler sans
            délai tout accès non autorisé.
          </>
        ),
      },
      {
        title: "3. Utilisation acceptable",
        content: (
          <>
            Vous vous engagez à utiliser Cadova conformément aux lois
            applicables, aux droits des tiers et aux présentes conditions. Il
            est notamment interdit de tenter de contourner les mesures de
            sécurité, d’accéder à l’espace d’un tiers ou d’utiliser le service
            pour envoyer des communications non sollicitées ou illicites.
          </>
        ),
      },
      {
        title: "4. Vos données",
        content: (
          <>
            Vous conservez vos droits sur les données que vous saisissez. Vous
            nous accordez uniquement les droits nécessaires pour héberger,
            traiter et afficher ces données afin de fournir le service. Vous
            garantissez disposer des droits et, le cas échéant, des bases
            légales nécessaires pour importer les données de vos clients.
          </>
        ),
      },
      {
        title: "5. Disponibilité et évolution",
        content: (
          <>
            Nous faisons notre possible pour maintenir le service accessible et
            sécurisé, sans garantir une disponibilité ininterrompue. Des
            opérations de maintenance, mises à jour ou incidents externes
            peuvent occasionner des indisponibilités temporaires. Nous pouvons
            faire évoluer le service en préservant raisonnablement ses fonctions
            essentielles.
          </>
        ),
      },
      {
        title: "6. Responsabilité",
        content: (
          <>
            Cadova aide à organiser le suivi commercial ; il ne remplace ni
            votre jugement, ni vos obligations professionnelles et légales. Vous
            restez responsable du contenu de vos devis, de vos relances et de
            votre relation client. Dans les limites autorisées par la loi, notre
            responsabilité est limitée aux dommages directs prouvés résultant
            d’un manquement imputable au service.
          </>
        ),
      },
      {
        title: "7. Suspension et résiliation",
        content: (
          <>
            Nous pouvons suspendre l’accès en cas d’usage manifestement
            illicite, frauduleux ou dangereux pour le service. Vous pouvez
            cesser d’utiliser Cadova à tout moment. Les modalités commerciales
            applicables, le cas échéant, sont communiquées lors de la
            souscription.
          </>
        ),
      },
      {
        title: "8. Droit applicable",
        content: (
          <>
            Les présentes conditions sont régies par le droit français. En cas
            de différend, nous vous invitons à nous contacter d’abord à{" "}
            <a href="mailto:legal@cadova.fr">legal@cadova.fr</a> afin de
            rechercher une solution amiable.
          </>
        ),
      },
    ],
  },
  "legal-notice": {
    eyebrow: "Informations éditeur",
    title: "Mentions légales",
    intro:
      "Les informations ci-dessous identifient l’éditeur du site et les principaux intervenants techniques.",
    sections: [
      {
        title: "Éditeur du site",
        content: (
          <>
            <PublisherPlaceholder />
            <br />
            Forme juridique, capital social, siège social, RCS/RNE, numéro de
            TVA intracommunautaire et directeur de la publication :{" "}
            <span className="font-medium text-ink">
              à compléter avant mise en ligne publique.
            </span>
          </>
        ),
      },
      {
        title: "Contact",
        content: (
          <>
            Pour nous joindre :{" "}
            <a href="mailto:contact@cadova.fr">contact@cadova.fr</a>. Pour une
            demande relative aux données personnelles :{" "}
            <a href="mailto:privacy@cadova.fr">privacy@cadova.fr</a>.
          </>
        ),
      },
      {
        title: "Hébergement",
        content: (
          <>
            Le service est hébergé au moyen de l’infrastructure Supabase. Les
            modalités précises d’hébergement et les coordonnées de l’hébergeur
            doivent être renseignées dans cette page avant publication.
          </>
        ),
      },
      {
        title: "Propriété intellectuelle",
        content: (
          <>
            Le site, la marque Cadova, son identité visuelle et ses contenus
            sont protégés par le droit de la propriété intellectuelle. Toute
            reproduction ou exploitation non autorisée est interdite, sauf
            exception légale.
          </>
        ),
      },
    ],
  },
  cookies: {
    eyebrow: "Traceurs",
    title: "Politique relative aux cookies",
    intro:
      "Cadova privilégie un fonctionnement sans publicité ni traçage superflu.",
    sections: [
      {
        title: "1. Qu’est-ce qu’un cookie ?",
        content: (
          <>
            Un cookie est un petit fichier déposé ou lu sur votre terminal lors
            de la consultation d’un site ou de l’utilisation d’un service en
            ligne.
          </>
        ),
      },
      {
        title: "2. Cookies strictement nécessaires",
        content: (
          <>
            Cadova peut utiliser des traceurs nécessaires à la connexion, à la
            sécurité, à la conservation de votre session et au bon
            fonctionnement du service. Ils ne nécessitent pas de consentement
            lorsqu’ils sont strictement nécessaires.
          </>
        ),
      },
      {
        title: "3. Mesure d’audience et cookies facultatifs",
        content: (
          <>
            Aucun cookie publicitaire n’est utilisé. Si un outil de mesure
            d’audience ou tout autre traceur non essentiel est activé
            ultérieurement, votre consentement sera demandé avant son dépôt et
            vous pourrez le retirer aussi facilement qu’il a été donné.
          </>
        ),
      },
      {
        title: "4. Gérer vos choix",
        content: (
          <>
            Vous pouvez configurer votre navigateur pour supprimer ou bloquer
            les cookies. Le blocage des cookies nécessaires peut toutefois
            empêcher la connexion ou dégrader certaines fonctions de Cadova.
          </>
        ),
      },
    ],
  },
}

export function LegalPage({ kind }: { kind: LegalPageKind }) {
  const page = legalPages[kind]
  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="border-b border-line bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[76px] w-[min(calc(100%-32px),960px)] items-center justify-between md:w-[min(calc(100%-48px),960px)]">
          <Link to="/" aria-label="Retour à l'accueil">
            <CadovaLogo variant="full" className="h-7" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-background hover:text-ink"
          >
            <ArrowLeft size={16} />
            Accueil
          </Link>
        </div>
      </header>
      <main className="mx-auto w-[min(calc(100%-32px),760px)] py-16 md:w-[min(calc(100%-48px),760px)] md:py-24">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[.1em] text-primary">
          {page.eyebrow}
        </p>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-.04em] text-ink md:text-5xl">
          {page.title}
        </h1>
        <p className="mt-6 max-w-2xl text-[1.05rem] leading-8 text-ink-soft">
          {page.intro}
        </p>
        <p className="mt-5 font-mono text-xs text-muted">
          Dernière mise à jour : 30 août 2026
        </p>
        <div className="mt-12 border-t border-line">
          {page.sections.map((section) => (
            <section key={section.title} className="border-b border-line py-8">
              <h2 className="text-lg font-semibold tracking-tight text-ink">
                {section.title}
              </h2>
              <div className="mt-3 text-[15px] leading-7 text-ink-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary-hover">
                {section.content}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-10 flex gap-3 rounded-[14px] border border-primary/15 bg-primary-soft p-5">
          <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={20} />
          <p className="text-sm leading-6 text-ink-soft">
            Pour exercer vos droits ou signaler une question concernant ces
            documents, contactez{" "}
            <a
              className="font-semibold text-primary underline underline-offset-4"
              href="mailto:privacy@cadova.fr"
            >
              privacy@cadova.fr
            </a>
            .
          </p>
        </div>
      </main>
      <footer className="border-t border-line bg-background">
        <div className="mx-auto flex w-[min(calc(100%-32px),960px)] flex-col gap-4 py-8 text-sm text-muted md:w-[min(calc(100%-48px),960px)] md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Cadova. Tous droits réservés.</p>
          <nav
            aria-label="Liens légaux"
            className="flex flex-wrap gap-x-5 gap-y-2"
          >
            <Link to="/privacy" className="hover:text-ink">
              Confidentialité
            </Link>
            <Link to="/terms" className="hover:text-ink">
              CGU
            </Link>
            <Link to="/legal-notice" className="hover:text-ink">
              Mentions légales
            </Link>
            <Link to="/cookies" className="hover:text-ink">
              Cookies
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

function PublisherPlaceholder() {
  return (
    <span className="font-medium text-ink">
      [Raison sociale de l’éditeur à compléter]
    </span>
  )
}
