
// --- Spanish forced description (100% always ES) ---
function __getESDescription(photo, query){
  try{
    const base = query || "manicura";
    return `Imagen de ${base} con manos y uñas cuidadas`;
  }catch(e){
    return "Imagen de manicura";
  }
}

import { escapeHTML } from './dom.js';

const root = () => document.getElementById('toast-root');

export function notify(message, type = 'info', title = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <div class="dot"></div>
    <div>
      <h4>${escapeHTML(title || (type === 'success' ? 'Éxito' : type === 'error' ? 'Error' : 'Aviso'))}</h4>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
  root().appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    el.style.transition = 'all .25s ease';
  }, 3000);
  setTimeout(() => el.remove(), 3600);
}

notify.success = (msg, title = 'Éxito') => notify(msg, 'success', title);
notify.error = (msg, title = 'Error') => notify(msg, 'error', title);
notify.info = (msg, title = 'Aviso') => notify(msg, 'info', title);
