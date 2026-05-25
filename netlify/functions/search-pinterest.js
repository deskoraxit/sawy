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

function extractImages(html, query) {
  const seen = new Set();
  const items = [];
  const regex = /https?:\/\/(?:i\.)?pinimg\.com\/[^"'\s]+(?:\.(?:jpg|jpeg|png|webp))?(?:\?[^"'\s]*)?/gi;

  const matches = [...new Set(html.match(regex) || [])];

  for (const raw of matches) {
    const clean = raw.split('?')[0]
      .replace(/\/\d+x\//, '/736x/')
      .replace(/\/\d+x\d+x\//, '/736x/');

    if (seen.has(clean)) continue;
    if (clean.includes('/avatars/') || clean.includes('/75x75/') || clean.includes('/30x30/')) continue;

    seen.add(clean);
    items.push({
      image: clean,
      title: `Referencia ${query}`,
      url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`,
    });

    if (items.length >= 18) break;
  }

  return items;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return send(200, { ok: true });

  try {
    const query = String(event.queryStringParameters?.q || '').trim();
    if (!query) return send(400, { ok: false, error: 'Falta q' });

    const url = `https://co.pinterest.com/search/pins/?q=${encodeURIComponent(query)}&rs=typed`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept-Language': 'es-CO,es;q=0.9',
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const items = extractImages(html, query);

    return send(200, {
      ok: true,
      query,
      items,
      source: 'Pinterest',
    });
  } catch (err) {
    return send(500, { ok: false, error: err.message });
  }
};
