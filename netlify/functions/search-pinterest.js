const fs = require('fs');
const path = require('path');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function send(status, data) {
  return {
    statusCode: status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(data),
  };
}

const CACHE_PATH = path.resolve(__dirname, '..', '..', 'cache', 'pinterest-cache.json');

function loadCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    const raw = fs.readFileSync(CACHE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch { return null; }
}

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[áäàâ]/g, 'a').replace(/[éëèê]/g, 'e').replace(/[íïìî]/g, 'i')
    .replace(/[óöòô]/g, 'o').replace(/[úüùû]/g, 'u').replace(/[ñ]/g, 'n')
    .split(/[^a-z0-9]+/).filter(Boolean);
}

function score(item, queryTokens) {
  const text = tokenize(`${item.title || ''} ${(item.tags || []).join(' ')}`);
  return queryTokens.reduce((sum, t) => sum + (text.includes(t) ? 1 : 0), 0);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return send(200, { ok: true });

  try {
    const query = String(event.queryStringParameters?.q || '').trim();
    if (!query) return send(400, { ok: false, error: 'Falta q' });

    const allItems = loadCache();
    if (!allItems || !allItems.length) {
      return send(200, {
        ok: true,
        query,
        items: [],
        source: null,
        note: 'No hay caché de Pinterest. Ejecuta scripts/cache-pinterest.js localmente y haz commit.',
      });
    }

    const queryTokens = tokenize(query);
    let scored = allItems
      .map((item) => ({ item, score: score(item, queryTokens) }))
      .filter((s) => s.score > 0);

    // If no match, take random items
    if (!scored.length) {
      const shuffled = [...allItems].sort(() => Math.random() - 0.5);
      scored = shuffled.slice(0, 18).map((item) => ({ item, score: 0 }));
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 18);

    const items = top.map(({ item }) => ({
      image: item.image,
      title: item.title,
      url: item.url,
    }));

    return send(200, {
      ok: true,
      query,
      items,
      source: 'Pinterest',
      cached: allItems.length,
    });
  } catch (err) {
    return send(500, { ok: false, error: err.message });
  }
};
