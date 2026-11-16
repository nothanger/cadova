# Repères pour les agents

## Objectif et autonomie

Cadova suit les clients, devis, relances et interventions des artisans et petites entreprises. Communiquer en français, avec des réponses courtes sauf si la tâche mérite du détail.

Économiser les explorations répétées, sans réduire la qualité ni l'autonomie. Choisir les moyens adaptés, poursuivre le travail autorisé jusqu'au résultat vérifié et prendre les décisions techniques courantes sans demander confirmation. Explorer plus largement, refactoriser et compléter les tests dès que les dépendances, un échec ou le risque le justifient. Aucun plafond de fichiers lus, de commandes ou de tests.

## Retrouver le contexte

- À la reprise ou sans contexte : lire [docs/STATUS.md](docs/STATUS.md), puis les entrées utiles de [docs/PROJECT_MAP.md](docs/PROJECT_MAP.md). Vérifier l'état Git et les changements pertinents ; ces notes peuvent vieillir.
- Avec une tâche précise : aller directement au module concerné. Ne pas relire toute la documentation à chaque demande.
- Le code, la configuration et les résultats observés font foi. Les notes orientent la recherche ; elles ne prouvent pas le fonctionnement en production.
- Consulter [UX.md](UX.md) pour les parcours, [DESIGN.md](DESIGN.md) pour l'interface et [README.md](README.md) pour l'installation et les services.

## Travail efficace

- Chercher avec `rg` / `rg --files`, lire les portions utiles et regrouper les lectures indépendantes. Élargir la recherche si nécessaire.
- Conserver les conclusions déjà vérifiées dans la session. Afficher des résumés de sortie ; garder les erreurs utiles au diagnostic.
- Pendant le développement, cibler les vérifications concernées. Avant de terminer, effectuer les contrôles adaptés à l'impact réel, y compris les parcours transversaux si nécessaire. Ne pas relancer un contrôle identique réussi sans changement pertinent ou doute nouveau.
- Pour une modification de documentation seule, vérifier les chemins, commandes et différences Git ; les tests de l'application ne sont pas nécessaires.
- À la fin d'un travail qui change l'état du projet, actualiser brièvement `docs/STATUS.md` : résultat, vérifications, limites et prochaine étape. Remplacer les informations périmées plutôt qu'empiler les comptes rendus. Actualiser la carte si les points d'entrée changent.

## Commandes

Outils prévus : Node 22 et pnpm 10.34.3 (`.mise.toml`). Scripts disponibles dans `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm build
# Exemple de test unitaire ciblé :
pnpm exec tsx --test tests/quote-situation.test.ts
```

Les contrôles des fonctions serveur et parcours navigateur sont indiqués dans la carte. En cas de problème d'outillage, diagnostiquer l'environnement avant de modifier les dépendances du projet.

## Raccourcis de conversation

Ces expressions sont des conventions, pas des commandes exécutables. Elles conservent le contexte et la portée de la demande de l'utilisateur.

| Expression                    | Action                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `reprise`                     | Lire le statut, vérifier Git et proposer la prochaine action à partir des faits ; poursuivre la tâche déjà autorisée s'il y en a une. |
| `fin de session`              | Mettre à jour le statut avec travail accompli, contrôles et point de reprise.                                                         |
| `vérifie <module>`            | Utiliser la carte pour choisir les contrôles du module et de ses dépendances ; rapporter les limites.                                 |
| `mode éco`                    | Réduire les relectures, sorties et explications superflues, en conservant la profondeur nécessaire.                                   |
| `analyse approfondie <sujet>` | Étendre l'exploration et les vérifications aux dépendances et risques du sujet.                                                       |

## Contrats du produit

Respecter l'isolation des entreprises, les vérifications Auth/RLS, le stockage privé et l'idempotence des envois. Une acceptation par le service email ne prouve ni livraison ni lecture ; une décision sur le portail n'est pas une signature électronique. Les états inconnus restent explicites.

Garder les secrets hors de Git, des sorties et des variables `VITE_*`. Utiliser des données simulées pour les parcours locaux. Distinguer un test local d'une validation de production. Les migrations et déploiements distants suivent la portée autorisée par l'utilisateur ; `0003_scheduler.sql` contient des placeholders, voir le README avant toute utilisation.
