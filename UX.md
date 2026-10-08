# Cadova : un dossier, une prochaine étape

## Problème observé

La navigation et les fiches juxtaposaient les fonctions avant de montrer le besoin du client. Un brouillon proposait une relance alors que son envoi initial était sous l’historique. L’accueil connaissait les automatisations et réponses, mais les listes utilisaient un seuil fixe de trois jours. Les réglages mélangeaient coordonnées d’entreprise, préférences personnelles et modèles. Sur mobile, les tableaux obligeaient à chercher les actions hors de l’écran.

## Architecture retenue

- **Aujourd’hui** : dossiers à traiter, une priorité dominante par devis et les autres signaux en complément. Les relances réellement programmées par Cadova et les rappels qui nécessitent l’utilisateur restent séparés. Le bilan est consultable à la demande.
- **Devis** : les dossiers et leur prochaine étape. Le statut commercial reste distinct de la situation de suivi. Les vues par étape n’inventent aucun statut stocké.
- **Clients** : retrouver les coordonnées et les devis d’une personne, puis commencer un dossier avec ce client sélectionné.
- **Fiche devis** : identité compacte, prochaine étape, espace pertinent, historique commun, informations et outils secondaires accessibles.
- **Paramètres** : Entreprise, Messages, Mon suivi, Compte. Le délai personnel concerne les rappels manuels ; il ne modifie pas les séquences automatiques.
- **Aide Cadova** : support de la plateforme, distinct des échanges avec le client d’un devis.

Les routes métier et les liens privés sont conservés. Les liens d’action utilisent une intention contrôlée `?focus=…` pour ouvrir et rejoindre la bonne zone. Les composants repliés conservent les saisies en cours. Sur mobile, la navigation principale est directe et les dossiers sont lisibles sans défilement horizontal.

## Situations et responsabilités

| Situation connue                  | Ce que l’interface met en avant                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Brouillon                         | Vérifier le document et préparer l’envoi ; déclarer « déjà envoyé » reste une alternative explicite. |
| Envoi en cours ou incertain       | Vérifier le résultat du même envoi, jamais suggérer de recommencer sans vérification.                |
| Question non répondue             | Lire et répondre dans les échanges.                                                                  |
| Incident de livraison             | Examiner l’incident et les coordonnées.                                                              |
| Réponse déjà reçue                | Consulter l’historique et choisir la suite ; ne pas enregistrer automatiquement une seconde réponse. |
| Séquence automatique active       | Montrer la prochaine date et préciser les conditions ; aucune injonction manuelle contradictoire.    |
| Pause ou service indisponible     | Expliquer la suspension ou la vérification nécessaire.                                               |
| Rappel manuel                     | Préciser que l’utilisateur doit préparer et envoyer le message.                                      |
| Séquence terminée ou devis expiré | Faire le point sur le dossier.                                                                       |
| Accepté                           | Planifier et suivre l’intervention, selon son état réellement chargé.                                |
| Refusé ou intervention terminée   | Conserver l’historique et les actions rares, sans relance proposée en priorité.                      |
| Sources indisponibles             | Afficher un suivi non vérifié et un réessai ; aucune donnée fictive ou valeur zéro de substitution.  |

La projection de présentation réutilise `buildWorkspaceActions` et `resolveQuoteSituation`. Elle ne donne aucune nouvelle permission et ne déclenche aucun envoi. Les lectures sont rattachées au compte et à l’entreprise actifs ; les réponses de requêtes périmées sont ignorées.

Les actions ouvrent leur destination réelle : coordonnées du client, résultat de l’envoi initial ou résultat de la relance. Les dates d’expiration et les heures d’envoi automatique suivent les règles existantes du serveur, à l’heure de Paris. Une réponse ou une décision enregistrée actualise aussi les relances visibles dans le dossier, sans attendre le rafraîchissement périodique.

## Contrats métier préservés

Les politiques RLS, migrations, liens privés, stockage des documents, fonctions serveur, signatures Resend, jobs, calendriers et protections d’idempotence ne sont pas modifiés par cette refonte. Accepter un envoi ne prouve ni sa livraison ni sa lecture. Enregistrer une relance manuelle n’envoie aucun email. Publier une réponse dans le portail ne déclenche pas un email supplémentaire. Déclarer un devis déjà envoyé nécessite une date et un enregistrement explicite.

L’erreur de lecture d’une entreprise ne renvoie plus vers la création d’un nouvel espace. Une préférence non chargée n’est pas enregistrable sous une valeur par défaut. La préférence historique de résumé quotidien est conservée sans annoncer un service actuellement non actif.

## Validation

Vérifier les transitions brouillon → envoyé → réponse → décision → intervention, les erreurs et résultats incertains, la préservation des saisies, les changements d’entreprise administrateur, les notifications et les permissions. Réutiliser les tests documentaires, de portail, d’automatisation, d’historique et d’intervention. Les tests navigateur utilisent des données explicitement simulées, sans envoi à de vrais clients.

Contrôler TypeScript, lint, compilation et tests de domaine, puis les parcours clavier et responsive à 320, 390, 768 et 1280 px. Ces contrôles ne remplacent pas un test d’usage avec un artisan qui découvre le produit.
