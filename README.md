# Cadova

Suivi des clients, des devis et des relances pour les artisans, indépendants et petites entreprises. React, TypeScript, Vite et Supabase. Les règles visuelles et les points à confirmer avant production sont dans [DESIGN.md](DESIGN.md).

## Développement

Node 22 et pnpm 10.34.3 sont indiqués dans `.mise.toml`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Le serveur écoute sur le port 8443 par défaut. `PORT` permet de le changer. Le checkout cloud possède ses outils dans `/workspace/.cadova-tools/node_modules/.bin` ; les activer dans `PATH` si nécessaire. Pour réutiliser son store pnpm, ajouter `--store-dir /workspace/.pnpm-store` à l’installation.

Créer un `.env.local` ignoré à partir de `.env.example` et fournir `VITE_SUPABASE_URL` et la clé publique `VITE_SUPABASE_ANON_KEY`. Ne jamais placer une clé `service_role` dans le frontend. Sans configuration, l’application affiche son écran de préparation.

Le projet Supabase doit disposer des migrations métier déjà prévues dans `supabase/migrations`. Vérifier son historique avant d’appliquer quoi que ce soit. Le scheduler `0003_scheduler.sql` contient des placeholders et ne doit pas être exécuté tel quel. Les secrets email sont uniquement côté Supabase.

L’inscription reconnaît les comptes existants signalés par Supabase, y compris les réponses de succès masquées avec des identités vides. Elle propose alors un lien de connexion avec l’email prérempli. Une adresse dont le compte attend encore la confirmation peut recevoir la même réponse qu’une nouvelle inscription : elle conserve le parcours de confirmation. Aucun accès administrateur ni changement de configuration Supabase n’est nécessaire.

## Administration

La route `/admin` permet de consulter les comptes et les entreprises, suspendre ou réactiver un compte, supprimer un compte après confirmation de son email et transférer une entreprise à un autre propriétaire. L’admin peut aussi créer une entreprise, choisir son propriétaire et posséder plusieurs entreprises. Ouvrir une entreprise donne accès à ses clients, devis et paramètres dans l’interface existante. Les comptes ordinaires restent limités à leur entreprise.

La suppression d’une entreprise demande de saisir son nom actuel. Elle retire définitivement ses clients, devis, événements, adhésions et notifications métier, tout en conservant les comptes utilisateurs. La création et la suppression vérifient les droits côté serveur et enregistrent l’action dans le journal de la même transaction. Ces actions nécessitent `0008_admin_company_management.sql`, après `0007_support_notifications.sql`.

Les droits reposent sur `public.platform_admins`, modifiable uniquement côté serveur. Aucun rôle provenant du navigateur ou des métadonnées d’inscription n’accorde un accès administrateur. La fonction Edge `platform-admin` vérifie la session et le rôle à chaque requête ; la clé serveur reste dans Supabase. Les mutations sont journalisées. Une suspension bloque aussi les anciennes sessions dans les règles RLS.

Les comptes administrateurs sont protégés contre la suppression et la suspension dans cette interface. Avant de supprimer le dernier propriétaire d’une entreprise, transférer la propriété pour conserver ses données. Un transfert garde les anciens propriétaires comme membres. Les préférences et notifications personnelles restent propres à chaque compte.

Pour installer l’administration sur un projet dont les migrations métier existent déjà, `scripts/provision-admin.py --inspect` vérifie le projet sans écrire. `--deploy` installe uniquement la migration et la fonction. `--provision` applique `0006_platform_admin.sql`, déploie la fonction Edge, crée un **nouveau** compte confirmé par l’API Auth et vérifie sa connexion et ses droits. Il refuse de remplacer un compte existant et retire uniquement le nouveau compte si sa vérification échoue. Fournir `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` et `SUPABASE_ADMIN_EMAIL` via le gestionnaire de secrets du terminal. `SUPABASE_ADMIN_PASSWORD` peut fournir un mot de passe d’au moins 20 caractères déjà enregistré dans un gestionnaire de mots de passe. Les identifiants sont affichés uniquement après vérification ; conserver cette sortie en lieu sûr. Ne jamais enregistrer ces secrets dans Git ou dans des variables `VITE_*`.

