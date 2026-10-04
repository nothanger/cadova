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

## Vérification

```sh
pnpm typecheck
pnpm typecheck:admin
pnpm typecheck:followups
pnpm lint
pnpm test
pnpm build
pnpm test:ui
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

`test:scene` vérifie spécifiquement le logo 3D : rendu visible et cadrage sur quatre largeurs, les quatre chapitres du parcours, leur lisibilité sur mobile, la navigation clavier, la pause, la reprise, le rejeu, la réduction du mouvement et le repli sans WebGL. Il démarre son serveur sur le port 8448 et utilise la même simulation Supabase ; `TEST_BASE_URL` permet de réutiliser un serveur existant.

## Production

Le domaine prévu dans `CNAME` est `cadova.fr`. `vercel.json` permet l’ouverture directe des routes React, notamment `/login` et `/admin`, sur Vercel. Vérifier DNS, HTTPS, chemins des fichiers publics et le fallback des routes SPA si l’hébergeur change. Configurer les redirections d’authentification Supabase et l’URL publique des emails. Les pages légales indiquent les informations encore manquantes ; elles doivent être complétées et validées avant publication.

Dans Supabase Auth, `site_url` est `https://www.cadova.fr`, le domaine canonique du site. `uri_allow_list` doit autoriser `https://cadova.fr`, `https://cadova.fr/**`, `https://www.cadova.fr` et `https://www.cadova.fr/**`. L’inscription demande un retour vers l’origine du site, et la réinitialisation du mot de passe vers `/reset-password`. Ces paramètres sont gérés dans Supabase, indépendamment du déploiement Vercel ; ne pas remettre l’ancienne adresse Figma dans l’URL du site.

## Relances automatiques des devis

Dans **Paramètres → Email de réponse**, le propriétaire renseigne l’adresse à laquelle les clients répondront. Il peut aussi mettre en pause tous les envois de son entreprise. La pause ne modifie pas les calendriers individuels.

Dans le détail d’un devis envoyé, **Relances automatiques** permet de modifier le sujet et le message, vérifier l’aperçu et choisir les deux délais. Les valeurs initiales sont J+5 et J+12 après la date d’envoi, à 9 h à Paris. Les variables acceptées sont `{{client_name}}`, `{{quote_reference}}`, `{{company_name}}` et `{{amount_formatted}}` ; les espaces autour du nom sont acceptés. L’activation est explicite et limitée à ce devis ; elle nécessite un email client, une adresse de réponse et un service email prêt. Aucun devis existant n’est activé par l’installation.

Les envois s’arrêtent si le devis est accepté, refusé ou expiré, si l’activation est retirée ou si une réponse est enregistrée dans Cadova. Utiliser **Enregistrer une réponse** pour cela ; une simple note ne bloque pas le calendrier. Cadova ne lit pas les réponses dans la boîte email. Une pause peut être reprise. Le délai entre les deux étapes est conservé même si le premier envoi arrive en retard.

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
