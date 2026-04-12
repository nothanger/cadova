# 🚀 Guide d'implémentation Stripe Checkout - Cadova®

Ce guide vous explique comment configurer et activer le système de paiement Stripe Checkout dans votre application e-commerce Cadova®.

## ⚠️ Important

**Figma Make n'est pas conçu pour collecter des données personnelles identifiables (PII) ou traiter de vraies transactions de paiement.** Cette implémentation est à des fins de démonstration et d'apprentissage uniquement.

---

## 📋 Prérequis

Avant de commencer, vous aurez besoin de :

1. ✅ **Compte Stripe** (gratuit) - [S'inscrire sur stripe.com](https://stripe.com)
2. ✅ **Supabase connecté** (déjà fait ✓)
3. ✅ **Clés API Stripe** (expliqué ci-dessous)

---

## 🔑 Étape 1 : Obtenir vos clés API Stripe

### 1.1 Créer un compte Stripe

1. Allez sur [stripe.com](https://stripe.com) et cliquez sur "S'inscrire"
2. Remplissez les informations de votre entreprise
3. **Mode test** : Commencez en mode test (aucune carte réelle ne sera débitée)

### 1.2 Trouver vos clés API

1. Connectez-vous à votre [Dashboard Stripe](https://dashboard.stripe.com)
2. Cliquez sur **"Développeurs"** dans le menu de gauche
3. Cliquez sur **"Clés API"**
4. Vous verrez deux types de clés :

   **🔓 Clé publique (Publishable key)** - Pour le frontend
   ```
   pk_test_51xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   
   **🔒 Clé secrète (Secret key)** - Pour le backend UNIQUEMENT
   ```
   sk_test_51xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

⚠️ **IMPORTANT** : Ne partagez JAMAIS votre clé secrète ! Elle doit rester confidentielle.

---

## 🔧 Étape 2 : Configurer les variables d'environnement Supabase

Vous devez ajouter vos clés Stripe comme secrets dans Supabase :

### 2.1 Accéder aux secrets Supabase

1. Allez dans votre [Dashboard Supabase](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Dans le menu de gauche, cliquez sur **"Edge Functions"**
4. Cliquez sur l'onglet **"Secrets"**

### 2.2 Ajouter les secrets

Ajoutez les 3 secrets suivants :

| Nom du secret | Valeur | Description |
|--------------|--------|-------------|
| `STRIPE_SECRET_KEY` | `sk_test_...` | Votre clé secrète Stripe (test) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Secret du webhook (voir étape 3) |
| `FRONTEND_URL` | `https://votre-app.com` | URL de votre app frontend |

**Commande CLI (optionnel)** :
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_votre_cle_ici
supabase secrets set FRONTEND_URL=https://votre-app.com
```

---

## 🪝 Étape 3 : Configurer les Webhooks Stripe (Optionnel mais recommandé)

Les webhooks permettent à Stripe de notifier votre backend quand un paiement réussit.

### 3.1 Créer un endpoint webhook

1. Dans votre [Dashboard Stripe](https://dashboard.stripe.com), allez dans **"Développeurs" > "Webhooks"**
2. Cliquez sur **"+ Ajouter un endpoint"**
3. **URL de l'endpoint** : 
   ```
   https://[VOTRE_PROJECT_ID].supabase.co/functions/v1/make-server-0a5eb56b/webhook
   ```
   Remplacez `[VOTRE_PROJECT_ID]` par votre ID de projet Supabase

4. **Événements à écouter** :
   - `checkout.session.completed` ✅ (obligatoire)
   - `payment_intent.payment_failed` (recommandé)

5. Cliquez sur **"Ajouter un endpoint"**

### 3.2 Récupérer le secret du webhook

1. Cliquez sur votre webhook nouvellement créé
2. Cliquez sur **"Afficher le secret de signature"**
3. Copiez la clé qui commence par `whsec_...`
4. Ajoutez-la dans Supabase Secrets (voir étape 2.2)

---

## 🧪 Étape 4 : Tester avec des cartes de test

Stripe fournit des numéros de carte de test pour le mode test :

### Cartes de test Stripe

| Numéro de carte | CVV | Date d'expiration | Résultat |
|----------------|-----|-------------------|----------|
| `4242 4242 4242 4242` | N'importe quel | Toute date future | ✅ Paiement réussi |
| `4000 0000 0000 9995` | N'importe quel | Toute date future | ❌ Paiement refusé |
| `4000 0025 0000 3155` | N'importe quel | Toute date future | 🔐 Authentification 3D Secure |

**Exemples de saisie** :
- **Email** : n'importe quel email valide (`test@test.com`)
- **Date d'expiration** : N'importe quelle date future (ex: `12/25`)
- **CVV** : N'importe quel code à 3 chiffres (ex: `123`)

[Liste complète des cartes de test](https://stripe.com/docs/testing#cards)

---

## ✅ Étape 5 : Vérifier que tout fonctionne

### 5.1 Test du flux de paiement

1. Ajoutez des produits à votre panier
2. Allez sur la page **Checkout**
3. Remplissez le formulaire avec des informations de test
4. Cliquez sur **"Confirmer la commande"**
5. Vous serez redirigé vers **Stripe Checkout** (page hébergée par Stripe)
6. Utilisez une carte de test : `4242 4242 4242 4242`
7. Validez le paiement
8. Vous serez redirigé vers la page de **succès** avec votre numéro de commande

### 5.2 Vérifier dans Stripe Dashboard

1. Allez dans **"Paiements"** sur votre Dashboard Stripe
2. Vous devriez voir votre paiement de test
3. Cliquez dessus pour voir tous les détails

### 5.3 Vérifier dans Supabase

1. Les commandes sont stockées dans la base de données Supabase
2. Allez dans **Supabase Dashboard > Table Editor**
3. La table `kv_store_0a5eb56b` contient vos sessions et commandes

---

## 🌍 Étape 6 : Passer en production (plus tard)

Quand vous serez prêt à accepter de vrais paiements :

### 6.1 Activer le compte Stripe

1. Complétez la configuration de votre compte Stripe
2. Fournissez les informations légales et bancaires
3. Activez le mode production

### 6.2 Utiliser les clés de production

1. Récupérez vos clés de **production** (commencent par `pk_live_...` et `sk_live_...`)
2. Remplacez les clés de test par les clés de production dans Supabase Secrets
3. Créez un nouveau webhook pour la production

### 6.3 Configuration supplémentaire

- ⚠️ Configurez un vrai serveur SMTP pour les emails de confirmation
- 📧 Personnalisez les emails Stripe dans **Paramètres > Emails**
- 🔔 Configurez des notifications pour vous alerter des paiements
- 🌐 Ajoutez votre nom de domaine personnalisé

---

## 🎨 Architecture technique

```
Frontend (React)                Backend (Supabase)              Stripe
     │                                 │                           │
     │─1. Soumettre formulaire───────>│                           │
     │   (infos client + panier)       │                           │
     │                                 │                           │
     │                                 │─2. Créer session Checkout─>│
     │                                 │   (items, prix, URLs)      │
     │                                 │<──3. Session URL + ID──────│
     │<─4. Retourner URL───────────────│                           │
     │                                                               │
     │─5. Redirection vers Stripe Checkout───────────────────────>│
     │   (interface hébergée par Stripe)                            │
     │                                                               │
     │   🔐 Paiement sécurisé (3D Secure, cartes, Apple Pay...)    │
     │                                                               │
     │<─6. Redirection après paiement─────────────────────────────┤
     │   (success ou cancel)                                        │
     │                                                               │
     │─7. Vérifier le statut──────────>│                           │
     │   (avec session_id)              │                           │
     │                                 │─8. Récupérer session──────>│
     │                                 │<──9. Détails paiement──────│
     │<─10. Confirmer & afficher───────│                           │
     │                                 │                           │
     │                                 │<─11. Webhook (async)──────│
     │                                 │   (confirme le paiement)  │
```

---

## 🛠️ Routes API créées

Votre backend Supabase expose maintenant ces routes :

### 1. **POST** `/make-server-0a5eb56b/create-checkout-session`

Crée une session Stripe Checkout et retourne l'URL de paiement.

**Request Body** :
```json
{
  "items": [
    {
      "product": {
        "id": "brush-white",
        "name": "Brosse Cadova® - Blanc",
        "price": 14.99,
        "image": "https://..."
      },
      "quantity": 2
    }
  ],
  "customerInfo": {
    "firstName": "Jean",
    "lastName": "Dupont",
    "email": "jean@example.com",
    "phone": "+33612345678",
    "address": "123 rue Example",
    "city": "Paris",
    "postalCode": "75001",
    "country": "France"
  }
}
```

**Response** :
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

### 2. **GET** `/make-server-0a5eb56b/checkout-session/:sessionId`

Vérifie le statut d'une session de paiement après redirection.

**Response** :
```json
{
  "status": "paid",
  "orderNumber": "CDV-12345678",
  "customerEmail": "jean@example.com",
  "totalAmount": 29.98
}
```

### 3. **POST** `/make-server-0a5eb56b/webhook`

Reçoit les événements de Stripe (webhooks) pour confirmer les paiements.

---

## 📚 Ressources utiles

### Documentation officielle

- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

### Support

- [Stripe Support](https://support.stripe.com/)
- [Supabase Discord](https://discord.supabase.com/)

---

## ❓ FAQ

### Q : Le paiement ne fonctionne pas, que faire ?

1. Vérifiez que vous avez bien ajouté `STRIPE_SECRET_KEY` dans Supabase Secrets
2. Regardez les logs dans Supabase Dashboard > Edge Functions > Logs
3. Vérifiez la console navigateur pour les erreurs JavaScript
4. Assurez-vous d'utiliser une carte de test valide en mode test

### Q : Comment tester sans vraie carte bancaire ?

Utilisez les cartes de test Stripe (voir Étape 4). En mode test, aucune vraie transaction n'est effectuée.

### Q : Puis-je personnaliser la page Stripe Checkout ?

Oui ! Dans votre Dashboard Stripe :
1. Allez dans **Paramètres > Branding**
2. Ajoutez votre logo, couleurs de marque, etc.
3. La page Stripe Checkout utilisera automatiquement votre branding

### Q : Comment activer Apple Pay / Google Pay ?

Apple Pay et Google Pay sont automatiquement disponibles sur Stripe Checkout si :
- L'utilisateur a configuré Apple Pay / Google Pay sur son appareil
- Votre site utilise HTTPS (obligatoire)

### Q : Stripe prend-il une commission ?

Oui, Stripe prend **1,4% + 0,25€** par transaction réussie en Europe.
[Voir la tarification complète](https://stripe.com/fr/pricing)

---

## 🎉 Félicitations !

Vous avez maintenant un système de paiement professionnel et sécurisé dans votre application Cadova® !

**Prochaines étapes suggérées** :
- 📧 Configurer l'envoi d'emails de confirmation
- 📦 Intégrer un système de tracking de commandes
- 📊 Ajouter un dashboard admin pour gérer les commandes
- 🎨 Personnaliser le branding Stripe Checkout

---

**Note finale** : Ce système est une démonstration. Pour une production réelle, assurez-vous de respecter toutes les réglementations (RGPD, PCI-DSS, etc.) et de consulter un expert en sécurité des paiements.
