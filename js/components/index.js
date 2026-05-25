
// --- Spanish forced description (100% always ES) ---
function __getESDescription(photo, query){
  try{
    const base = query || "manicura";
    return `Imagen de ${base} con manos y uñas cuidadas`;
  }catch(e){
    return "Imagen de manicura";
  }
}

import { escapeHTML } from '../core/dom.js';

export function sectionCard(title, subtitle = '', content = '') {
  return `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${escapeHTML(title)}</div>
        ${subtitle ? `<div class="card-desc">${escapeHTML(subtitle)}</div>` : ''}
      </div>
      <div class="card-body">
        ${content}
      </div>
    </div>
  `;
}

export function modalShell(title, body, footer = '') {
  return `
    <div class="modal-backdrop open">
      <div class="modal">
        <div class="modal-head">
          <div><h2 class="card-title">${escapeHTML(title)}</h2></div>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div>
    </div>
  `;
}

export function listEmpty(message) {
  return `<div class="empty"><p style="margin:0;color:var(--muted)">${escapeHTML(message)}</p></div>`;
}