Le script déploie la fonction avec `verify_jwt=false` : le handler vérifie lui-même chaque jeton auprès de Supabase Auth avant d’accéder aux données. Cela accepte aussi les projets utilisant des clés de signature asymétriques. Conserver ce paramètre lors d’un redéploiement manuel et ne jamais retirer la vérification Auth du handler.

## Notifications et messages

La cloche et la page `/notifications` regroupent les rappels, les annonces de l’administration et les échanges privés avec l’admin. Chaque compte connecté peut poser une question, même avant de créer son entreprise. L’onglet Messages conserve la conversation ; marquer une notification comme lue ne supprime pas son contenu.

L’admin consulte les conversations et y répond. « Envoyer une notification » permet de choisir un compte ou tous les comptes actifs, puis de vérifier le titre, le message et les destinataires avant confirmation. L’envoi global couvre les comptes au-delà de la page affichée. Ces notifications restent dans l’application.

Appliquer `0007_support_notifications.sql` après `0006_platform_admin.sql`. Les RPC vérifient l’identité, le rôle et la destination côté serveur, enregistrent le message et ses notifications dans une transaction et reconnaissent les nouvelles tentatives d’un même envoi. Un utilisateur ne peut lire que ses échanges et notifications ; seul l’état de lecture des notifications est modifiable depuis le client. Les annonces de l’administration sont journalisées côté serveur. Les tests de `pnpm test:admin:db` couvrent aussi ces permissions et les envois.

## Importer et envoyer un devis

Dans **Nouveau devis**, importer le PDF original ou prendre une photo. Cadova propose la référence, le montant TTC et les coordonnées du client lorsqu’ils sont reconnaissables. Vérifier et corriger ces champs, choisir un client existant ou en créer un, puis enregistrer le brouillon. Les informations ambiguës restent à compléter : la lecture du document ne vaut pas validation du devis.

Le bouton **Déjà envoyé** demande la date d’envoi et ajoute directement le devis au suivi. Il ne déclenche aucun email. Les devis saisis manuellement conservent le même parcours et peuvent recevoir un PDF depuis leur page de détail.

Pour envoyer un brouillon, ouvrir **Document et envoi**, vérifier l’adresse du client, l’objet et le message, puis confirmer l’aperçu. Cadova joint le PDF importé ; une photo est convertie en PDF. Les réponses vont à l’adresse définie dans les paramètres de l’entreprise. Le devis passe en **Envoyé** uniquement après acceptation par le service email ; l’historique et les notifications enregistrent ce résultat. Les relances automatiques nécessitent ensuite une activation explicite sur le devis.

La lecture PDF et la reconnaissance française se font dans le navigateur, sans service OCR externe. Le premier scan peut télécharger les ressources de lecture depuis le site. Les fichiers sont limités à 10 Mo et les PDF à 10 pages. Les photos JPEG, PNG et WebP sont acceptées ; exporter les photos HEIC en JPEG. Une photo nette, prise face au document, facilite la lecture. Les modèles et ressources sont générés par `pnpm assets:documents`, automatiquement avant `pnpm dev` et `pnpm build` ; `public/document-reader/` ne doit pas être enregistré dans Git.

Le PDF enregistré est conservé dans le bucket privé `quote-documents`. Les accès passent par la session et les règles de l’entreprise. Le contenu exact d’un email tenté, pièce jointe comprise, reste réservé au worker. Un résultat incertain peut être repris avec la même clé et le même contenu, au maximum cinq tentatives dans les 23 heures ; ensuite une vérification manuelle est nécessaire. L’interface ne renvoie pas un email lors d’une simple actualisation. L’acceptation par Resend ne prouve pas la réception ni la lecture par le client.

### Installation de l’import et de l’envoi

