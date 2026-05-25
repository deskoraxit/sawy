
// --- Spanish forced description (100% always ES) ---
function __getESDescription(photo, query){
  try{
    const base = query || "manicura";
    return `Imagen de ${base} con manos y uñas cuidadas`;
  }catch(e){
    return "Imagen de manicura";
  }
}

import { APP_CONFIG } from '../config.js';
import { list } from './store.js';

const STOPWORDS = new Set([
  'de','la','el','los','las','y','o','para','con','sin','del','al','en','un','una','unos','unas',
  'muy','mas','más','menos','por','sobre','tu','mi','su','sus','que','como','ej','ejemplo','edad','tono','gustos',
  'tipo','quiero','busco','algo','idea','referencia','referencias','diseño','diseno','diseños','disenos','uñas','unas',
  'nail','nails','manicure','manicura','imagen','imagenes','foto','fotos'
]);

const OBJECTIVE_RULES = [
  {
    label: 'Minimalista',
    matches: ['minimalista', 'minimal', 'simple', 'clean', 'sobrio', 'sobria'],
    queries: ['minimalist nails', 'simple nude nails', 'clean manicure'],
    difficulty: 'Baja',
    time: '25 min',
  },
  {
    label: 'Elegante',
    matches: ['elegante', 'sofisticado', 'sofisticada', 'glam', 'formal', 'fino'],
    queries: ['elegant nails', 'classy manicure', 'glossy nails'],
    difficulty: 'Media',
    time: '35 min',
  },
  {
    label: 'Oficina',
    matches: ['oficina', 'ejecutiva', 'ejecutivo', 'trabajo', 'corporativo', 'profesional'],
    queries: ['office nails', 'short nude manicure', 'business nails'],
    difficulty: 'Baja',
    time: '30 min',
  },
  {
    label: 'Novia',
    matches: ['boda', 'novia', 'matrimonio', 'evento', 'quince', 'graduacion', 'celebracion'],
    queries: ['bridal nails', 'wedding manicure', 'soft elegant nails'],
    difficulty: 'Media',
    time: '40 min',
  },
  {
    label: 'Francesa',
    matches: ['francesa', 'french', 'tip'],
    queries: ['french manicure', 'modern french nails', 'french tip nails'],
    difficulty: 'Media',
    time: '35 min',
  },
  {
    label: 'Nude',
    matches: ['nude', 'beige', 'rosado', 'rosa', 'pink', 'natural'],
    queries: ['nude nails', 'pink nude nails', 'natural manicure'],
    difficulty: 'Baja',
    time: '30 min',
  },
  {
    label: 'Rojo',
    matches: ['rojo', 'roja', 'rojas', 'red'],
    queries: ['red nails', 'red manicure', 'glossy red nails'],
    difficulty: 'Media',
    time: '30 min',
  },
  {
    label: 'Azul',
    matches: ['azul', 'azules', 'blue'],
    queries: ['blue nails', 'blue manicure', 'blue nail art'],
    difficulty: 'Media',
    time: '35 min',
  },
  {
    label: 'Verde',
    matches: ['verde', 'verdes', 'green'],
    queries: ['green nails', 'green manicure', 'green nail art'],
    difficulty: 'Media',
    time: '35 min',
  },
  {
    label: 'Morado',
    matches: ['morado', 'morada', 'moradas', 'lila', 'violeta', 'purple', 'violet', 'lilac'],
    queries: ['purple nails', 'purple manicure', 'lilac nail art'],
    difficulty: 'Media',
    time: '35 min',
  },
  {
    label: 'Dorado',
    matches: ['dorado', 'dorada', 'doradas', 'gold', 'golden'],
    queries: ['gold nails', 'gold manicure', 'gold nail art'],
    difficulty: 'Media',
    time: '40 min',
  },
  {
    label: 'Oscuro',
    matches: ['negro', 'black', 'oscuro', 'dark'],
    queries: ['black nails', 'dark manicure', 'black glossy nails'],
    difficulty: 'Media',
    time: '35 min',
  },
  {
    label: 'Largas',
    matches: ['larga', 'largas', 'long', 'acrilica', 'acrilicas', 'acrylic', 'almendra', 'stiletto'],
    queries: ['long acrylic nails', 'acrylic nails design', 'long nails'],
    difficulty: 'Alta',
    time: '50 min',
  },
  {
    label: 'Cortas',
    matches: ['corta', 'cortas', 'short', 'corto', 'shorts'],
    queries: ['short nails', 'short manicure', 'short elegant nails'],
    difficulty: 'Baja',
    time: '25 min',
  },
  {
    label: 'Floral',
    matches: ['floral', 'flores', 'flor', 'primavera'],
    queries: ['floral nails', 'flower nail art', 'spring nails'],
    difficulty: 'Media',
    time: '45 min',
  },
  {
    label: 'Colorido',
    matches: ['colorido', 'colores', 'vivo', 'vivos', 'verano', 'bright'],
    queries: ['colorful nails', 'bright nail art', 'summer nails'],
    difficulty: 'Media',
    time: '40 min',
  },
];

