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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return send(200, { ok: true });

  try {
    const query = String(event.queryStringParameters?.q || '').trim();
    if (!query) return send(400, { ok: false, error: 'Falta q' });

    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      return send(200, {
        ok: true,
        query,
        items: [],
        source: null,
        note: 'Configura PEXELS_API_KEY en las variables de entorno de Netlify',
      });
    }

    const params = new URLSearchParams({
      query: `${query} nails manicure`,
      per_page: '18',
      orientation: 'portrait',
    });

    const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: apiKey },
    });

    if (!res.ok) throw new Error(`Pexels HTTP ${res.status}`);
    const data = await res.json();
    const photos = Array.isArray(data?.photos) ? data.photos : [];

    const items = photos.map((photo) => ({
      image: photo.src?.medium || photo.src?.small || '',
      title: photo.alt || `Referencia ${query}`,
      url: photo.url || '',
    })).filter((p) => p.image);

    return send(200, {
      ok: true,
      query,
      items,
      source: items.length ? 'Pinterest' : null,
    });
  } catch (err) {
    return send(500, { ok: false, error: err.message });
  }
};