La migration `0011_quote_documents.sql` suit l’installation des relances jusqu’à `0010`. Le script utilise `SUPABASE_ACCESS_TOKEN` et `SUPABASE_PROJECT_REF` fournis dans un terminal sécurisé :

```sh
python3 scripts/deploy-quote-documents.py --inspect
python3 scripts/deploy-quote-documents.py --deploy
```

`--inspect` vérifie la présence des tables, RPC, fonction et noms de secrets sans écrire. `--deploy` applique la migration dans une transaction si elle n’existe pas, vérifie le stockage privé et les permissions, déploie `send-quote-document` avec `verify_jwt=false` et contrôle le refus des appels sans session. Le handler valide chaque utilisateur avec Supabase Auth et transmet son véritable JWT à la RPC qui autorise l’envoi. Aucun compte ni email de test n’est créé par le déploiement.

Les envois utilisent les secrets Resend et l’activation `QUOTE_FOLLOWUP_EMAIL_ENABLED` déjà décrits pour les relances. Le nettoyage horaire `cadova-quote-documents-cleanup` réutilise le secret de scheduler existant dans Vault et `QUOTE_FOLLOWUP_SCHEDULER_SECRET`. Sa preuve HMAC est propre à l’action de nettoyage, valable cinq minutes et utilisable une fois ; la clé permanente ne transite pas dans `pg_net`. Les fichiers de devis supprimés sont retirés par ce worker. Les téléversements abandonnés deviennent éligibles après 24 heures. Le navigateur ne peut ni remplacer un fichier existant dans Storage, ni supprimer physiquement un document lié au devis.

Le test réel se lance séparément avec `python3 scripts/test-quote-document-e2e.py --send-to votre-adresse@example.com`, après avoir fourni les deux variables Supabase du terminal et choisi une adresse autorisée. Il envoie un seul email clairement marqué comme test, vérifie le PDF original, l’historique, les droits et l’absence de double envoi, puis retire uniquement ses données et son compte temporaires. Ce test ne fait pas partie de `pnpm test`.

## Vérification

```sh
pnpm typecheck
pnpm typecheck:admin
pnpm typecheck:followups
pnpm typecheck:documents
pnpm typecheck:portal
pnpm typecheck:email-events
pnpm lint
pnpm test
pnpm build
pnpm test:ui
pnpm test:documents
pnpm test:portal
pnpm test:workspace
pnpm test:scene
```

`pnpm test` couvre aussi les permissions et les refus de l’API d’administration. `pnpm test:admin:db` vérifie les règles RLS et les courses entre suppression, transfert et création d’entreprise dans une base PostgreSQL locale jetable. Il nécessite un conteneur nommé `cadova-admin-db` (modifiable avec `ADMIN_TEST_CONTAINER`) ; il n’utilise aucun projet Supabase distant :

```sh
docker run -d --name cadova-admin-db --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17.6
pnpm test:admin:db
docker rm -f cadova-admin-db
```

Attendre que PostgreSQL soit prêt avant de lancer ce test. L’entrée de la fonction Edge se vérifie également avec `pnpm dlx deno@2.5.6 check supabase/functions/platform-admin/index.ts`.

`test:ui` démarre et arrête son propre serveur Vite sur le port 8446 et utilise Chromium installé sur la machine. `CHROMIUM_PATH` permet d’indiquer son exécutable (par défaut `/usr/bin/chromium`). Le test couvre les routes publiques et privées, quatre largeurs d’écran, l’accessibilité axe et les interactions principales. Les données Supabase y sont **simulées uniquement dans le navigateur de test** ; elles ne sont ni intégrées à l’application, ni envoyées à un projet réel. Les captures sont enregistrées dans `.cache/ui`, ignoré par Git. Ces vérifications ne remplacent pas une recette avec le projet Supabase réel.

L’aperçu de partage se régénère avec `pnpm assets:social`, également via Chromium. Il réutilise le logo et les couleurs de Cadova, sans chiffres ni données fictives.

