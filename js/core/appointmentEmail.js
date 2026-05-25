
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
import { sendEmailJs } from './emailjs.js';

async function buildAppointmentRecipient(appointment) {
  const userId = appointment?.userId;
  if (!userId) throw new Error('Falta el usuario de la cita');

  const [clients, services] = await Promise.all([
    list('clients', { userId }),
    list('services', { userId }),
  ]);

  const client = clients.find((c) => c.id === appointment?.clientId);
  const service = services.find((s) => s.id === appointment?.serviceId);

  if (!client?.email) {
    throw new Error('El cliente no tiene correo electrónico');
  }

  return {
    to_name: client.name || 'Cliente',
    to_email: client.email,
    date: appointment?.appointmentDate || '',
    time: `${appointment?.startTime || ''} - ${appointment?.endTime || ''}`.trim(),
    service_name: service?.name || appointment?.serviceName || '',
    salon_name: appointment?.salonName || '',
  };
}

export async function sendAppointmentConfirmation(appointment) {
  const templateParams = await buildAppointmentRecipient(appointment);
  return sendEmailJs(templateParams, APP_CONFIG.emailjs.templateId);
}

export async function sendAppointmentCancellation(appointment) {
  const templateParams = await buildAppointmentRecipient(appointment);
  return sendEmailJs(
    {
      ...templateParams,
      cancellation_reason: appointment?.cancellationReason || 'Tu agenda fue cancelada.',
      action_label: 'Cancelación de agenda',
      status_label: 'Cancelada',
    },
    APP_CONFIG.emailjs.cancellationTemplateId || APP_CONFIG.emailjs.templateId,
  );
}
