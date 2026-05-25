
// --- Spanish forced description (100% always ES) ---
function __getESDescription(photo, query){
  try{
    const base = query || "manicura";
    return `Imagen de ${base} con manos y uñas cuidadas`;
  }catch(e){
    return "Imagen de manicura";
  }
}

export const APP_CONFIG = {
  media: {
    pinterestBridgeUrl: 'http://127.0.0.1:8787',
    netlifyFunctionUrl: '/api/search-pinterest',
    searchPerPage: 18,
  },
  firebase: {
    apiKey: 'AIzaSyB3FPlFNGkr5QaWLvNw1EFTzG6BTHk96YQ',
    authDomain: 'nails-55215.firebaseapp.com',
    projectId: 'nails-55215',
    storageBucket: 'nails-55215.firebasestorage.app',
    messagingSenderId: '474017435016',
    appId: '1:474017435016:web:f1b3fec9064c31e5247e3d',
    measurementId: "G-JJ2E1585SY"
  },
  emailjs: {
    publicKey: 'b8LbWTNUQZaldRC4a',
    serviceId: 'service_sl8p1yr',
    templateId: 'template_mzml16g',
    cancellationTemplateId: 'template_z4iauoj',
    promotionTemplateId: 'YOUR_PROMOTION_TEMPLATE_ID',
  },
  app: {
    name: 'Wendys',
    currency: '$',
    defaultReminderHour: 24,
  },
};

export const isPlaceholder = (value) =>
  !value || String(value).startsWith('YOUR_');

export const firebaseConfigured = () =>
  Object.values(APP_CONFIG.firebase).every((v) => !isPlaceholder(v));

export const emailjsConfigured = () =>
  !isPlaceholder(APP_CONFIG.emailjs.publicKey) &&
  !isPlaceholder(APP_CONFIG.emailjs.serviceId) &&
  !isPlaceholder(APP_CONFIG.emailjs.templateId);
