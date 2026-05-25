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

  const urlRegex = /https?:\/\/(?:i\.)?pinimg\.com\/[^"'\s<>]+(?:\.(?:jpg|jpeg|png|webp))?(?:\?[^"'\s<>]*)?/gi;
  const matches = [...new Set(html.match(urlRegex) || [])];

  for (const raw of matches) {
    let clean = raw.split('?')[0]
      .replace(/^http:/i, 'https:')
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

  if (items.length) return items;

  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    try {
      const text = scriptMatch[1];
      if (text.includes('pinimg.com')) {
        const imgRegex = /https?:\/\/(?:i\.)?pinimg\.com\/[^"'\s,}]+/gi;
        let m;
        while ((m = imgRegex.exec(text)) !== null) {
          let clean = m[0].split('?')[0]
            .replace(/^http:/i, 'https:')
            .replace(/\/\d+x\//, '/736x/')
            .replace(/\/\d+x\d+x\//, '/736x/');
          if (seen.has(clean) || clean.includes('/avatars/') || clean.includes('/75x75/')) continue;
          seen.add(clean);
          items.push({
            image: clean,
            title: `Referencia ${query}`,
            url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`,
          });
          if (items.length >= 18) break;
        }
      }
    } catch {}
    if (items.length >= 18) break;
  }

  return items;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function searchViaAPI(query) {
  const body = JSON.stringify({
    options: { query, scope: 'pins', page_size: 18, no_fetch_context_on_resource: true },
    context: {},
  });

  const res = await fetch('https://co.pinterest.com/resource/BaseSearchResource/get/', {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'es-CO,es;q=0.9',
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: `source_url=/search/pins/?q=${encodeURIComponent(query)}&rs=typed&data=${encodeURIComponent(body)}`,
  });

  if (!res.ok) return null;
  const data = await res.json();

  try {
    const results = [];
    const pins = data?.resource_response?.data?.results || [];
    for (const pin of pins) {
      const images = pin?.images?.orig || pin?.images?.['736x'] || pin?.images?.['564x'] || {};
      const imgUrl = images?.url || '';
      if (!imgUrl) continue;
      const clean = imgUrl.replace(/^http:/i, 'https:');
      results.push({
        image: clean,
        title: pin?.title || pin?.grid_title || `Referencia ${query}`,
        url: `https://www.pinterest.com/pin/${pin.id}/`,
      });
      if (results.length >= 18) break;
    }
    return results;
  } catch {
    return null;
  }
}

async function searchViaHTML(query) {
  const url = `https://co.pinterest.com/search/pins/?q=${encodeURIComponent(query)}&rs=typed`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'es-CO,es;q=0.9',
    },
  });

  if (!res.ok) return null;
  const html = await res.text();
  const items = extractImages(html, query);
  return items.length ? items : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return send(200, { ok: true });

  try {
    const query = String(event.queryStringParameters?.q || '').trim();
    if (!query) return send(400, { ok: false, error: 'Falta q' });

    let items = await searchViaAPI(query);

    if (!items) {
      items = await searchViaHTML(query);
    }

    return send(200, {
      ok: true,
      query,
      items: items || [],
      source: items ? 'Pinterest' : null,
    });
  } catch (err) {
    return send(500, { ok: false, error: err.message });
  }
};
