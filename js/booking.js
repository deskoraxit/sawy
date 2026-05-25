
// --- Spanish forced description (100% always ES) ---
function __getESDescription(photo, query){
  try{
    const base = query || "manicura";
    return `Imagen de ${base} con manos y uñas cuidadas`;
  }catch(e){
    return "Imagen de manicura";
  }
}

import { initFirebase } from './core/firebase.js';
import { get, list, create, update, subscribe } from './core/store.js';
import { escapeHTML, formatDate, formatCurrency, toDateInputValue, normalizePhone } from './core/dom.js';
import { notify } from './core/toast.js';
import { icon } from './core/icons.js';
import { sendAppointmentConfirmation } from './core/appointmentEmail.js';
import { initTheme, wireThemeToggles } from './core/theme.js';

const app = document.getElementById('app');
const STEP_MINUTES = 60;
const FALLBACK_DURATION = 60;
const MIN_PUBLIC_BLOCK_MINUTES = 60;
const BOOKING_FORM_KEY = 'sawy_booking_form';
const BOOKING_FORM_TTL = 15 * 60 * 1000; // 15 minutos en milisegundos

function saveBookingForm(state) {
  const data = {
    name: document.getElementById('client-name')?.value || '',
    phone: document.getElementById('client-phone')?.value || '',
    email: document.getElementById('client-email')?.value || '',
    date: state.selectedDate,
    time: state.selectedTime,
    promotionId: state.selectedPromotionId,
    timestamp: Date.now(),
  };
  localStorage.setItem(BOOKING_FORM_KEY, JSON.stringify(data));
}

function loadBookingForm() {
  const stored = localStorage.getItem(BOOKING_FORM_KEY);
  if (!stored) return null;
  try {
    const data = JSON.parse(stored);
    if (Date.now() - data.timestamp > BOOKING_FORM_TTL) {
      localStorage.removeItem(BOOKING_FORM_KEY);
      return null;
    }
    return data;
  } catch {
    localStorage.removeItem(BOOKING_FORM_KEY);
    return null;
  }
}

function clearBookingForm() {
  localStorage.removeItem(BOOKING_FORM_KEY);
}

function getOwnerId() {
  const search = new URLSearchParams(window.location.search || '');
  return search.get('owner') || search.get('ownerId') || search.get('uid') || search.get('userId') || search.get('salon') || '';
}

