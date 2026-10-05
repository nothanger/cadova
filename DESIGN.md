# Cadova

Cadova s’adresse d’abord aux artisans et indépendants, puis aux petites entreprises de services. Il sert à suivre des clients, des devis et les actions de relance. L’interface doit faciliter la lecture des dossiers et la prochaine action, sans promettre une vente ou un gain financier.

## Direction

Une interface de travail calme : fond papier (#f6f6f2), surfaces blanches, encre bleu nuit du logo (#0b1020), accent indigo (#4f52e8) pour les actions. Le site doit prolonger le logo existant sans transformer chaque surface en violet. Aucun dégradé, effet lumineux ou décor sans rôle.

La vitrine doit oser davantage que les pages d'application : premier écran éditorial, logo en volume, sections courtes et contrastées. La silhouette 3D reprend le contour du logo original : C sombre et point indigo. Son animation dure 15,4 secondes, en quatre chapitres : dossier client, devis envoyé en attente, relance à préparer, puis suivi du dossier. Conserver la vitesse des déplacements ; limiter les pauses de lecture à environ une seconde entre les étapes. Le retour du point suit le regroupement des fiches après 0,2 seconde. Une fiche principale apparaît à chaque étape ; les précédentes restent reliées pour matérialiser le même dossier. Le point accompagne ce parcours avant de retrouver le centre du logo. Aucune représentation d'envoi automatique ou de vente acquise. Les titres et états sont aussi rendus en HTML, avec un corps de 14 px minimum. Les chapitres sont sélectionnables, y compris au clavier et sans WebGL. La pause conserve la position ; le rejeu reprend le début ; la fin reste calme. Une légère inclinaison au pointeur permet de percevoir le volume. Cette inclinaison et son retour sont amortis dans le temps. Préparer les matériaux avant la lecture, limiter les bonds après une image retardée et suspendre les rendus identiques pendant les pauses. Les ombres et les liens ne sont recalculés que lorsque leur géométrie change. Aucun nom, montant ou chiffre client fictif. Une seule scène est montée sur tous les formats ; le mouvement s'arrête hors écran et un logo statique remplace WebGL si nécessaire. Avec `prefers-reduced-motion`, les chapitres restent accessibles sous forme de poses immobiles.

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

La landing suit le parcours d'un devis : retrouver le dossier client, repérer ce qui attend une réponse, préparer le prochain message. S'adresser au lecteur avec « vous », utiliser les mots client, devis, notes, message et relance. Chaque bloc doit apporter une information distincte. Décrire les actions disponibles et préciser ce qui reste manuel : personnaliser le texte, l'envoyer depuis sa messagerie, enregistrer la relance. Éviter les qualificatifs d'ambiance (« net », « propre », « sans bruit »), les comparaisons défensives et les promesses de résultat. Les boutons nomment l'étape qui suit ; les métadonnées et l'aperçu de partage reprennent ce même vocabulaire.

Aucun client, montant, compteur ou témoignage fictif sur le site public, même dans un aperçu. Les indicateurs privés proviennent uniquement des données de l’entreprise. Ethan Noto est le nom communiqué pour l’éditeur ; les autres informations juridiques restent à confirmer. L’accueil montre la structure du produit sans données inventées. Aucun engagement « gratuit » sans offre confirmée.

Conserver les routes, l’authentification, les règles métier et les API. Ne pas appliquer de migrations à un projet distant lors d’une refonte visuelle.

## Avant production

Le dépôt indique cadova.fr dans CNAME ; vérifier sa propriété, DNS, HTTPS et le routage SPA sur l’hébergeur réel. Confirmer les redirections Supabase et l’URL des liens email. Les métadonnées de partage utilisent ce domaine prévu, sans affirmer que son déploiement est vérifié.

Faire compléter et valider les documents juridiques : identité de l’éditeur, adresse, immatriculation, directeur de publication, contacts actifs, hébergeur du site et des données, région d’hébergement, sous-traitants, transferts, durées de conservation et modalités de suppression. Confirmer l’offre commerciale avant de prévoir des CGV ; aucun paiement n’est présent dans ce dépôt.

## Import et envoi des devis

L’import accepte un PDF ou une photo lisible. La reconnaissance s’effectue dans le navigateur ; les champs incertains restent à vérifier. Le montant présenté est TTC. Une correspondance client doit reposer sur des coordonnées précises, jamais seulement sur un nom similaire. Le document original reste visible pour permettre la vérification.

Créer un devis produit un brouillon. « Déjà envoyé » demande une date et ouvre le suivi sans envoyer de message. L’envoi dans Cadova présente le destinataire, l’objet, le message et le PDF avant confirmation. Le statut « Envoyé » correspond à l’acceptation du message par le service email ; ne pas prétendre qu’il a été lu. Un état incertain doit rester explicite et bloquer une nouvelle tentative susceptible de créer un doublon.

Les relances automatiques s’activent explicitement pour chaque devis envoyé, après vérification de leur calendrier et de leur contenu. Une réponse enregistrée, une acceptation, un refus ou l’expiration du devis arrête les prochains envois.
