# Point de reprise

Mis à jour le 16 novembre 2026. Résumé de travail, pas état garanti de production.

## État connu

- Dépôt : `nothanger/cadova`, branche principale `main`.
- Dernier commit applicatif examiné : `490fcf1` du 8 octobre 2026, « rendre les parcours Cadova plus intuitifs ». Parcours et décisions documentés dans `UX.md`.
- Le code comprend clients, import PDF/photo, envoi de devis, relances, portail client, historique, interventions, recherche, modèles et administration.
- Reprise après plus d'un mois d'arrêt. Aucune prochaine fonctionnalité choisie par l'utilisateur pour l'instant.
- Ajout de `AGENTS.md` et de la carte du projet pour faciliter les prochaines sessions sans limiter l'exploration ou la qualité.

## Vérifications effectuées à la reprise

Pour les nouveaux repères : liens locaux, chemins des points d'entrée, noms de tests et scripts documentés vérifiés ; formatage et différences Git contrôlés. Modification documentaire uniquement, sans nouvelle exécution des tests applicatifs.

Sur le code applicatif `490fcf1`, le 16 novembre 2026 : TypeScript, ESLint, 226 tests unitaires et compilation Vite réussis. La compilation signale des bundles de plus de 500 kB. Aucun parcours navigateur ni contrôle de base de données ou de production effectué.

Environnement de cette session : Node 24.22.1 / pnpm 11.25.0, alors que le dépôt prévoit Node 22 / pnpm 10.34.3. L'installation avec pnpm 11 a téléchargé les dépendances puis signalé des scripts de dépendances non autorisés. Les contrôles ont été exécutés avec les binaires locaux de `node_modules/.bin` ; la compilation a été précédée de `node scripts/build-document-assets.mjs`. Ce résultat ne valide pas l'installation avec les versions prévues. Aucun changement de dépendances n'a été conservé.

## Prochaine étape proposée

Tester un dossier complet avec données de test : client → import de devis → vérification et envoi simulé → réponse/décision du client → intervention. Identifier le premier problème concret avant de choisir la prochaine amélioration. Adapter ce point de reprise si l'utilisateur choisit une autre priorité.

## À vérifier selon la prochaine tâche

- Configuration effective de Supabase, migrations, emails et hébergement : non inspectée dans cette session.
- Parcours mobile/clavier et services réels : non validés par les tests unitaires.
- Informations légales et offre : points à confirmer répertoriés dans `DESIGN.md` et le README.

Lors d'une mise à jour, conserver uniquement les faits utiles : travail terminé, contrôles réellement effectués, limites et prochaine action. Ne pas y inscrire de secrets ni de données client.