const SEARCH_MODIFIERS = [
  'soft', 'glossy', 'matte', 'luxury', 'modern', 'chic', 'natural', 'artistic',
  'trendy', 'delicate', 'fresh', 'polished', 'subtle', 'premium'
];

const ATTRIBUTE_TERMS = {
  short: ['corta', 'cortas', 'corto', 'short'],
  long: ['larga', 'largas', 'largo', 'long', 'acrilica', 'acrilicas', 'acrylic'],
  red: ['rojo', 'roja', 'rojas', 'red'],
  blue: ['azul', 'azules', 'blue'],
  green: ['verde', 'verdes', 'green'],
  yellow: ['amarillo', 'amarilla', 'amarillas', 'yellow'],
  purple: ['morado', 'morada', 'moradas', 'lila', 'violeta', 'purple', 'violet', 'lilac'],
  orange: ['naranja', 'orange'],
  gold: ['dorado', 'dorada', 'doradas', 'gold', 'golden'],
  silver: ['plateado', 'plateada', 'plateadas', 'silver'],
  nude: ['nude', 'beige', 'natural'],
  pink: ['rosa', 'rosado', 'rosada', 'pink'],
  black: ['negro', 'negra', 'black', 'oscuro', 'oscura', 'dark'],
  white: ['blanco', 'blanca', 'white'],
  french: ['francesa', 'french'],
  minimalist: ['minimalista', 'minimal', 'simple'],
  glitter: ['brillo', 'brillante', 'glitter', 'sparkle'],
  matte: ['mate', 'matte'],
  elegant: ['elegante', 'elegant', 'sofisticada', 'sofisticado'],
  floral: ['floral', 'flores', 'flor', 'flower'],
  ombre: ['degrade', 'degradado', 'ombre'],
  chrome: ['cromado', 'cromadas', 'chrome'],
  pearl: ['perla', 'perladas', 'pearl'],
  heart: ['corazon', 'corazones', 'heart'],
};

const ATTRIBUTE_QUERY_WORDS = {
  short: 'short',
  long: 'long acrylic',
  red: 'red',
  blue: 'blue',
  green: 'green',
  yellow: 'yellow',
  purple: 'purple',
  orange: 'orange',
  gold: 'gold',
  silver: 'silver',
  nude: 'nude',
  pink: 'pink',
  black: 'black',
  white: 'white',
  french: 'french tip',
  minimalist: 'minimalist',
  glitter: 'glitter',
  matte: 'matte',
  elegant: 'elegant',
  floral: 'floral',
  ombre: 'ombre',
  chrome: 'chrome',
  pearl: 'pearl',
  heart: 'heart',
};

const NAIL_RESULT_TERMS = [
  'nails', 'manicure', 'fingernail', 'fingernails', 'nail art', 'cuticles', 'hand', 'hands', 'finger', 'fingers'
];

const FINISHED_NAIL_SUBJECT_TERMS = [
  'nails', 'fingernail', 'fingernails', 'nail art', 'cuticles', 'hand', 'hands', 'finger', 'fingers'
];

const WEAK_NAIL_TERMS = [
  'nail polish', 'polish', 'varnish', 'enamel', 'esmalte', 'nail'
];

const OFF_TOPIC_TERMS = [
  'rose', 'roses', 'flower', 'flowers', 'bouquet', 'wedding bouquet', 'coffee', 'cup', 'mug', 'drink',
  'christmas ball', 'ornament', 'makeup', 'lipstick', 'lips', 'portrait', 'face', 'cosmetic', 'jewelry',
  'bottle', 'bottles', 'container', 'containers', 'tool', 'tools', 'file', 'lamp', 'dryer', 'pedicure', 'toenail', 'toenails'
];

const HARD_OFF_TOPIC_TERMS = [
  'bottle', 'bottles', 'container', 'containers', 'tool', 'tools', 'file', 'lamp', 'dryer', 'pedicure', 'toenail', 'toenails'
];

