
// --- Spanish forced description (100% always ES) ---
function __getESDescription(photo, query){
  try{
    const base = query || "manicura";
    return `Imagen de ${base} con manos y uñas cuidadas`;
  }catch(e){
    return "Imagen de manicura";
  }
}

import { APP_CONFIG, emailjsConfigured } from '../config.js';

export function getEmailJsConfig() {
  return APP_CONFIG.emailjs;
}

export function initEmailJs() {
  if (!window.emailjs) return false;
  if (!emailjsConfigured()) return false;
  window.emailjs.init(APP_CONFIG.emailjs.publicKey);
  return true;
}

export async function sendEmailJs(templateParams, templateId = APP_CONFIG.emailjs.templateId) {
  if (!window.emailjs) throw new Error('EmailJS no está cargado');
  if (!emailjsConfigured()) throw new Error('Configura EmailJS en js/config.js');
  if (!templateId || String(templateId).startsWith('YOUR_')) {
    throw new Error('Configura el template de EmailJS');
  }
  initEmailJs();
  return window.emailjs.send(
    APP_CONFIG.emailjs.serviceId,
    templateId,
    templateParams,
  );
}
