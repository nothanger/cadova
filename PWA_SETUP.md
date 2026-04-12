# 📱 Configuration du Logo Cadova comme PWA (Progressive Web App)

Ce guide vous explique comment configurer Cadova pour qu'elle apparaisse comme une vraie application sur l'écran d'accueil iOS et Android.

## 🎨 Fichiers créés

### 1. **CadovaIcon.tsx** (`/src/app/components/CadovaIcon.tsx`)
Composant React SVG du logo simplifié avec :
- Cerveau stylisé avec dégradés violet/indigo
- Lettre "C" pour Cadova
- Optimisé pour toutes les tailles (180px à 512px)

### 2. **Générateur d'icônes** (`/src/app/icon-generator.tsx`)
Page interactive pour télécharger les icônes PNG :
- 📱 **180×180px** : Apple Touch Icon (iOS)
- 🤖 **192×192px** : Android Chrome
- 🎯 **512×512px** : Haute résolution / Maskable

### 3. **favicon.svg** (`/public/favicon.svg`)
Favicon SVG du cerveau Cadova avec les couleurs de la marque.

### 4. **manifest.json** (`/public/manifest.json`)
Configuration PWA avec :
- Métadonnées de l'app (nom, description, couleurs)
- Références aux icônes
- Raccourcis vers les modules (ReussIA, OralIA, TrackIA)

## 🚀 Comment utiliser

### Étape 1 : Générer les icônes PNG

1. **Ouvrez le générateur** :
   ```
   http://localhost:5173/generate-icons
   ```

2. **Téléchargez les 3 icônes** :
   - Cliquez sur "⬇️ Télécharger" sous chaque icône
   - Les fichiers seront automatiquement téléchargés avec les bons noms :
     - `apple-touch-icon.png`
     - `android-chrome-192x192.png`
     - `android-chrome-512x512.png`

3. **Placez les fichiers** :
   - Copiez les 3 fichiers PNG dans le dossier `/public`
   - Ils doivent être au même niveau que `favicon.svg` et `manifest.json`

### Étape 2 : Vérifier la structure

Votre dossier `/public` devrait contenir :

```
/public
├── favicon.svg                     ✅ (déjà créé)
├── manifest.json                   ✅ (déjà créé)
├── apple-touch-icon.png           ⬇️ (à télécharger)
├── android-chrome-192x192.png     ⬇️ (à télécharger)
└── android-chrome-512x512.png     ⬇️ (à télécharger)
```

### Étape 3 : Ajouter à l'écran d'accueil

#### Sur iOS (Safari) :

1. Ouvrez Cadova dans **Safari**
2. Appuyez sur le bouton **Partager** (icône carré avec flèche)
3. Sélectionnez **"Sur l'écran d'accueil"**
4. Confirmez → Le logo Cadova apparaît ! 🎉

#### Sur Android (Chrome) :

1. Ouvrez Cadova dans **Chrome**
2. Appuyez sur **Menu** (⋮)
3. Sélectionnez **"Ajouter à l'écran d'accueil"**
4. Confirmez → Le logo Cadova apparaît ! 🎉

## 🎨 Design du logo

Le logo combine :
- **Cerveau stylisé** : Représente l'IA et l'intelligence
- **Dégradés violet/indigo** : Couleurs de la marque Cadova (#B84DCE, #9540A7, #4E1D58)
- **Lettre "C"** : Identité de la marque
- **Fond sombre** : Élégance et modernité (#2B1430)

## 🔧 Personnalisation

### Changer les couleurs

Éditez `/src/app/components/CadovaIcon.tsx` et modifiez les gradients dans la section `<defs>`.

### Modifier le logo

Le composant `CadovaIcon` utilise des paths SVG. Vous pouvez :
- Ajuster les formes du cerveau
- Changer la lettre "C"
- Modifier les opacités et effets

### Mettre à jour le manifest

Éditez `/public/manifest.json` pour :
- Changer le nom de l'app
- Modifier les couleurs de thème
- Ajouter/retirer des raccourcis

## 📦 Intégration dans le HTML

Les métadonnées PWA sont automatiquement ajoutées dans le `<head>` :

```html
<!-- Favicon -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />

<!-- Apple Touch Icon -->
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />

<!-- Web App Manifest -->
<link rel="manifest" href="/manifest.json" />

<!-- Métadonnées PWA -->
<meta name="theme-color" content="#B84DCE" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

## ✨ Résultat final

Une fois configurée, Cadova aura :
- ✅ Un **logo professionnel** sur l'écran d'accueil
- ✅ Un **splash screen** au lancement
- ✅ Une **barre de statut** aux couleurs de la marque
- ✅ Une **expérience native** en plein écran
- ✅ Des **raccourcis** vers les modules principaux (iOS)

## 🐛 Dépannage

### Le logo n'apparaît pas sur iOS
- Vérifiez que les fichiers PNG sont bien dans `/public`
- Rechargez la page et réessayez "Sur l'écran d'accueil"
- Assurez-vous que les dimensions sont exactes (180×180px)

### Le logo est pixelisé
- Utilisez bien les fichiers PNG générés (pas le SVG)
- Vérifiez que la taille est correcte (512×512px pour haute résolution)

### Le manifest ne charge pas
- Vérifiez que `/public/manifest.json` existe
- Ouvrez les DevTools → Application → Manifest pour voir les erreurs
- Assurez-vous que le serveur sert correctement le dossier `/public`

## 🎯 Prochaines étapes

1. **Service Worker** : Ajouter un service worker pour le mode hors ligne
2. **Notifications Push** : Activer les notifications pour les rappels d'entretiens
3. **Installation automatique** : Prompt d'installation au premier chargement

---

**Fait avec ❤️ pour Cadova**
