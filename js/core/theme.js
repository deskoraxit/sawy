const STORAGE_KEY = 'sawy_theme';
const LIGHT_THEME = 'light';
const DARK_THEME = 'dark';
const LIGHT_COLOR = '#c7a7ff';
const DARK_COLOR = '#0b1020';

function getThemeMeta() {
  return document.querySelector('meta[name="theme-color"]');
}

export function getPreferredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === LIGHT_THEME || stored === DARK_THEME) return stored;
  } catch {
    // ignore storage access issues
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? DARK_THEME : LIGHT_THEME;
}

export function applyTheme(theme = getPreferredTheme(), { persist = false } = {}) {
  const normalized = theme === DARK_THEME ? DARK_THEME : LIGHT_THEME;
  document.documentElement.dataset.theme = normalized;
  document.documentElement.style.colorScheme = normalized;

  const meta = getThemeMeta();
  if (meta) meta.setAttribute('content', normalized === DARK_THEME ? DARK_COLOR : LIGHT_COLOR);

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // ignore storage access issues
    }
  }

  return normalized;
}

export function toggleTheme() {
  const current = document.documentElement.dataset.theme === DARK_THEME ? DARK_THEME : LIGHT_THEME;
  return applyTheme(current === DARK_THEME ? LIGHT_THEME : DARK_THEME, { persist: true });
}

export function initTheme() {
  return applyTheme(getPreferredTheme(), { persist: false });
}

function buttonIcon(theme) {
  return theme === DARK_THEME
    ? `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v2M12 19v2M5.64 5.64l1.42 1.42M16.94 16.94l1.42 1.42M3 12h2M19 12h2M5.64 18.36l1.42-1.42M16.94 7.06l1.42-1.42M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg>`
    : `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}

export function syncThemeToggle(button, theme = document.documentElement.dataset.theme || getPreferredTheme()) {
  if (!button) return;
  const normalized = theme === DARK_THEME ? DARK_THEME : LIGHT_THEME;
  button.innerHTML = buttonIcon(normalized);
  button.title = normalized === DARK_THEME ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
  button.setAttribute('aria-label', button.title);
  button.dataset.theme = normalized;
}

export function wireThemeToggles(root = document) {
  const syncAll = (theme) => {
    root.querySelectorAll('.js-theme-toggle').forEach((button) => syncThemeToggle(button, theme));
  };

  syncAll(document.documentElement.dataset.theme || getPreferredTheme());

  root.querySelectorAll('.js-theme-toggle').forEach((button) => {
    if (button.dataset.themeBound === 'true') return;
    button.dataset.themeBound = 'true';
    button.addEventListener('click', () => {
      const theme = toggleTheme();
      syncAll(theme);
    });
  });
}