function parseDateOnly(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function timeToMinutes(time) {
  const [hours, minutes] = String(time || '00:00').split(':').map(Number);
  return (hours * 60) + (minutes || 0);
}

function minutesToTime(totalMinutes) {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mins = String(minutes % 60).padStart(2, '0');
  return `${hours}:${mins}`;
}

function addMinutesToTime(time, minutesToAdd) {
  return minutesToTime(timeToMinutes(time) + minutesToAdd);
}

function sameDay(a, b) {
  return a && b && a.toDateString() === b.toDateString();
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeDayName(value) {
  const key = normalizeText(value);
  const map = {
    domingo: 'domingo', sun: 'domingo', sunday: 'domingo',
    lunes: 'lunes', mon: 'lunes', monday: 'lunes',
    martes: 'martes', tue: 'martes', tuesday: 'martes',
    miercoles: 'miercoles', miércoles: 'miercoles', wed: 'miercoles', wednesday: 'miercoles',
    jueves: 'jueves', thu: 'jueves', thursday: 'jueves',
    viernes: 'viernes', fri: 'viernes', friday: 'viernes',
    sabado: 'sabado', sábado: 'sabado', sat: 'sabado', saturday: 'sabado',
  };
  return map[key] || key;
}

function dayNameKey(date) {
  return ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][date.getDay()];
}

function getScheduleDay(schedule) {
  return normalizeDayName(schedule?.dayOfWeek || schedule?.day || schedule?.weekday || schedule?.dia || schedule?.dayName || schedule?.day_of_week);
}

function getAppointmentDate(apt) {
  return apt?.appointmentDate || apt?.date || apt?.day || apt?.fecha || '';
}

function getAppointmentStartTime(apt) {
  return apt?.startTime || apt?.start || apt?.time || apt?.hora || '';
}

function getAppointmentEndTime(apt) {
  return apt?.endTime || apt?.end || apt?.to || apt?.horaFin || apt?.finish || '';
}

function getDurationMinutes(value, fallbackMinutes = FALLBACK_DURATION) {
  const normalized = Number(String(value ?? '').replace(/[^\d.]/g, ''));
  if (Number.isFinite(normalized) && normalized > 0) return Math.max(1, Math.round(normalized));
  return Math.max(1, Math.round(Number(fallbackMinutes || FALLBACK_DURATION)));
}

function getAppointmentDurationMinutes(apt, fallbackMinutes = FALLBACK_DURATION, services = []) {
  const explicitDuration = getDurationMinutes(
    apt?.duration || apt?.durationMinutes || apt?.minutes || apt?.serviceDuration,
    0
  );
  if (explicitDuration) return explicitDuration;

  const serviceId = String(apt?.serviceId || apt?.service?.id || '').trim();
  if (serviceId) {
    const service = (Array.isArray(services) ? services : []).find((item) => String(item?.id || '') === serviceId);
    const serviceDuration = getDurationMinutes(service?.duration || service?.durationMinutes || service?.minutes, 0);
    if (serviceDuration) return serviceDuration;
  }

  return Math.max(1, Math.round(Number(fallbackMinutes || FALLBACK_DURATION)));
}

function getAppointmentEndOrFallback(apt, fallbackMinutes = FALLBACK_DURATION, services = []) {
  const endTime = getAppointmentEndTime(apt);
  if (endTime) return endTime;
  const startTime = getAppointmentStartTime(apt);
  if (!startTime) return '';
  return addMinutesToTime(startTime, getAppointmentDurationMinutes(apt, fallbackMinutes, services));
}

function parseLocalDateTime(date, time) {
  if (!date || !time) return null;
  return new Date(`${date}T${time}`);
}

function isConflict(candidate, existing, services = []) {
  if (!candidate || !existing) return false;
  const candidateDate = getAppointmentDate(candidate);
  const existingDate = getAppointmentDate(existing);
  if (!candidateDate || candidateDate !== existingDate) return false;
  if (existing.status === 'cancelada') return false;

  const candidateStart = parseLocalDateTime(candidateDate, getAppointmentStartTime(candidate));
  const candidateEnd = parseLocalDateTime(candidateDate, getAppointmentEndTime(candidate) || getAppointmentStartTime(candidate));
  const existingStart = parseLocalDateTime(existingDate, getAppointmentStartTime(existing));
  const existingEnd = parseLocalDateTime(existingDate, getAppointmentEndOrFallback(existing, FALLBACK_DURATION, services) || getAppointmentStartTime(existing));

  if (!candidateStart || !candidateEnd || !existingStart || !existingEnd) return false;
  return candidateStart < existingEnd && existingStart < candidateEnd;
}

function isPastDateTime(date, time) {
  const selected = parseLocalDateTime(date, time);
  return !!selected && selected < new Date();
}

function getAvailableSlots(dateValue, schedules, appointments, durationMinutes, services = []) {
  if (!dateValue) return [];
  const date = parseDateOnly(dateValue);
  if (!date) return [];

  const today = new Date();
  const selectedDay = dayNameKey(date);
  const normalizedSchedules = (Array.isArray(schedules) ? schedules : []).map((schedule) => ({
    ...schedule,
    _normalizedDay: getScheduleDay(schedule),
  }));
  let relevantSchedules = normalizedSchedules.filter((schedule) => schedule._normalizedDay === selectedDay);

  // Si no hay horarios guardados o el proyecto usa otro nombre de campo, probamos una agenda base.
  if (!relevantSchedules.length) {
    const fallback = [
      { dayOfWeek: 'lunes', startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 'martes', startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 'miercoles', startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 'jueves', startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 'viernes', startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 'sabado', startTime: '09:00', endTime: '18:00' },
    ];
    relevantSchedules = fallback.filter((schedule) => schedule.dayOfWeek === selectedDay);
  }
  if (!relevantSchedules.length) return [];

  const validAppointments = (Array.isArray(appointments) ? appointments : []).filter((apt) => apt.status !== 'cancelada');
  const slots = new Set();
  const duration = Math.max(MIN_PUBLIC_BLOCK_MINUTES, Math.max(15, Number(durationMinutes || FALLBACK_DURATION)));

  for (const schedule of relevantSchedules) {
    const dayStart = timeToMinutes(schedule.startTime || '09:00');
    const dayEnd = timeToMinutes(schedule.endTime || '18:00');

    for (let start = dayStart; start + duration <= dayEnd; start += STEP_MINUTES) {
      const startTime = minutesToTime(start);
      const endTime = addMinutesToTime(startTime, duration);
      const candidate = { appointmentDate: dateValue, startTime, endTime };

      if (sameDay(date, today) && isPastDateTime(dateValue, startTime)) continue;
      if (validAppointments.some((apt) => isConflict(candidate, apt, services))) continue;
      slots.add(startTime);
    }
  }

  return [...slots].sort((a, b) => a.localeCompare(b));
}

function buildNextDates(schedules, appointments, durationMinutes, services = [], daysAhead = 30) {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < daysAhead; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const key = toDateInputValue(date);
    const slots = getAvailableSlots(key, schedules, appointments, durationMinutes, services);
    if (slots.length) dates.push({ key, slots: slots.length, label: formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' }) });
  }
  return dates;
}

function getPublicSchedules(owner, schedules) {
  if (Array.isArray(schedules) && schedules.length) return schedules;

  // Fallback visual mínimo para que la reserva pública no quede vacía si el negocio aún no guardó horarios.
  const hasName = !!(owner?.salonName || owner?.name);
  return hasName ? [
    { dayOfWeek: 'lunes', startTime: '09:00', endTime: '18:00' },
    { dayOfWeek: 'martes', startTime: '09:00', endTime: '18:00' },
    { dayOfWeek: 'miercoles', startTime: '09:00', endTime: '18:00' },
    { dayOfWeek: 'jueves', startTime: '09:00', endTime: '18:00' },
    { dayOfWeek: 'viernes', startTime: '09:00', endTime: '18:00' },
    { dayOfWeek: 'sabado', startTime: '09:00', endTime: '18:00' },
  ] : [];
}


function getPublicBookingDuration(owner, services = []) {
  const explicitDuration = getDurationMinutes(owner?.publicBookingDuration, 0);
  if (explicitDuration) return Math.max(MIN_PUBLIC_BLOCK_MINUTES, Math.max(15, explicitDuration));

  const serviceDurations = (Array.isArray(services) ? services : [])
    .map((service) => getDurationMinutes(service?.duration || service?.durationMinutes || service?.minutes, 0))
    .filter((minutes) => Number.isFinite(minutes) && minutes > 0);

  const defaultDuration = serviceDurations.length ? Math.min(...serviceDurations) : FALLBACK_DURATION;
  return Math.max(MIN_PUBLIC_BLOCK_MINUTES, Math.max(15, defaultDuration));
}

function getActivePromotions(promotions = [], referenceDate = toDateInputValue()) {
  const ref = referenceDate || toDateInputValue();
  return (Array.isArray(promotions) ? promotions : [])
    .filter((promo) => String(promo?.status || '').toLowerCase() === 'active')
    .filter((promo) => !promo?.validUntil || String(promo.validUntil) >= ref)
    .sort((a, b) => String(a.validUntil || '9999-12-31').localeCompare(String(b.validUntil || '9999-12-31')));
}

function promotionLabel(promo) {
  if (!promo) return '';
  return promo.discountType === 'percentage'
    ? `${Number(promo.discountValue || 0)}%`
    : formatCurrency(promo.discountValue);
}

function publicHeaderHTML(owner = null) {
  return `
    <div class="booking-hero card">
      <div class="panel booking-hero-top">
        <div class="booking-brand">
          <div class="brand-mark brand-logo" style="width:54px;height:54px"><img src="./assets/sawy-logo-icon.png" alt="Sawy"></div>
          <div>
            <div class="brand-name">Sawy</div>
            <div class="helper">Reserva pública</div>
          </div>
        </div>
        <button class="btn icon ghost js-theme-toggle theme-toggle" type="button" aria-label="Cambiar tema"></button>
      </div>
      <div>
        <h1 class="page-title" style="margin:0 0 8px">${escapeHTML(owner?.salonName || owner?.name || 'Reserva tu cita')}</h1>
        <p class="page-subtitle" style="max-width:72ch">Selecciona el día y la hora disponibles.</p>
      </div>
      <div class="booking-summary">
        <div class="booking-mini"><strong>1</strong><span class="helper">Completa tus datos</span></div>
        <div class="booking-mini"><strong>2</strong><span class="helper">Elige horario disponible</span></div>
        <div class="booking-mini"><strong>3</strong><span class="helper">Confirma tu reserva</span></div>
      </div>
    </div>
  `;
}

function loadingHTML() {
  return `
    <div class="booking-shell">
      <div class="booking-wrap">
        ${publicHeaderHTML(null)}
        <div class="grid cols-2 booking-grid">
          <div class="card"><div class="card-body">Cargando disponibilidad...</div></div>
          <div class="card"><div class="card-body">Cargando formulario...</div></div>
        </div>
      </div>
    </div>
  `;
}

function emptyOwnerHTML() {
  return `
    <div class="booking-shell">
      <div class="booking-wrap">
        <div class="booking-hero card">
          <div class="panel booking-hero-top">
            <div class="booking-brand">
              <div class="brand-mark brand-logo" style="width:54px;height:54px"><img src="./assets/sawy-logo-icon.png" alt="Sawy"></div>
              <div>
                <div class="brand-name">Sawy</div>
                <div class="helper">Enlace de reserva pública</div>
              </div>
            </div>
            <button class="btn icon ghost js-theme-toggle theme-toggle" type="button" aria-label="Cambiar tema"></button>
          </div>
          <h1 class="page-title" style="margin:0">Falta el enlace del salón</h1>
          <p class="page-subtitle">Abre esta página con el parámetro <strong>?owner=ID</strong> para mostrar la disponibilidad correcta del negocio.</p>
          <div class="public-note">Desde el panel del salón podrás copiar el enlace público y compartirlo con tus clientes.</div>
        </div>
      </div>
    </div>
  `;
}

function renderPublicBookingHTML(state) {
  const availableDates = buildNextDates(state.schedules, state.appointments, state.duration, state.services);
  const selectedSlots = getAvailableSlots(state.selectedDate, state.schedules, state.appointments, state.duration, state.services);
  const selectedDateLabel = state.selectedDate ? formatDate(parseDateOnly(state.selectedDate), { weekday: 'long', day: 'numeric', month: 'long' }) : 'Selecciona una fecha';
  const activePromotions = getActivePromotions(state.promotions, state.selectedDate);
  const selectedPromotion = activePromotions.find((promo) => promo.id === state.selectedPromotionId) || null;

  return `
    <div class="booking-shell">
      <div class="booking-wrap">
        ${publicHeaderHTML(state.owner)}
        ${activePromotions.length ? `
          <section class="card booking-promotions-card">
            <div class="card-header">
              <div class="card-title">Promociones activas</div>
              <div class="card-desc">Descuentos disponibles para tu reserva</div>
            </div>
            <div class="card-body">
              <div class="booking-promotions">
                ${activePromotions.map((promo) => `
                  <div class="promotion-item ${promo.id === (selectedPromotion?.id || '') ? 'active' : ''}">
                    <div class="promotion-pill">${escapeHTML(promotionLabel(promo))}</div>
                    <div>
                      <strong>${escapeHTML(promo.name || 'Promoción')}</strong>
                      <div class="helper">Válida hasta ${escapeHTML(formatDate(promo.validUntil))}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
              <div class="public-note" style="margin-top:12px">Elige una promoción al reservar para que el salón aplique el descuento en tu cita.</div>
            </div>
          </section>
        ` : ''}
        <div class="grid cols-2 booking-grid">
          <section class="card">
            <div class="card-header">
              <div class="card-title">Disponibilidad</div>
              <div class="card-desc">Horario activo: ${escapeHTML(state.duration)} min por reserva</div>
            </div>
            <div class="card-body booking-panel">
              <div>
                <label class="label" for="booking-date">Fecha</label>
                <input class="input" id="booking-date" type="date" min="${escapeHTML(toDateInputValue())}" value="${escapeHTML(state.selectedDate || availableDates[0]?.key || '')}">
              </div>
              <div>
                <label class="label" for="booking-time">Hora disponible</label>
                <select class="select" id="booking-time" ${selectedSlots.length ? '' : 'disabled'}>
                  ${selectedSlots.length ? selectedSlots.map((slot) => `<option value="${escapeHTML(slot)}" ${slot === state.selectedTime ? 'selected' : ''}>${escapeHTML(slot)}</option>`).join('') : '<option value="">No hay horas disponibles</option>'}
                </select>
                <div class="helper" id="booking-date-label">${escapeHTML(selectedDateLabel)}</div>
              </div>
              <div class="booking-slot-grid" id="booking-slot-grid">
                ${selectedSlots.length ? selectedSlots.map((slot) => `<button type="button" class="btn outline booking-slot ${slot === state.selectedTime ? 'active' : ''}" data-time="${escapeHTML(slot)}">${escapeHTML(slot)}</button>`).join('') : '<div class="public-note">Selecciona otra fecha para ver más horarios.</div>'}
              </div>
            </div>
          </section>

          <section class="card">
            <div class="card-header">
              <div class="card-title">Datos de la reserva</div>
              <div class="card-desc">Te contactaremos con la información que indiques</div>
            </div>
            <div class="card-body">
              <form id="booking-form" class="form-stack">
                <div class="field">
                  <label class="label" for="client-name">Nombre</label>
                  <input class="input" id="client-name" name="name" type="text" placeholder="Tu nombre" required>
                </div>
                <div class="form-grid">
                  <div class="field">
                    <label class="label" for="client-phone">Teléfono</label>
                    <input class="input" id="client-phone" name="phone" type="tel" placeholder="300 000 0000" required>
                  </div>
                  <div class="field">
                    <label class="label" for="client-email">Correo</label>
                    <input class="input" id="client-email" name="email" type="email" placeholder="correo@ejemplo.com" required>
                  </div>
                </div>
                ${activePromotions.length ? `
                  <div class="field">
                    <label class="label" for="booking-promotion">Promoción aplicable</label>
                    <select class="select" id="booking-promotion" name="promotionId">
                      <option value="">Sin promoción</option>
                      ${activePromotions.map((promo) => `<option value="${escapeHTML(promo.id)}" ${promo.id === (selectedPromotion?.id || '') ? 'selected' : ''}>${escapeHTML(promo.name || 'Promoción')} · ${escapeHTML(promotionLabel(promo))}</option>`).join('')}
                    </select>
                    <div class="helper" id="booking-promotion-label">${selectedPromotion ? `Descuento seleccionado: ${escapeHTML(selectedPromotion.name || 'Promoción')} · ${escapeHTML(promotionLabel(selectedPromotion))}` : 'Puedes elegir un descuento disponible para esta fecha.'}</div>
                  </div>
                ` : ''}
                <input type="hidden" name="appointmentDate" id="form-date" value="${escapeHTML(state.selectedDate || availableDates[0]?.key || '')}">
                <input type="hidden" name="startTime" id="form-time" value="${escapeHTML(state.selectedTime || selectedSlots[0] || '')}">
                <div class="card" style="background:rgba(251,247,255,.84)">
                  <div class="card-body">
                    <div class="public-note"><strong>Reserva seleccionada</strong><br><span id="booking-summary">${escapeHTML(selectedDateLabel)} · ${escapeHTML(state.selectedTime || 'Sin hora seleccionada')}${selectedPromotion ? ` · ${selectedPromotion.name || 'Promoción'}` : ''}</span></div>
                  </div>
                </div>
                <div class="toolbar">
                  <button class="btn primary" type="submit" id="booking-submit" ${selectedSlots.length ? '' : 'disabled'}>
                    <span>${icon('calendar')}</span>
                    Reservar cita
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}

async function findOrCreateClient(ownerId, data) {
  const clients = await list('clients', { userId: ownerId });
  const email = String(data.email || '').trim().toLowerCase();
  const phone = normalizePhone(data.phone || '');
  const existing = clients.find((client) => {
    const clientEmail = String(client.email || '').trim().toLowerCase();
    const clientPhone = normalizePhone(client.phone || '');
    return (email && clientEmail && email === clientEmail) || (phone && clientPhone && phone === clientPhone);
  });

  if (existing) {
    const payload = {
      userId: ownerId,
      name: data.name,
      phone: data.phone,
      email: data.email,
    };
    try {
      await update('clients', existing.id, payload);
    } catch {
      // Si falla la actualización, seguimos usando el registro existente.
    }
    return existing.id;
  }

  const created = await create('clients', {
    userId: ownerId,
    name: data.name,
    phone: data.phone,
    email: data.email,
  });
  return created.id;
}

export async function bootBookingPage() {
  initTheme();
  await initFirebase();

  const state = {
    ownerId: getOwnerId(),
    owner: null,
    services: [],
    schedules: [],
    appointments: [],
    promotions: [],
    selectedPromotionId: '',
    duration: FALLBACK_DURATION,
    selectedDate: toDateInputValue(),
    selectedTime: '',
    loading: true,
  };

  let destroyed = false;
  let refreshTimer = null;
  const cleanupFns = [];
  let formSaveTimeout = null;
  let formListenersAttached = false;

  const scheduleFormClear = () => {
    clearTimeout(formSaveTimeout);
    formSaveTimeout = setTimeout(() => {
      clearBookingForm();
      // Opcional: mostrar notificación de que el formulario expiró
      // notify.info('El formulario ha expirado después de 15 minutos de inactividad');
    }, BOOKING_FORM_TTL);
  };

  const resetFormClearTimeout = () => {
    scheduleFormClear();
  };

  const scheduleRefresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (!destroyed) refresh();
    }, 50);
  };
  const cleanup = () => {
    destroyed = true;
    clearTimeout(refreshTimer);
    cleanupFns.splice(0).forEach((fn) => fn?.());
  };

  const render = () => {
    app.innerHTML = state.loading ? loadingHTML() : (state.ownerId && state.owner ? renderPublicBookingHTML(state) : emptyOwnerHTML());
    wireThemeToggles(app);
  };

  const syncInputs = () => {
    const dateInput = document.getElementById('booking-date');
    const timeSelect = document.getElementById('booking-time');
    const dateLabel = document.getElementById('booking-date-label');
    const summary = document.getElementById('booking-summary');
    const formDate = document.getElementById('form-date');
    const formTime = document.getElementById('form-time');
    const submitBtn = document.getElementById('booking-submit');
    const slotGrid = document.getElementById('booking-slot-grid');
    const promotionSelect = document.getElementById('booking-promotion');
    const promotionLabelEl = document.getElementById('booking-promotion-label');
    const clientNameInput = document.getElementById('client-name');
    const clientPhoneInput = document.getElementById('client-phone');
    const clientEmailInput = document.getElementById('client-email');

    if (!dateInput || !timeSelect || !dateLabel || !summary || !formDate || !formTime || !submitBtn || !slotGrid) return;

    // Restaurar datos del formulario guardado
    const savedForm = loadBookingForm();
    if (savedForm) {
      if (clientNameInput && savedForm.name) clientNameInput.value = savedForm.name;
      if (clientPhoneInput && savedForm.phone) clientPhoneInput.value = savedForm.phone;
      if (clientEmailInput && savedForm.email) clientEmailInput.value = savedForm.email;
      if (savedForm.date) state.selectedDate = savedForm.date;
      if (savedForm.time) state.selectedTime = savedForm.time;
      if (savedForm.promotionId) state.selectedPromotionId = savedForm.promotionId;
    }

    // Iniciar timeout de expiración del formulario
    scheduleFormClear();

    const slots = getAvailableSlots(state.selectedDate, state.schedules, state.appointments, state.duration, state.services);
    const activePromotions = getActivePromotions(state.promotions, state.selectedDate);
    let selectedPromotion = activePromotions.find((promo) => promo.id === state.selectedPromotionId) || null;
    if (!selectedPromotion && activePromotions.length) {
      state.selectedPromotionId = activePromotions[0].id;
      selectedPromotion = activePromotions[0];
    }
    const selectedDate = parseDateOnly(state.selectedDate);
    const selectedDateLabel = selectedDate ? formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' }) : 'Selecciona una fecha';

    dateInput.value = state.selectedDate || '';
    formDate.value = state.selectedDate || '';
    dateLabel.textContent = selectedDateLabel;
    summary.textContent = `${selectedDateLabel} · ${state.selectedTime || 'Sin hora seleccionada'}${selectedPromotion ? ` · ${selectedPromotion.name || 'Promoción'}` : ''}`;

    timeSelect.innerHTML = slots.length
      ? slots.map((slot) => `<option value="${escapeHTML(slot)}" ${slot === state.selectedTime ? 'selected' : ''}>${escapeHTML(slot)}</option>`).join('')
      : '<option value="">No hay horas disponibles</option>';
    timeSelect.disabled = !slots.length;

    slotGrid.innerHTML = slots.length
      ? slots.map((slot) => `<button type="button" class="btn outline booking-slot ${slot === state.selectedTime ? 'active' : ''}" data-time="${escapeHTML(slot)}">${escapeHTML(slot)}</button>`).join('')
      : '<div class="public-note">Selecciona otra fecha para ver más horarios.</div>';

    formTime.value = state.selectedTime || '';
    submitBtn.disabled = !slots.length || !state.selectedTime;

    if (promotionSelect) {
      promotionSelect.innerHTML = `<option value="">Sin promoción</option>` + activePromotions.map((promo) => `<option value="${escapeHTML(promo.id)}" ${promo.id === state.selectedPromotionId ? 'selected' : ''}>${escapeHTML(promo.name || 'Promoción')} · ${escapeHTML(promotionLabel(promo))}</option>`).join('');
      promotionSelect.value = state.selectedPromotionId && activePromotions.some((promo) => promo.id === state.selectedPromotionId) ? state.selectedPromotionId : '';
    }
    if (promotionLabelEl) {
      promotionLabelEl.textContent = selectedPromotion ? `Descuento seleccionado: ${selectedPromotion.name || 'Promoción'} · ${promotionLabel(selectedPromotion)}` : 'Puedes elegir un descuento disponible para esta fecha.';
    }

    document.querySelectorAll('.booking-date-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.date === state.selectedDate);
    });

    // Adjuntar listeners para guardar formulario (solo una vez)
    if (!formListenersAttached) {
      formListenersAttached = true;
      
      const form = document.getElementById('booking-form');
      if (form) {
        // Guardar cuando cambian los campos de texto
        const textInputs = form.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"]');
        textInputs.forEach(input => {
          input.addEventListener('input', () => {
            saveBookingForm(state);
            resetFormClearTimeout();
          });
        });
        
        // Guardar cuando cambia la fecha
        if (dateInput) {
          dateInput.addEventListener('change', () => {
            saveBookingForm(state);
            resetFormClearTimeout();
          });
        }
        
        // Guardar cuando cambia la hora
        if (timeSelect) {
          timeSelect.addEventListener('change', () => {
            saveBookingForm(state);
            resetFormClearTimeout();
          });
        }
        
        // Guardar cuando cambia la promoción
        if (promotionSelect) {
          promotionSelect.addEventListener('change', () => {
            saveBookingForm(state);
            resetFormClearTimeout();
          });
        }
        
        // Limpiar formulario guardado cuando se envía
        form.addEventListener('submit', () => {
          clearBookingForm();
          clearTimeout(formSaveTimeout);
        });
      }
    }
  };

  const refresh = async () => {
    if (!state.ownerId) {
      state.loading = false;
      render();
      return;
    }

    const [owner, services, schedules, appointments, promotions] = await Promise.all([
      get('users', state.ownerId),
      list('services', { userId: state.ownerId }),
      list('schedules', { userId: state.ownerId }),
      list('appointments', { userId: state.ownerId }),
      list('promotions', { userId: state.ownerId }),
    ]);

    state.owner = owner;
    state.services = services;
    state.schedules = getPublicSchedules(owner, schedules);
    state.appointments = appointments;
    state.promotions = promotions || [];
    const firstActivePromotion = getActivePromotions(state.promotions, state.selectedDate)[0] || null;
    state.selectedPromotionId = state.selectedPromotionId && (promotions || []).some((p) => p.id === state.selectedPromotionId)
      ? state.selectedPromotionId
      : (firstActivePromotion?.id || '');
    state.duration = getPublicBookingDuration(owner, services);

    const availableDates = buildNextDates(state.schedules, state.appointments, state.duration, state.services);
    const preferredDate = state.selectedDate && getAvailableSlots(state.selectedDate, state.schedules, state.appointments, state.duration, state.services).length
      ? state.selectedDate
      : availableDates[0]?.key || toDateInputValue();
    state.selectedDate = preferredDate;

    const dateSlots = getAvailableSlots(state.selectedDate, state.schedules, state.appointments, state.duration, state.services);
    state.selectedTime = dateSlots.includes(state.selectedTime) ? state.selectedTime : (dateSlots[0] || '');

    state.loading = false;
    render();

    if (!state.owner) {
      notify.error('No se encontró el salón indicado en el enlace');
      return;
    }

    syncInputs();

    const dateInput = document.getElementById('booking-date');
    const timeSelect = document.getElementById('booking-time');
    const submitBtn = document.getElementById('booking-submit');
    const dateChips = document.getElementById('booking-date-chips');
    const promotionSelect = document.getElementById('booking-promotion');
    const form = document.getElementById('booking-form');

    dateInput?.addEventListener('change', () => {
      state.selectedDate = dateInput.value;
      const slots = getAvailableSlots(state.selectedDate, state.schedules, state.appointments, state.duration, state.services);
    const activePromotions = getActivePromotions(state.promotions, state.selectedDate);
    let selectedPromotion = activePromotions.find((promo) => promo.id === state.selectedPromotionId) || null;
    if (!selectedPromotion && activePromotions.length) {
      state.selectedPromotionId = activePromotions[0].id;
      selectedPromotion = activePromotions[0];
    }
      state.selectedTime = slots[0] || '';
      syncInputs();
    });

    timeSelect?.addEventListener('change', () => {
      state.selectedTime = timeSelect.value;
      syncInputs();
    });

    promotionSelect?.addEventListener('change', () => {
      state.selectedPromotionId = promotionSelect.value || '';
      syncInputs();
    });

    dateChips?.addEventListener('click', (e) => {
      const btn = e.target.closest('.booking-date-btn');
      if (!btn) return;
      state.selectedDate = btn.dataset.date || state.selectedDate;
      const slots = getAvailableSlots(state.selectedDate, state.schedules, state.appointments, state.duration, state.services);
    const activePromotions = getActivePromotions(state.promotions, state.selectedDate);
    let selectedPromotion = activePromotions.find((promo) => promo.id === state.selectedPromotionId) || null;
    if (!selectedPromotion && activePromotions.length) {
      state.selectedPromotionId = activePromotions[0].id;
      selectedPromotion = activePromotions[0];
    }
      state.selectedTime = slots[0] || '';
      syncInputs();
    });

    document.getElementById('booking-slot-grid')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.booking-slot');
      if (!btn) return;
      state.selectedTime = btn.dataset.time || '';
      saveBookingForm(state);
      resetFormClearTimeout();
      syncInputs();
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get('name') || '').trim();
      const phone = String(fd.get('phone') || '').trim();
      const email = String(fd.get('email') || '').trim();
      const appointmentDate = String(fd.get('appointmentDate') || '').trim();
      const startTime = String(fd.get('startTime') || '').trim();

      if (!name || !phone || !email || !appointmentDate || !startTime) {
        notify.error('Completa todos los datos y elige un horario disponible');
        return;
      }
      if (appointmentDate < toDateInputValue()) {
        notify.error('No puedes reservar en días pasados');
        return;
      }
      if (!getAvailableSlots(appointmentDate, state.schedules, state.appointments, state.duration, state.services).includes(startTime)) {
        notify.error('Ese horario ya no está disponible');
        return;
      }

      const latestAppointments = await list('appointments', { userId: state.ownerId });
      if (!getAvailableSlots(appointmentDate, state.schedules, latestAppointments, state.duration, state.services).includes(startTime)) {
        state.appointments = latestAppointments;
        notify.error('Ese horario ya fue tomado por otra persona');
        syncInputs();
        return;
      }

      const endTime = addMinutesToTime(startTime, state.duration);
      const activePromotions = getActivePromotions(state.promotions, appointmentDate);
      const selectedPromotion = activePromotions.find((promo) => promo.id === state.selectedPromotionId) || null;

      try {
        const clientId = await findOrCreateClient(state.ownerId, { name, phone, email });
        const savedAppointment = await create('appointments', {
          userId: state.ownerId,
          clientId,
          clientName: name,
          serviceId: state.services[0]?.id || '',
          serviceName: state.services[0]?.name || 'Reserva web pública',
          appointmentDate,
          startTime,
          endTime,
          status: 'pendiente',
          notes: selectedPromotion
            ? `Reserva realizada desde la web pública · Promoción: ${selectedPromotion.name} (${promotionLabel(selectedPromotion)})`
            : 'Reserva realizada desde la web pública',
          source: 'public-booking',
          promotionId: selectedPromotion?.id || '',
          promotionName: selectedPromotion?.name || '',
          promotionDiscountType: selectedPromotion?.discountType || '',
          promotionDiscountValue: selectedPromotion?.discountValue || '',
        });

        notify.success(selectedPromotion ? 'Tu cita fue reservada con descuento' : 'Tu cita fue reservada con éxito');
        try {
          await sendAppointmentConfirmation({
            ...savedAppointment,
            userId: state.ownerId,
            salonName: state.owner?.salonName || state.owner?.name || '',
          });
        } catch (error) {
          console.warn('No se pudo enviar el correo de confirmación:', error);
        }
        form.reset();
        state.appointments = await list('appointments', { userId: state.ownerId });
        state.selectedTime = '';
        state.selectedDate = appointmentDate;
        state.selectedPromotionId = getActivePromotions(state.promotions, appointmentDate)[0]?.id || '';
        const updatedSlots = getAvailableSlots(appointmentDate, state.schedules, state.appointments, state.duration, state.services);
        state.selectedTime = updatedSlots[0] || '';
        syncInputs();
      } catch (error) {
        console.error(error);
        notify.error('No se pudo guardar la reserva');
      }
    });

    syncInputs();
  };

  render();
  await refresh();

  if (state.ownerId) {
    cleanupFns.push(
      await subscribe('appointments', { userId: state.ownerId }, scheduleRefresh),
      await subscribe('services', { userId: state.ownerId }, scheduleRefresh),
      await subscribe('schedules', { userId: state.ownerId }, scheduleRefresh),
      await subscribe('promotions', { userId: state.ownerId }, scheduleRefresh),
    );
    window.addEventListener('beforeunload', cleanup);
  }

  return cleanup;
}

document.addEventListener('DOMContentLoaded', () => {
  bootBookingPage().catch((error) => {
    console.error(error);
    app.innerHTML = `
      <div class="booking-shell">
        <div class="booking-wrap">
          <div class="booking-hero card">
            <h1 class="page-title" style="margin:0">No se pudo cargar la reserva pública</h1>
            <p class="page-subtitle">Revisa la configuración de Firebase o el enlace del salón.</p>
          </div>
        </div>
      </div>
    `;
  });
});
