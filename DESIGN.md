# Cadova

Cadova s’adresse d’abord aux artisans et indépendants, puis aux petites entreprises de services. Il sert à suivre des clients, des devis et les actions de relance. L’interface doit faciliter la lecture des dossiers et la prochaine action, sans promettre une vente ou un gain financier.

## Direction

Une interface de travail calme : fond papier (#f5f5f0), surfaces blanches, encre (#182725), vert profond (#246052) pour les actions. Le point violet du logo existant reste un détail de marque, pas un thème de surfaces. Aucun dégradé, effet lumineux ou décor sans rôle.

Police système pour éviter un téléchargement tiers et assurer la lisibilité. Titres courts, graisse 600, interlignage 1,15 à 1,3 ; corps 14 à 16 px, interlignage 1,5 à 1,7. Chiffres tabulaires pour les montants ; monospace réservé aux références.

## Composants

- Grille de 4 px. Marges mobiles de 20 à 24 px, contenu métier limité à 1120 px.
- Boutons et champs de 44 px minimum, rayon de 8 px ; cartes de 12 px. Les interrupteurs seuls conservent leur forme arrondie.
- Une action principale par bloc. Actions secondaires bordées ; statut lisible par son texte autant que par sa couleur.
- Tables avec en-têtes discrets, lignes séparées et montants alignés à droite. Sur mobile, la zone de défilement reste visible et accessible au clavier.
- États vides factuels avec une prochaine action utile. Erreurs explicites et réessayables. Aucun emoji.
- Icônes Lucide, trait homogène, toujours accompagnées d’un nom accessible pour les commandes seules.

## Navigation et interaction

Même vocabulaire sur toutes les pages : Tableau de bord, Clients, Devis, Paramètres. Menu mobile refermable au clavier ; focus visible ; modales avec focus contenu et restauré. Les champs associent labels, aides et erreurs.

Transitions de couleur et de bordure uniquement. Respecter prefers-reduced-motion. Ne jamais masquer les barres de défilement.

## Contenus et confiance

Aucun client, montant, compteur ou témoignage fictif sur le site public, même dans un aperçu. Les indicateurs privés proviennent uniquement des données de l’entreprise. Ethan Noto est le nom communiqué pour l’éditeur ; les autres informations juridiques restent à confirmer. L’accueil montre la structure du produit sans données inventées. Aucun engagement « gratuit » sans offre confirmée.

Conserver les routes, l’authentification, les règles métier et les API. Ne pas appliquer de migrations à un projet distant lors d’une refonte visuelle.

## Avant production

Le dépôt indique cadova.fr dans CNAME ; vérifier sa propriété, DNS, HTTPS et le routage SPA sur l’hébergeur réel. Confirmer les redirections Supabase et l’URL des liens email. Les métadonnées de partage utilisent ce domaine prévu, sans affirmer que son déploiement est vérifié.

Faire compléter et valider les documents juridiques : identité de l’éditeur, adresse, immatriculation, directeur de publication, contacts actifs, hébergeur du site et des données, région d’hébergement, sous-traitants, transferts, durées de conservation et modalités de suppression. Confirmer l’offre commerciale avant de prévoir des CGV ; aucun paiement n’est présent dans ce dépôt.

Les préférences de relance existent, mais la fonction email utilise actuellement un délai fixe et le cron une heure fixe. Ne pas promettre que ces préférences règlent le scheduler tant que le backend ne les applique pas. Cette limite est indépendante du design.
