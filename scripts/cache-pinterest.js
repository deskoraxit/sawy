const http = require('http');
const fs = require('fs');
const path = require('path');

const BRIDGE_HOST = '127.0.0.1';
const BRIDGE_PORT = 8787;
const CACHE_FILE = path.join(__dirname, '..', 'cache', 'pinterest-cache.json');
const SEEN = new Map();
let savedCount = 0;

const QUERIES = [
  'nail art', 'nail designs', 'nail art ideas',
  'uñas decoradas', 'diseños de uñas', 'nail inspo',
  'acrylic nails', 'gel nails', 'short nails', 'long nails',
  'uñas acrílicas', 'uñas gel', 'uñas press on', 'uñas esculpidas',
  'uñas rojas', 'uñas rosas', 'uñas blancas', 'uñas negras', 'uñas azules',
  'uñas nude', 'uñas french', 'uñas burdeos', 'uñas lilas', 'uñas verdes',
  'uñas coral', 'uñas grises', 'uñas doradas',
  'uñas minimalistas', 'uñas florales', 'uñas marble', 'uñas glitter',
  'uñas animal print', 'uñas geométricas', 'uñas ombre', 'uñas 3D',
  'uñas stiletto', 'uñas almendra', 'uñas coffin', 'uñas cuadradas',
  'uñas cortas', 'uñas largas',
  'uñas acrílicas rojas', 'uñas gel francesas', 'uñas acrílicas florales',
  'uñas coffin marble', 'uñas stiletto rojas', 'uñas almond nude',
  'uñas glitter doradas', 'uñas ombre rosas',
  'cute nails', 'aesthetic nails', 'trendy nails',
  'elegant nails', 'simple nails',
];

function bridgeSearch(query) {
  return new Promise((resolve, reject) => {
    const url = `http://${BRIDGE_HOST}:${BRIDGE_PORT}/search?q=${encodeURIComponent(query)}`;
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error(`Respuesta inválida: ${body.slice(0, 200)}`)); }
      });
    }).on('error', reject);
  });
}

function saveNow() {
  const allItems = Array.from(SEEN.values());
  fs.writeFileSync(CACHE_FILE, JSON.stringify(allItems, null, 2), 'utf-8');
  savedCount = allItems.length;
  console.log(`  [AUTO-SAVE] ${savedCount} imágenes guardadas`);
}

async function main() {
  console.log('Cacheando Pinterest...\n');

  for (let i = 0; i < QUERIES.length; i += 1) {
    const query = QUERIES[i];

    try {
      process.stdout.write(`  ${i + 1}/${QUERIES.length} "${query}"... `);
      const result = await bridgeSearch(query);
      const items = Array.isArray(result?.items) ? result.items : [];

      for (const item of items) {
        const key = item.image?.split('?')[0];
        if (!key) continue;
        if (SEEN.has(key)) {
          if (!SEEN.get(key).tags.includes(query)) SEEN.get(key).tags.push(query);
        } else {
          SEEN.set(key, { image: key, title: item.title || '', url: item.url || '', tags: [query] });
        }
      }

      console.log(`${items.length} nuevos (total: ${SEEN.size})`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
    }

    // Save every 5 queries
    if ((i + 1) % 5 === 0) saveNow();

    await new Promise((r) => setTimeout(r, 300));
  }

  saveNow();
  console.log(`\n✓ Caché completada: ${savedCount} imágenes de Pinterest en ${CACHE_FILE}`);
  console.log('  Haz commit y push para desplegar en Netlify.');
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
