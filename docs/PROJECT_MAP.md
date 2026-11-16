# Carte de Cadova

Lire uniquement les entrées utiles à la tâche. Les scripts de `package.json` et le code restent la référence ; cette carte indique où commencer.

## Fondations

| Besoin                               | Points d'entrée                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| Démarrage, routes, accès             | `src/main.tsx`, `src/App.tsx`, `src/app/router.tsx`, `src/app/guards.tsx`            |
| Navigation, composants, styles       | `src/components/layout/`, `src/components/ui/`, `src/index.css`                      |
| Connexion, inscription, récupération | `src/features/auth/`, `src/lib/supabase.ts`, `src/lib/setup.ts`                      |
| Entreprise active, démarrage         | `src/features/company/CompanyContext.tsx`, `src/features/company/GettingStarted.tsx` |
| Types et règles partagées            | `src/types/index.ts`, `src/lib/money.ts`, `src/lib/dates.ts`, `src/lib/followup.ts`  |
| Installation, services, déploiement  | `README.md`, `.env.example`, `.mise.toml`, `vercel.json`, `scripts/`                 |
| Parcours et identité                 | `UX.md`, `DESIGN.md`                                                                 |

## Fonctionnalités et contrôles ciblés

Les noms `test:*` et `typecheck:*` ci-dessous s'utilisent avec `pnpm <nom>`. Les fichiers `*.test.ts` peuvent être lancés individuellement avec `pnpm exec tsx --test tests/<fichier>.test.ts`.

| Sujet                           | Code à consulter d'abord                                                                                                                                | Contrôles pertinents                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Aujourd'hui, priorités          | `src/features/dashboard/`, `src/features/quotes/situation.ts`, `situationApi.ts` dans ce même dossier quotes                                            | `workspace-actions.test.ts`, `quote-situation.test.ts`, `test:workspace`                                                               |
| Clients                         | `src/features/clients/`                                                                                                                                 | `test:clients`                                                                                                                         |
| Liste, création, fiche devis    | `src/features/quotes/QuotesListPage.tsx`, `QuoteFormPage.tsx`, `QuoteDetailPage.tsx`, `api.ts` dans ce même dossier                                     | `domain.test.ts`, `quote-situation.test.ts`, `test:ui` ; compléter selon le parcours touché                                            |
| Import PDF, OCR, photo          | `src/features/quotes/import/`, `src/features/quotes/QuoteImportPanel.tsx`                                                                               | `quote-document-extraction.test.ts`, `quote-import-review.test.ts`, `quote-photo-preparation.test.ts`, `test:documents`, `test:photos` |
| Document et envoi initial       | `src/features/quotes/QuoteDocumentPanel.tsx`, `documentApi.ts` dans ce même dossier, `supabase/functions/send-quote-document/`                          | `quote-document-send.test.ts`, `typecheck:documents`, `test:documents`                                                                 |
| Relances automatiques           | `src/features/quotes/AutomationPanel.tsx`, `automationApi.ts`, `automationMessages.ts` dans ce même dossier, `supabase/functions/send-quote-followups/` | `quote-followup-worker.test.ts`, `typecheck:followups`, `test:workspace`                                                               |
| Portail et décisions client     | `src/features/quote-portal/`, `src/features/quotes/QuoteClientPortalPanel.tsx`, `supabase/functions/quote-client-portal/`                               | `quote-client-portal.test.ts`, `typecheck:portal`, `test:portal`                                                                       |
| Livraison et réponses email     | `supabase/functions/resend-events/`, `supabase/functions/_shared/quote-email-links.ts`, `src/features/quotes/QuoteEmailTrackingPanel.tsx`               | `quote-email-events.test.ts`, `quote-email-links.test.ts`, `typecheck:email-events`                                                    |
| Historique                      | `src/features/quotes/timeline/`                                                                                                                         | `quote-timeline.test.ts`, `test:timeline`                                                                                              |
| Interventions après acceptation | `src/features/quotes/work-orders/`                                                                                                                      | `work-orders.test.ts`, `test:work-orders`                                                                                              |
| Recherche globale               | `src/features/search/`                                                                                                                                  | `search.test.ts`, `test:search`                                                                                                        |
| Paramètres, modèles, signature  | `src/features/settings/`, `src/features/message-templates/`                                                                                             | `company-messages.test.ts`, `test:templates`                                                                                           |
| Notifications et support        | `src/features/notifications/`, `src/features/admin/`                                                                                                    | `test:notification-navigation`, `test:ui`, `admin-api.test.ts` si le backend admin change                                              |
| Administration                  | `src/features/admin/`, `supabase/functions/platform-admin/`                                                                                             | `admin-api.test.ts`, `typecheck:admin`, `test:admin:db`                                                                                |
| Site public et scène 3D         | `src/features/landing/`, `src/features/legal/`, `public/`, `index.html`                                                                                 | `test:scene`, `test:ui` selon la modification                                                                                          |

## Base de données et services

- Schéma, RPC et permissions : `supabase/migrations/`, dans l'ordre numérique. Lire les migrations du domaine et leurs dépendances plutôt que tout l'historique par défaut.
- Les migrations `0009`–`0010` concernent les relances ; `0011` les documents ; `0012`–`0014` le portail et les événements/envois ; `0015` les outils d'entreprise.
- `pnpm test:admin:db` vérifie permissions et transactions dans une base locale jetable ; prérequis et fonctionnement dans `scripts/test-admin-db.mjs` et le README. Les tests SQL sont dans `tests/*.sql`.
- Les entrées Edge sont les `index.ts` ; leurs handlers sont testés localement. Pour une modification serveur, consulter aussi les vérifications Deno documentées dans le README.
- `send-followup-reminders` est le récapitulatif interne historique, distinct des relances client de `send-quote-followups`.
- Les parcours navigateur utilisent `tests/fixtures/` avec Supabase simulé. Ils ne prouvent pas la configuration des services distants.

## Vérification globale d'une modification applicative

Base habituelle : `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. Ajouter les vérifications Edge, base ou navigateur selon ce qui change. Une modification purement documentaire demande une relecture et une vérification des références, pas une nouvelle compilation.
