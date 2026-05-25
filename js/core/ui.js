
// --- Spanish forced description (100% always ES) ---
function __getESDescription(photo, query){
  try{
    const base = query || "manicura";
    return `Imagen de ${base} con manos y uñas cuidadas`;
  }catch(e){
    return "Imagen de manicura";
  }
}

import { icon } from './icons.js';
import { escapeHTML } from './dom.js';
import { getCurrentUser, logout } from './auth.js';
import { navigate, parseHash, routeLabel } from './router.js';
import { syncThemeToggle, wireThemeToggles } from './theme.js';

const NAV = [
  ['home', 'Inicio', 'home', '#/home'],
  ['calendar', 'Agenda', 'calendar', '#/calendar'],
  ['clients', 'Clientes', 'users', '#/clients'],
  ['services', 'Servicios', 'briefcase', '#/services'],
  ['reminders', 'Recordatorios', 'bell', '#/reminders'],
  ['finances', 'Finanzas', 'dollar', '#/finances'],
  ['designs', 'Diseños', 'image', '#/designs'],
  ['recommendations', 'Recomendaciones', 'sparkles', '#/recommendations'],
  ['promotions', 'Promociones', 'tag', '#/promotions'],
  ['growth', 'Crecimiento', 'trend', '#/growth'],
  ['profile', 'Perfil', 'settings', '#/profile'],
];

export function pageShell({ title, subtitle = '', actions = '', content = '' }) {
  return `
    <div class="container">
      <div class="page-head">
        <div>
          <h1 class="page-title">${escapeHTML(title)}</h1>
          ${subtitle ? `<p class="page-subtitle">${escapeHTML(subtitle)}</p>` : ''}
        </div>
        ${actions ? `<div class="toolbar">${actions}</div>` : ''}
      </div>
      ${content}
    </div>
  `;
}

export function renderLayout(contentHtml) {
  const user = getCurrentUser();
  const current = parseHash().route;
  const initials = (user?.salonName || user?.name || user?.email || 'U')
    .split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();

  const navItems = NAV.map(([route, label, ic, href]) => `
    <a class="nav-item ${current === route || (route === 'home' && current === '') ? 'active' : ''}" href="${href}">
      ${icon(ic)}
      <span>${escapeHTML(label)}</span>
    </a>
  `).join('');

  const avatarMarkup = user?.avatar
    ? `<img src="${escapeHTML(user.avatar)}" alt="Avatar de perfil">`
    : escapeHTML(initials);

  return `
    <header class="topbar">
      <button class="btn icon ghost js-sidebar-toggle" type="button" aria-label="Abrir menú de navegación" id="sidebar-toggle-btn" style="display:none">
        ${icon('menu')}
      </button>
      <a class="brand" href="#/home">
        <span class="brand-mark brand-logo"><img src="./assets/sawy-logo-icon.png" alt="Sawy" /></span>
        <span class="brand-name">SAWY</span>
      </a>
      <div class="topbar-actions">
        <button class="btn icon ghost js-theme-toggle theme-toggle" type="button" aria-label="Cambiar tema"></button>
        <button class="avatar-btn" id="profile-menu-btn" type="button" aria-label="Abrir menú de usuario">
          <span class="avatar">${avatarMarkup}</span>
        </button>
        <div class="dropdown hidden" id="profile-menu" style="position:absolute;right:16px;top:76px;min-width:260px;background:rgba(255,255,255,.98);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow);padding:12px;z-index:2000">
          <div style="padding:10px 12px">
            <div style="font-weight:700">${escapeHTML(user?.salonName || user?.name || 'Usuario')}</div>
            <div style="color:var(--muted);font-size:.9rem">${escapeHTML(user?.email || '')}</div>
          </div>
          <div class="separator"></div>
          <a class="nav-item" href="#/profile">${icon('settings')}<span>Perfil</span></a>
          <button class="nav-item" id="logout-btn" style="width:100%;text-align:left;background:transparent;border:none">${icon('logout')}<span>Cerrar sesión</span></button>
        </div>
      </div>
    </header>
    <div class="sidebar-drawer">
      <div class="sidebar-drawer-overlay" id="sidebar-drawer-overlay"></div>
      <aside class="sidebar-drawer-panel" id="sidebar-drawer-panel">
        <nav class="sidebar-drawer-nav">${navItems}</nav>
      </aside>
    </div>
    <div class="layout">
      <aside class="sidebar">
        <nav class="sidebar-nav">${navItems}</nav>
      </aside>
      <main class="content">${contentHtml}</main>
    </div>
  `;
}

export function renderAuthShell(contentHtml) {
  return `
    <div class="auth-shell">
      <button class="btn icon ghost js-theme-toggle theme-toggle auth-theme-toggle" type="button" aria-label="Cambiar tema"></button>
      <div class="auth-layout auth-layout-centered">
        <div class="card auth-card auth-card-standalone">
          <div class="auth-brand"><div class="brand-mark brand-logo"><img src="./assets/sawy-logo-icon.png" alt="Sawy" /></div></div>
          ${contentHtml}
        </div>
      </div>
    </div>
  `;
}

