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

La route `/admin` permet de consulter les comptes et les entreprises, suspendre ou réactiver un compte, supprimer un compte après confirmation de son email et transférer une entreprise à un autre propriétaire. Ouvrir une entreprise donne accès à ses clients, devis et paramètres dans l’interface existante. Les comptes ordinaires restent limités à leur entreprise.

Les droits reposent sur `public.platform_admins`, modifiable uniquement côté serveur. Aucun rôle provenant du navigateur ou des métadonnées d’inscription n’accorde un accès administrateur. La fonction Edge `platform-admin` vérifie la session et le rôle à chaque requête ; la clé serveur reste dans Supabase. Les mutations sont journalisées. Une suspension bloque aussi les anciennes sessions dans les règles RLS.

Les comptes administrateurs sont protégés contre la suppression et la suspension dans cette interface. Avant de supprimer le dernier propriétaire d’une entreprise, transférer la propriété pour conserver ses données. Un transfert garde les anciens propriétaires comme membres. Les préférences et notifications personnelles restent propres à chaque compte.

Pour installer l’administration sur un projet dont les migrations métier existent déjà, `scripts/provision-admin.py --inspect` vérifie le projet sans écrire. `--deploy` installe uniquement la migration et la fonction. `--provision` applique `0006_platform_admin.sql`, déploie la fonction Edge, crée un **nouveau** compte confirmé par l’API Auth et vérifie sa connexion et ses droits. Il refuse de remplacer un compte existant et retire uniquement le nouveau compte si sa vérification échoue. Fournir `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` et `SUPABASE_ADMIN_EMAIL` via le gestionnaire de secrets du terminal. `SUPABASE_ADMIN_PASSWORD` peut fournir un mot de passe d’au moins 20 caractères déjà enregistré dans un gestionnaire de mots de passe. Les identifiants sont affichés uniquement après vérification ; conserver cette sortie en lieu sûr. Ne jamais enregistrer ces secrets dans Git ou dans des variables `VITE_*`.

Le script déploie la fonction avec `verify_jwt=false` : le handler vérifie lui-même chaque jeton auprès de Supabase Auth avant d’accéder aux données. Cela accepte aussi les projets utilisant des clés de signature asymétriques. Conserver ce paramètre lors d’un redéploiement manuel et ne jamais retirer la vérification Auth du handler.

## Vérification

```sh
pnpm typecheck
pnpm typecheck:admin
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

Le domaine prévu dans `CNAME` est `cadova.fr`. Vérifier DNS, HTTPS, chemins des fichiers publics et fallback des routes SPA sur l’hébergeur réel. Configurer les redirections d’authentification Supabase et l’URL publique des emails. Les pages légales indiquent les informations encore manquantes ; elles doivent être complétées et validées avant publication.

Limites préexistantes à vérifier côté backend : le cron et la fonction email utilisent actuellement un horaire et un délai fixes, indépendants de certaines préférences de l’interface. Aucune modification de base de données ou de fonction distante n’est effectuée par la refonte visuelle.
