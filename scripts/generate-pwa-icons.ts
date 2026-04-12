/**
 * Script de génération automatique des icônes PWA
 * Convertit le favicon.svg en PNG pour iOS et Android
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
  { size: 180, filename: 'apple-touch-icon.png', desc: 'Apple Touch Icon (iOS)' },
  { size: 192, filename: 'android-chrome-192x192.png', desc: 'Android Chrome 192' },
  { size: 512, filename: 'android-chrome-512x512.png', desc: 'Android Chrome 512 (Maskable)' }
];

console.log('🎨 Génération des icônes PWA Cadova...\n');

// Générer chaque taille
for (const { size, filename, desc } of sizes) {
  try {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(rootDir, 'public', filename));

    console.log(`✅ ${filename} (${size}×${size}px) - ${desc}`);
  } catch (error) {
    console.error(`❌ Erreur pour ${filename}:`, error instanceof Error ? error.message : 'Erreur inconnue');
  }
}

console.log('\n🎉 Toutes les icônes ont été générées dans /public !');
console.log('💡 Les utilisateurs verront maintenant le logo Cadova sur leur écran d\'accueil.');