export function wireLayoutEvents(root) {
  wireThemeToggles(root);

  const menuBtn = root.querySelector('#profile-menu-btn');
  const menu = root.querySelector('#profile-menu');
  const logoutBtn = root.querySelector('#logout-btn');
  const sidebarToggle = root.querySelector('#sidebar-toggle-btn');
  const drawerOverlay = root.querySelector('#sidebar-drawer-overlay');
  const drawerPanel = root.querySelector('#sidebar-drawer-panel');

  const openDrawer = () => {
    if (!drawerPanel || !drawerOverlay) return;
    drawerPanel.classList.add('drawer-open');
    drawerOverlay.classList.add('drawer-overlay-open');
    document.body.style.overflow = 'hidden';
  };

  const closeDrawer = () => {
    if (!drawerPanel || !drawerOverlay) return;
    drawerPanel.classList.remove('drawer-open');
    drawerOverlay.classList.remove('drawer-overlay-open');
    document.body.style.overflow = '';
  };

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', openDrawer);
  }


  if (drawerOverlay) {
    drawerOverlay.addEventListener('click', closeDrawer);
  }

  drawerPanel?.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      closeDrawer();
    });
  });

  const closeMenu = (e) => {
    if (!menu || !menuBtn) return;
    if (menu.contains(e.target) || menuBtn.contains(e.target)) return;
    menu.classList.add('hidden');
    document.removeEventListener('click', closeMenu);
  };

  if (menuBtn && menu) {
    menuBtn.onclick = (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
      if (!menu.classList.contains('hidden')) {
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
      }
    };
  }
  if (logoutBtn) logoutBtn.onclick = async () => { await logout(); navigate('#/login'); };
}

export function statCard(title, value, iconName) {
  return `
    <div class="card">
      <div class="card-header stat">
        <div>
          <div class="card-title">${escapeHTML(title)}</div>
          <div class="value">${escapeHTML(value)}</div>
        </div>
        <div class="avatar" style="width:44px;height:44px;border-radius:16px">${icon(iconName, 'nav-icon')}</div>
      </div>
      <div class="card-body"></div>
    </div>
  `;
}

export function emptyState(title, text, iconName = 'sparkles', action = '') {
  return `
    <div class="empty">
      <div class="icon">${icon(iconName, 'nav-icon', 1.8)}</div>
      <h3 style="margin:0 0 8px">${escapeHTML(title)}</h3>
      <p style="margin:0;color:var(--muted)">${escapeHTML(text)}</p>
      ${action ? `<div style="margin-top:16px">${action}</div>` : ''}
    </div>
  `;
}

function promoteModalToFront(backdrop) {
  if (!backdrop) return;
  const openModals = [...document.querySelectorAll('.modal-backdrop')];
  const maxZ = openModals.reduce((max, el) => {
    const z = Number.parseInt(window.getComputedStyle(el).zIndex || '0', 10);
    return Number.isFinite(z) ? Math.max(max, z) : max;
  }, 1000);
  backdrop.style.zIndex = String(maxZ + 10);
}

export function confirmDialog(message, {
  title = 'Confirmación',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  variant = 'danger',
} = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop open confirm-backdrop';
    backdrop.innerHTML = `
      <div class="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div class="modal-head">
          <div>
            <h2 class="card-title" id="confirm-title">${escapeHTML(title)}</h2>
          </div>
          <button class="btn icon ghost js-cancel" type="button" aria-label="Cerrar">×</button>
        </div>
        <div class="modal-body">
          <p class="confirm-message">${escapeHTML(message)}</p>
        </div>
        <div class="modal-foot confirm-foot">
          <button class="btn outline js-cancel" type="button">${escapeHTML(cancelText)}</button>
          <button class="btn ${variant === 'danger' ? 'danger' : 'primary'} js-confirm" type="button">${escapeHTML(confirmText)}</button>
        </div>
      </div>`;

    const cleanup = (result) => {
      document.removeEventListener('keydown', onKeyDown);
      backdrop.remove();
      resolve(result);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') cleanup(false);
      if (e.key === 'Enter') cleanup(true);
    };

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup(false);
    });
    backdrop.querySelectorAll('.js-cancel').forEach((button) => button.addEventListener('click', () => cleanup(false)));
    backdrop.querySelector('.js-confirm')?.addEventListener('click', () => cleanup(true));
    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(backdrop);
    promoteModalToFront(backdrop);
    requestAnimationFrame(() => backdrop.querySelector('.js-cancel')?.focus());
  });
}

export function field(name, label, value = '', type = 'text', placeholder = '', extra = '') {
  return `
    <div class="field">
      <label class="label" for="${name}">${escapeHTML(label)}</label>
      <input class="input" id="${name}" name="${name}" type="${type}" value="${escapeHTML(value)}" placeholder="${escapeHTML(placeholder)}" ${extra} />
    </div>
  `;
}
