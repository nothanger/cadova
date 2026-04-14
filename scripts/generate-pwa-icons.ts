/**
 * Script de generation automatique des icones PWA
 * Utilise le favicon SVG centre comme source unique pour iOS et Android
 */

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Lire le SVG source
const svgBuffer = readFileSync(join(rootDir, 'public', 'favicon.svg'));

// Tailles requises pour PWA
const sizes = [
  {
    size: 180,
    filenames: ['cadova-apple-touch-icon.png', 'apple-touch-icon.png'],
    desc: 'Apple Touch Icon (iOS)',
  },
  {
    size: 192,
    filenames: ['cadova-android-chrome-192x192.png', 'android-chrome-192x192.png'],
    desc: 'Android Chrome 192',
  },
  {
    size: 512,
    filenames: ['cadova-android-chrome-512x512.png', 'android-chrome-512x512.png'],
    desc: 'Android Chrome 512 (Maskable)',
  }
];

console.log('🎨 Génération des icônes PWA Cadova...\n');

// Generer chaque taille
for (const { size, filenames, desc } of sizes) {
  try {
    const output = await sharp(svgBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    for (const filename of filenames) {
      await sharp(output).toFile(join(rootDir, 'public', filename));
      console.log(`✅ ${filename} (${size}x${size}px) - ${desc}`);
    }
  } catch (error) {
    console.error(`❌ Erreur pour ${size}px:`, error instanceof Error ? error.message : 'Erreur inconnue');
  }
}

console.log('\n🎉 Toutes les icones ont ete generees dans /public !');
console.log('💡 Les utilisateurs verront maintenant le logo Cadova centre sur leur ecran d\'accueil.');