const REQUIRED_QUERY_GROUPS = [
  ['red'],
  ['blue'],
  ['green'],
  ['yellow'],
  ['purple', 'violet', 'lilac'],
  ['orange'],
  ['gold', 'golden'],
  ['silver'],
  ['black'],
  ['white'],
  ['pink'],
  ['nude', 'natural', 'beige'],
  ['french'],
  ['glitter'],
  ['matte'],
  ['floral', 'flower', 'flowers'],
  ['ombre'],
  ['chrome'],
  ['pearl'],
  ['heart'],
];

const RECENT_RESULTS_KEY = 'nailflow.recommendations.recent.v3';
const ROTATION_KEY = 'nailflow.recommendations.rotation.v3';
const RECENT_LIMIT = 18;

function normalize(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text = '') {
  return normalize(text)
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t) && t.length > 1);
}

function joinInput(...parts) {
  return normalize(parts.filter(Boolean).join(' '));
}

function detectTheme(text = '') {
  const haystack = normalize(text);
  let best = OBJECTIVE_RULES[0];
  let bestScore = -1;

  for (const rule of OBJECTIVE_RULES) {
    const score = rule.matches.reduce((acc, word) => acc + (haystack.includes(word) ? 1 : 0), 0);
    if (score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }

  return best || OBJECTIVE_RULES[0];
}

function detectAttributes(text = '') {
  const haystack = normalize(text);
  return Object.entries(ATTRIBUTE_TERMS)
    .filter(([, terms]) => terms.some((term) => haystack.includes(normalize(term))))
    .map(([key]) => key);
}

function unique(values) {
  return [...new Set(values.map((v) => normalize(v)).filter(Boolean))];
}

function hashString(input = '') {
  let hash = 0;
  const str = String(input);
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function shuffleWithSeed(values = [], seed = 1) {
  const arr = [...values];
  let currentSeed = Math.max(1, seed | 0);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
    const j = currentSeed % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function readJsonStorage(key, fallback = {}) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
}

function getRotationKey(raw = '') {
  return `${ROTATION_KEY}:${hashString(raw)}`;
}

function nextRotation(raw = '') {
  const key = getRotationKey(raw);
  const store = readJsonStorage(key, { cursor: 0 });
  const cursor = Number(store.cursor || 0);
  store.cursor = cursor + 1;
  writeJsonStorage(key, store);
  return cursor;
}

function getRecentIds(raw = '') {
  const key = `${RECENT_RESULTS_KEY}:${hashString(raw)}`;
  const store = readJsonStorage(key, { ids: [] });
  return Array.isArray(store.ids) ? store.ids : [];
}

function rememberRecentIds(raw = '', ids = []) {
  const key = `${RECENT_RESULTS_KEY}:${hashString(raw)}`;
  const current = getRecentIds(raw);
  const merged = unique([...current, ...ids]).slice(-RECENT_LIMIT);
  writeJsonStorage(key, { ids: merged });
}

function buildSearchQueries(payload = {}) {
  const raw = joinInput(payload.occupation, payload.style, payload.event, payload.profile, payload.preferences, payload.extra);
  const theme = detectTheme(raw);
  const attributes = detectAttributes(raw);
  const attributeQuery = attributes.map((key) => ATTRIBUTE_QUERY_WORDS[key]).filter(Boolean).join(' ');
  const tokens = tokenize(raw)
    .filter((token) => !theme.matches.includes(token))
    .filter((token) => !attributes.some((key) => ATTRIBUTE_TERMS[key].includes(token)));
  const compact = unique([attributeQuery, tokens.slice(0, 3).join(' ')]).join(' ');
  const modifiers = shuffleWithSeed(SEARCH_MODIFIERS, hashString(raw) || 1).slice(0, 2);

  return unique([
    compact ? `${compact} nails` : '',
    compact ? `${compact} manicure` : '',
    compact ? `${compact} nail art close up` : '',
    attributeQuery ? `${attributeQuery} nails manicure` : '',
    attributeQuery ? `${attributeQuery} fingernails nail polish` : '',
    ...theme.queries,
    ...modifiers.map((modifier) => `${modifier} ${theme.label.toLowerCase()} nails`),
    `${theme.label.toLowerCase()} nails manicure`,
  ]).slice(0, 10);
}

async function fetchJson(url, options = {}) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function mapPixabayPhoto(photo, theme, query, index) {
  return {
    id: `pixabay-${photo.id}`,
    nombre: theme?.label ? `${theme.label} · ${index + 1}` : `Referencia ${index + 1}`,
    descripción: __getESDescription(photo, query) || query || 'Referencia de uñas encontrada en Pixabay.',
    imagen: photo.largeImageURL || photo.webformatURL || photo.previewURL || '',
    dificultad: theme?.difficulty || 'Media',
    tiempoEstimado: theme?.time || '30 min',
    categoria: theme?.label || 'Pixabay',
    fuente: 'Pixabay',
    url: photo.pageURL || '',
  };
}

function mapPinterestPin(pin, theme, query, index) {
  return {
    id: `rec-${hashString(pin.image || pin.url || `${query}-${index}`)}`,
    nombre: theme?.label ? `${theme.label} · ${index + 1}` : `Diseño ${index + 1}`,
    descripción: pin.title || __getESDescription(pin, query) || query || 'Diseño de uñas.',
    imagen: pin.image || '',
    dificultad: theme?.difficulty || 'Media',
    tiempoEstimado: theme?.time || '30 min',
    categoria: theme?.label || 'Recomendación',
    fuente: '',
    url: pin.url || '',
  };
}

function scorePixabayPhoto(photo, query) {
  const text = normalize([
    photo.tags,
    photo.pageURL,
    photo.user,
  ].filter(Boolean).join(' '));
  const normalizedQuery = normalize(query);

  const nailScore = NAIL_RESULT_TERMS.reduce((score, term) => score + (text.includes(normalize(term)) ? 4 : 0), 0);
  const weakNailScore = WEAK_NAIL_TERMS.reduce((score, term) => score + (text.includes(normalize(term)) ? 1 : 0), 0);
  const queryTokens = tokenize(query).filter((token) => !['photo', 'close'].includes(token));
  const queryScore = queryTokens.reduce((score, token) => score + (text.includes(token) ? 1 : 0), 0);
  const offTopicPenalty = OFF_TOPIC_TERMS.reduce((score, term) => {
    const normalizedTerm = normalize(term);
    const floralRequested = normalizedQuery.includes('floral') || normalizedQuery.includes('flower');
    if (floralRequested && ['flower', 'flowers'].includes(normalizedTerm)) return score;
    return score + (text.includes(normalizedTerm) ? 5 : 0);
  }, 0);

  return nailScore + weakNailScore + queryScore - offTopicPenalty;
}

function hasFinishedNailSubject(photo) {
  const text = normalize([
    photo.tags,
    photo.pageURL,
  ].filter(Boolean).join(' '));
  return FINISHED_NAIL_SUBJECT_TERMS.some((term) => text.includes(normalize(term)));
}

function hasHardOffTopicSubject(photo) {
  const text = normalize([
    photo.tags,
    photo.pageURL,
  ].filter(Boolean).join(' '));
  return HARD_OFF_TOPIC_TERMS.some((term) => text.includes(normalize(term)));
}

function matchesRequiredQueryTerms(photo, query) {
  const normalizedQuery = normalize(query);
  const text = normalize([
    photo.tags,
    photo.pageURL,
  ].filter(Boolean).join(' '));

  return REQUIRED_QUERY_GROUPS.every((group) => {
    const isRequired = group.some((term) => normalizedQuery.includes(term));
    if (!isRequired) return true;
    return group.some((term) => text.includes(term));
  });
}

function filterPixabayPhotos(photos = [], query = '') {
  return photos
    .map((photo) => ({ photo, score: scorePixabayPhoto(photo, query) }))
    .filter(({ photo, score }) => score >= 10 && !hasHardOffTopicSubject(photo) && hasFinishedNailSubject(photo) && matchesRequiredQueryTerms(photo, query))
    .sort((a, b) => b.score - a.score)
    .map(({ photo }) => photo);
}

async function searchPixabay(query, theme, page = 1) {
  const apiKey = APP_CONFIG.media?.pixabayApiKey;
  if (!apiKey || String(apiKey).startsWith('YOUR_')) return [];
  const perPage = Math.max(APP_CONFIG.media?.searchPerPage || 12, 24);
  const params = new URLSearchParams({
    key: apiKey,
    q: query,
    image_type: 'photo',
    category: 'fashion',
    order: 'popular',
    safesearch: 'true',
    lang: 'en',
    per_page: String(perPage),
    page: String(Math.max(1, page)),
  });
  const url = `https://pixabay.com/api/?${params.toString()}`;
  const data = await fetchJson(url);
  const photos = Array.isArray(data?.hits) ? data.hits : [];
  return filterPixabayPhotos(photos, query)
    .map((photo, index) => mapPixabayPhoto(photo, theme, query, index))
    .filter((item) => item.imagen);
}

async function searchNetlifyFunction(query, theme) {
  const fnUrl = APP_CONFIG.media?.netlifyFunctionUrl;
  if (!fnUrl) return [];
  const url = `${String(fnUrl).replace(/\/$/, '')}?q=${encodeURIComponent(query)}`;
  const data = await fetchJson(url);
  console.log('[NetlifyFn] respuesta:', data);
  const pins = Array.isArray(data?.items) ? data.items : [];
  if (!pins.length) {
    console.warn('[NetlifyFn] sin resultados. Diagnóstico:', data?.diag || data?.note || '—');
    return [];
  }
  return pins
    .map((pin, index) => mapPinterestPin(pin, theme, query, index))
    .filter((item) => item.imagen);
}

async function searchPinterestBridge(query, theme) {
  const baseUrl = APP_CONFIG.media?.pinterestBridgeUrl;
  if (!baseUrl) return [];
  const url = `${String(baseUrl).replace(/\/$/, '')}/search?q=${encodeURIComponent(query)}`;
  const data = await fetchJson(url);
  const pins = Array.isArray(data?.items) ? data.items : [];
  if (!pins.length) return [];
  return pins
    .map((pin, index) => mapPinterestPin(pin, theme, query, index))
    .filter((item) => item.imagen);
}

async function collectInternetRecommendations(payload = {}) {
  const raw = joinInput(payload.occupation, payload.style, payload.event, payload.profile, payload.preferences, payload.extra);
  const queries = buildSearchQueries(payload);
  const theme = detectTheme(raw);
  const results = [];
  const seen = new Set(getRecentIds(raw));

  for (let queryIndex = 0; queryIndex < queries.length; queryIndex += 1) {
    if (results.length >= 6) break;
    const query = queries[queryIndex];

    let items = [];
    try {
      items = await searchNetlifyFunction(query, theme);
    } catch (err) {
      console.warn('Netlify Function no disponible:', err.message);
    }

    if (!items.length) {
      try {
        items = await searchPinterestBridge(query, theme);
      } catch (err) {
        console.warn('Bridge local no disponible:', err.message);
      }
    }

    for (const item of items) {
      if (results.length >= 6) break;
      if (seen.has(item.id) || seen.has(item.imagen)) continue;
      seen.add(item.id);
      seen.add(item.imagen);
      results.push(item);
    }
  }

  rememberRecentIds(raw, results.map((item) => item.id));
  return results;
}

async function collectCatalogFallback(payload = {}) {
  const { userId = '' } = payload;
  let catalog = await list('designs', userId ? { userId } : {});
  if (!Array.isArray(catalog) || !catalog.length) catalog = await list('designs');
  if (!Array.isArray(catalog) || !catalog.length) return [];

  const raw = joinInput(payload.occupation, payload.style, payload.event, payload.profile, payload.preferences, payload.extra);
  const queryTokens = tokenize(raw);
  const theme = detectTheme(raw);
  const rotation = nextRotation(`catalog:${raw}`);

  return catalog
    .filter((design) => design && (design.image || design.dataUrl))
    .map((design) => {
      const text = normalize([design.name, design.categoria, design.descripcion, design.dificultad, design.tiempoEstimado].join(' '));
      const score = queryTokens.reduce((acc, token) => acc + (text.includes(token) ? 2 : 0), 0) + (text.includes(normalize(theme.label)) ? 3 : 0);
      return {
        id: design.id,
        nombre: design.name || design.nombre || 'Diseño del catálogo',
        descripción: design.descripcion || design.description || 'Referencia del catálogo para complementar la búsqueda.',
        imagen: design.image || design.dataUrl || '',
        dificultad: design.dificultad || theme.difficulty || 'Medio',
        tiempoEstimado: design.tiempoEstimado || design.tiempo_estimado || theme.time || '30 min',
        categoria: design.categoria || theme.label || 'Catálogo',
        fuente: 'Catálogo',
        _score: score,
        _rotation: rotation,
      };
    })
    .sort((a, b) => (b._score - a._score) || (a._rotation - b._rotation))
    .slice(0, 3)
    .map(({ _score, _rotation, ...rest }) => rest);
}

export async function getRecommendations(payload = {}) {
  const internet = await collectInternetRecommendations(payload);
  if (internet.length) return internet.slice(0, 6);

  const catalog = await collectCatalogFallback(payload);
  if (catalog.length) return catalog.slice(0, 3);

  return [];
}
