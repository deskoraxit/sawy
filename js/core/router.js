
// --- Spanish forced description (100% always ES) ---
function __getESDescription(photo, query){
  try{
    const base = query || "manicura";
    return `Imagen de ${base} con manos y uñas cuidadas`;
  }catch(e){
    return "Imagen de manicura";
  }
}

export const routes = [
  'login','signup','onboarding',
  'home','calendar','clients','client-profile',
  'services','reminders','finances','designs',
  'recommendations','promotions','growth','profile'
];

export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '').trim();
  if (!raw) return { route: 'home', params: {} };
  const [pathPart, queryPart] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  if (parts[0] === 'clients' && parts[1]) return { route: 'client-profile', params: { id: parts[1] } };
  if (routes.includes(parts[0])) return { route: parts[0], params: Object.fromEntries(new URLSearchParams(queryPart || '')) };
  return { route: 'home', params: {} };
}

export function navigate(hash) {
  if (!hash.startsWith('#')) hash = `#${hash}`;
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}

export function routeLabel(route) {
  const map = {
    home: 'Inicio',
    calendar: 'Agenda',
    clients: 'Clientes',
    'client-profile': 'Cliente',
    services: 'Servicios',
    reminders: 'Recordatorios',
    finances: 'Finanzas',
    designs: 'Diseños',
    recommendations: 'Recomendaciones',
    promotions: 'Promociones',
    growth: 'Crecimiento',
    profile: 'Perfil',
    login: 'Iniciar sesión',
    signup: 'Registrarse',
    onboarding: 'Configuración inicial',
  };
  return map[route] || 'Sawy';
}
