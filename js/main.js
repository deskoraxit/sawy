
// --- Spanish forced description (100% always ES) ---
function __getESDescription(photo, query){
  try{
    const base = query || "manicura";
    return `Imagen de ${base} con manos y uñas cuidadas`;
  }catch(e){
    return "Imagen de manicura";
  }
}

import { initAuth, listen, getCurrentUser } from './core/auth.js';
import { parseHash, navigate } from './core/router.js';
import { pages, startAutomaticReminders } from './pages.js';
import { renderLayout, wireLayoutEvents, renderAuthShell } from './core/ui.js';
import { initTheme } from './core/theme.js';
import { notify } from './core/toast.js';
import { initFirebase } from './core/firebase.js';

const app = document.getElementById('app');
let currentCleanup = null;

async function render() {
  const { route, params } = parseHash();
  const user = getCurrentUser();

  if (!user && !['login', 'signup'].includes(route)) {
    navigate('#/login');
    return;
  }
  if (user && !user.onboardingCompleted && !['onboarding', 'login', 'signup'].includes(route)) {
    navigate('#/onboarding');
    return;
  }
  if (user && user.onboardingCompleted && (route === 'login' || route === 'signup' || route === 'onboarding')) {
    navigate('#/home');
    return;
  }

  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch (error) { console.warn('Cleanup error:', error); }
    currentCleanup = null;
  }

  const pageFactory = pages[route] || pages.home;
  const page = pageFactory(params);
  const isAuthRoute = ['login', 'signup', 'onboarding'].includes(route);

  app.innerHTML = isAuthRoute ? page.html : renderLayout(page.html);
  wireLayoutEvents(app);
  const maybeCleanup = await Promise.resolve(page.bind?.(app));
  if (typeof maybeCleanup === 'function') currentCleanup = maybeCleanup;
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', async () => {
  try {
    initTheme();
    await initFirebase();
    await initAuth();
    startAutomaticReminders();
    await render();
    listen(() => render());
  } catch (err) {
    console.error(err);
    notify.error('No se pudo inicializar la aplicación');
    app.innerHTML = renderAuthShell(`
      <h1 class="auth-title">Error al cargar Sawy</h1>
      <p class="auth-desc">Revisa la consola y la configuración de Firebase.</p>
    `);
  }
});