Les icônes se régénèrent avec `pnpm assets:icons`. Le contour du logo est partagé avec la scène 3D. Les favicons SVG/PNG/ICO, l’icône iPhone de 180 px et les icônes d’application de 192/512 px ont un fond opaque et des marges dédiées. La version `maskable` reste dans le cercle de sécurité Android. Le manifest conserve les routes existantes et ouvre `/app`. iOS peut conserver une ancienne icône déjà installée : retirer puis ajouter à nouveau le raccourci après publication.

`test:scene` vérifie spécifiquement le logo 3D : rendu visible et cadrage sur quatre largeurs, les quatre chapitres du parcours, leur lisibilité sur mobile, la navigation clavier, la pause, la reprise, le rejeu, la réduction du mouvement et le repli sans WebGL. Il démarre son serveur sur le port 8448 et utilise la même simulation Supabase ; `TEST_BASE_URL` permet de réutiliser un serveur existant.

`test:documents` vérifie l’import d’un PDF et d’une photo, la correction des informations, le parcours « Déjà envoyé », la vérification avant envoi et les principaux états du document sur mobile. Le backend y est simulé ; la lecture des fichiers utilise les bibliothèques réelles. Les tests unitaires couvrent les extractions prudentes et le worker d’envoi. `test:admin:db` couvre aussi les permissions, les transactions d’import, les réservations d’envoi et le nettoyage. Vérifier l’entrée Edge avec `pnpm dlx deno@2.5.6 check supabase/functions/send-quote-document/index.ts`.

## Production

Le domaine prévu dans `CNAME` est `cadova.fr`. `vercel.json` permet l’ouverture directe des routes React, notamment `/login` et `/admin`, sur Vercel. Vérifier DNS, HTTPS, chemins des fichiers publics et le fallback des routes SPA si l’hébergeur change. Configurer les redirections d’authentification Supabase et l’URL publique des emails. Les pages légales indiquent les informations encore manquantes ; elles doivent être complétées et validées avant publication.

Dans Supabase Auth, `site_url` est `https://www.cadova.fr`, le domaine canonique du site. `uri_allow_list` doit autoriser `https://cadova.fr`, `https://cadova.fr/**`, `https://www.cadova.fr` et `https://www.cadova.fr/**`. L’inscription demande un retour vers l’origine du site, et la réinitialisation du mot de passe vers `/reset-password`. Ces paramètres sont gérés dans Supabase, indépendamment du déploiement Vercel ; ne pas remettre l’ancienne adresse Figma dans l’URL du site.

## Relances automatiques des devis

Dans **Paramètres → Email de réponse**, le propriétaire renseigne l’adresse à laquelle les clients répondront. Il peut aussi mettre en pause les relances automatiques de son entreprise. La pause ne modifie pas les calendriers individuels.

Dans le détail d’un devis envoyé, **Relances automatiques** permet de modifier le sujet et le message, vérifier l’aperçu et choisir les deux délais. Les valeurs initiales sont J+5 et J+12 après la date d’envoi, à 9 h à Paris. Les variables acceptées sont `{{client_name}}`, `{{quote_reference}}`, `{{company_name}}` et `{{amount_formatted}}` ; les espaces autour du nom sont acceptés. L’activation est explicite et limitée à ce devis ; elle nécessite un email client, une adresse de réponse et un service email prêt. Aucun devis existant n’est activé par l’installation.

Les envois s’arrêtent si le devis est accepté, refusé ou expiré, si l’activation est retirée ou si une réponse est enregistrée dans Cadova. Une question sur le suivi client suspend aussi les relances. Utiliser **Enregistrer une réponse** pour les réponses reçues hors de Cadova ; une simple note ne bloque pas le calendrier. Lorsque la réception Resend décrite ci-dessous est activée, les réponses à l’adresse de suivi sont ajoutées automatiquement au dossier. Cadova ne se connecte pas à la boîte personnelle de l’entreprise. Une pause peut être reprise. Le délai entre les deux étapes est conservé même si le premier envoi arrive en retard.

