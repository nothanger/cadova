
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');


const svgBuffer = readFileSync(join(rootDir, 'public', 'favicon.svg'));


const sizes = [
  {
    size: 180,
    filenames: ['cadova-apple-touch-icon.png', 'apple-touch-icon.png'],
    desc: 'Apple Touch Icon (iOS)',
    iconScale: 0.8,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  },
  {
    size: 192,
    filenames: ['cadova-android-chrome-192x192.png', 'android-chrome-192x192.png'],
    desc: 'Android Chrome 192',
    iconScale: 1,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
  {
    size: 512,
    filenames: ['cadova-android-chrome-512x512.png', 'android-chrome-512x512.png'],
    desc: 'Android Chrome 512 (Maskable)',
    iconScale: 1,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  }
];

console.log('🎨 Génération des icônes PWA Cadova...\n');


for (const { size, filenames, desc, iconScale, background } of sizes) {
  try {
    const iconSize = Math.round(size * iconScale);

    const icon = await sharp(svgBuffer)
      .resize(iconSize, iconSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const output = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background,
      },
    })
      .composite([{ input: icon, gravity: 'center' }])
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
