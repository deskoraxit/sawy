
// --- Spanish forced description (100% always ES) ---
function __getESDescription(photo, query){
  try{
    const base = query || "manicura";
    return `Imagen de ${base} con manos y uñas cuidadas`;
  }catch(e){
    return "Imagen de manicura";
  }
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
export const uid = () => crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
export const escapeHTML = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const formatCurrency = (value, currency = '$') => `${currency}${Number(value || 0).toFixed(2)}`;

export const formatDate = (date, options = {}) => {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
};

export const formatDateTime = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export const toDateInputValue = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const toMonthTitle = (value = new Date()) =>
  value.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

export const compareText = (a, b) => String(a || '').toLowerCase().includes(String(b || '').toLowerCase());

export const downloadText = (filename, content, mime = 'text/plain') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const sortByDateDesc = (a, b, field = 'createdAt') => new Date(b[field] || 0) - new Date(a[field] || 0);

export const normalizePhone = (value = '') => String(value).trim();