L’historique distingue l’acceptation par le service email, les erreurs et les envois dont le résultat reste incertain. L’acceptation par Resend ne prouve ni la réception ni la lecture par le client. Les résultats apparaissent aussi dans les notifications du compte ayant activé la séquence.

### Installation côté Supabase

Les migrations `0009_quote_email_automation.sql` et `0010_quote_followup_scheduler_auth.sql` doivent suivre `0008`. La file persistante et les RPC vérifient les permissions, l’état du devis et les réservations concurrentes. Le navigateur ne peut ni réclamer un envoi, ni écrire un résultat automatique, ni lire les secrets.

Le script suivant utilise uniquement `SUPABASE_ACCESS_TOKEN` et `SUPABASE_PROJECT_REF`, fournis dans un terminal sécurisé :

```sh
python3 scripts/deploy-quote-followups.py --inspect
python3 scripts/deploy-quote-followups.py --deploy
```

`--inspect` reste en lecture seule. `--deploy` installe les deux migrations une seule fois, déploie `send-quote-followups` et programme le cron `cadova-quote-followups` toutes les cinq minutes. Il conserve le secret de scheduler existant dans Supabase Vault. La commande cron ne contient aucun secret ; la file `pg_net` reçoit seulement une preuve HMAC liée à l’action `run`, valable cinq minutes et utilisable une seule fois. Supabase gère les permissions de son extension réseau ; la clé permanente ne transite donc pas dans cette file. Le script n’active pas l’envoi email, ne crée aucun compte et n’envoie aucun email de test. Redéployer conserve le choix d’activation déjà configuré.

La fonction est déployée avec `verify_jwt=false` et vérifie elle-même les preuves du scheduler avec la clé privée dédiée `QUOTE_FOLLOWUP_SCHEDULER_SECRET`. Les nonces sont consommés atomiquement via une RPC réservée au serveur. Un appel direct d’administration peut utiliser cette clé comme Bearer ; elle ne doit jamais être mise dans une commande cron ou une file réseau. Seules les requêtes POST authentifiées `run` et `health` sont acceptées. `health` synchronise l’état visible du service sans réserver ni envoyer de message. Ne jamais remplacer cette vérification par un simple accès public.

Pour permettre les envois réels, vérifier le domaine d’envoi dans **Resend**, puis renseigner dans **Supabase → Edge Functions → Secrets** :

- `RESEND_API_KEY` : clé Resend autorisée à envoyer ;
- `RESEND_FROM` : adresse d’envoi du domaine vérifié, éventuellement précédée du nom Cadova ;
- `QUOTE_FOLLOWUP_EMAIL_ENABLED=true` : activation du service après configuration.

Ne pas mettre ces valeurs dans `VITE_*`, Git ou le chat. Le worker actualise le statut de configuration au prochain passage. Pour arrêter les nouveaux envois au niveau du service, définir `QUOTE_FOLLOWUP_EMAIL_ENABLED=false`.

Chaque job possède une clé d’idempotence stable et conserve le contenu exact transmis au fournisseur. Les nouvelles tentatives réutilisent cette clé et ce contenu, au maximum cinq fois dans une fenêtre prudente de 23 heures. Un résultat ambigu après cette fenêtre passe en vérification manuelle et bloque une réactivation qui pourrait doubler l’envoi. Un redéploiement ne reconstruit pas le contenu d’un envoi déjà tenté. La clé Resend n’est pas une garantie illimitée : sa durée documentée est de 24 heures.

`pnpm test` inclut les tests du worker avec fournisseur simulé : autorisation, état désactivé, échappement, timeout, reprise et absence de double envoi. `pnpm test:admin:db` couvre également l’isolation entre entreprises, les arrêts et les courses de cette file dans PostgreSQL. Pour vérifier l’entrée Edge :

```sh
pnpm dlx deno@2.5.6 check supabase/functions/send-quote-followups/index.ts
```

