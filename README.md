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

## Vérification

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:ui
pnpm test:scene
```

`test:ui` démarre et arrête son propre serveur Vite sur le port 8446 et utilise Chromium installé sur la machine. `CHROMIUM_PATH` permet d’indiquer son exécutable (par défaut `/usr/bin/chromium`). Le test couvre les routes publiques et privées, quatre largeurs d’écran, l’accessibilité axe et les interactions principales. Les données Supabase y sont **simulées uniquement dans le navigateur de test** ; elles ne sont ni intégrées à l’application, ni envoyées à un projet réel. Les captures sont enregistrées dans `.cache/ui`, ignoré par Git. Ces vérifications ne remplacent pas une recette avec le projet Supabase réel.

L’aperçu de partage se régénère avec `pnpm assets:social`, également via Chromium. Il réutilise le logo et les couleurs de Cadova, sans chiffres ni données fictives.

`test:scene` vérifie spécifiquement le logo 3D : rendu visible et cadrage sur quatre largeurs, les quatre chapitres du parcours, leur lisibilité sur mobile, la navigation clavier, la pause, la reprise, le rejeu, la réduction du mouvement et le repli sans WebGL. Il démarre son serveur sur le port 8448 et utilise la même simulation Supabase ; `TEST_BASE_URL` permet de réutiliser un serveur existant.

## Production

Le domaine prévu dans `CNAME` est `cadova.fr`. Vérifier DNS, HTTPS, chemins des fichiers publics et fallback des routes SPA sur l’hébergeur réel. Configurer les redirections d’authentification Supabase et l’URL publique des emails. Les pages légales indiquent les informations encore manquantes ; elles doivent être complétées et validées avant publication.

Limites préexistantes à vérifier côté backend : le cron et la fonction email utilisent actuellement un horaire et un délai fixes, indépendants de certaines préférences de l’interface. Aucune modification de base de données ou de fonction distante n’est effectuée par la refonte visuelle.