La fonction historique `send-followup-reminders`, qui produit un récapitulatif interne, est distincte des emails aux clients. Son ancien scheduler à placeholders reste inutilisable tel quel. Elle demeure désactivée tant que sa propre configuration et sa clé dédiée ne sont pas fournies ; l’installation des relances clients ne l’active pas. Ses préférences et son calendrier historique doivent faire l’objet d’une vérification séparée avant activation.

## Suivi client et suivi des emails

Les nouveaux emails de devis et de relance comportent un lien **Consulter mon devis**. Le destinataire peut télécharger le PDF, poser une question et confirmer une acceptation ou un refus. Ce parcours enregistre une décision ; il ne fournit pas une signature électronique. Le détail du devis permet aussi de créer un lien manuel, de le remplacer et de révoquer tous les accès. Les messages et décisions apparaissent dans le dossier et les notifications de l’entreprise.

Le lien est une autorisation d’accès : le transmettre uniquement au destinataire prévu. Son jeton reste dans le fragment de l’URL, n’est pas enregistré dans le navigateur et seule son empreinte est stockée en base. Le portail ne publie ni notes internes ni coordonnées du client. Les PDF restent dans le stockage privé et sont servis après contrôle du lien. Les nouvelles tentatives d’un email déjà tenté conservent exactement son ancien contenu.

Installer les migrations `0012` à `0014` après les migrations de documents et de relances :

```sh
python3 scripts/deploy-client-followup.py --inspect
python3 scripts/deploy-client-followup.py --deploy
```

Le script utilise les deux variables Supabase du terminal sécurisé. Il vérifie l’empreinte des migrations déjà installées, déploie le portail, le webhook et les deux workers avec leurs dépendances partagées, puis contrôle les refus d’accès. Il ne crée aucun compte et n’envoie aucun email. Pour une installation neuve, exécuter ce script après les déploiements de documents et de relances, avant d’activer les envois. `CADOVA_PUBLIC_URL` peut préciser l’origine Cadova ; la valeur par défaut est `https://www.cadova.fr`.

La livraison confirmée nécessite un webhook **Resend → Webhooks** vers `https://<project-ref>.supabase.co/functions/v1/resend-events`, avec les événements `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.failed` et `email.complained`. Enregistrer son secret de signature dans **Supabase → Edge Functions → Secrets → RESEND_WEBHOOK_SECRET**. Les callbacks non signés sont refusés. Les doublons et événements arrivant dans le désordre ne recréent ni message ni notification. Un retour définitif en erreur suspend les relances ; « accepté par le service » reste distinct de « livré ». Aucun suivi de lecture n’est affiché.

Pour recevoir les réponses dans le dossier :

1. Vérifier un sous-domaine de réception dans Resend, avec ses véritables enregistrements DNS. Préférer un sous-domaine dédié pour conserver les MX de la messagerie existante.
2. Autoriser aussi l’événement `email.received` sur le webhook et fournir une clé Resend autorisée à lire les emails reçus. La création automatique de domaines et webhooks nécessite une clé **Full access**.
3. Définir `RESEND_RECEIVE_DOMAIN` et, une fois la réception vérifiée, `QUOTE_REPLY_EMAIL_ENABLED=true` dans les secrets Supabase. Redéployer les fonctions avec le script ci-dessus.

Les nouveaux envois utilisent alors une adresse de réponse propre au dossier. Une réponse provenant du destinataire connu est ajoutée au suivi et suspend les relances. Les emails déjà tentés conservent leur ancienne adresse de réponse. Sans cette configuration, les réponses continuent d’arriver à l’adresse d’entreprise et doivent être enregistrées manuellement ; le portail fonctionne indépendamment.

`test:portal` couvre le parcours client et la gestion des liens sans requête vers un projet réel. `test:workspace` couvre les actions quotidiennes et le démarrage guidé. Les tests SQL locaux vérifient aussi l’isolation des entreprises, les signatures/reprises d’événements et les décisions concurrentes. Les données de test ne sont pas déployées.
