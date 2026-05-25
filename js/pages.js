
// --- Spanish forced description (100% always ES) ---
function __getESDescription(photo, query){
  try{
    const base = query || "manicura";
    return `Imagen de ${base} con manos y uñas cuidadas`;
  }catch(e){
    return "Imagen de manicura";
  }
}

const NO_PAST_DATES = true;

import { pageShell, renderAuthShell, emptyState, field, confirmDialog } from './core/ui.js';
import { icon } from './core/icons.js';
import { escapeHTML, formatCurrency, formatDate, formatDateTime, toDateInputValue, toMonthTitle, compareText, downloadText, uid } from './core/dom.js';
import { navigate, routeLabel } from './core/router.js';
import { notify } from './core/toast.js';
import { getCurrentUser, signup, login, updateUserProfile, changePassword } from './core/auth.js';
import { list, get, create, update, remove, getUserProfile, subscribe } from './core/store.js';
import { APP_CONFIG, isPlaceholder } from './config.js';
import { sendEmailJs } from './core/emailjs.js';
import { sendAppointmentConfirmation, sendAppointmentCancellation } from './core/appointmentEmail.js';
import { getRecommendations } from './core/recommendations.js';

const weekdays = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
const weekdayLabels = {lunes:'Lunes',martes:'Martes',miercoles:'Miércoles',jueves:'Jueves',viernes:'Viernes',sabado:'Sábado',domingo:'Domingo'};
const appointmentStatuses = {
  pendiente: { label: 'Pendiente', cls: 'warning' },
  confirmada: { label: 'Confirmada', cls: 'success' },
  en_proceso: { label: 'En curso', cls: 'success' },
  cancelada: { label: 'Cancelada', cls: 'danger' },
  finalizada: { label: 'Finalizada', cls: 'finalized' },
};

function getToday() {
  return toDateInputValue(new Date());
}

function getNowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isPastDateTime(date, time) {
  const now = new Date();
  const selected = new Date(`${date}T${time}`);
  return selected < now;
}

function monthDays(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const days = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  return days;
}
function parseDateOnly(value) {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const d = new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatLocalDate(value, options = {}) {
  const d = parseDateOnly(value);
  return d.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

function sameDay(a, b) {
  return parseDateOnly(a).toDateString() === parseDateOnly(b).toDateString();
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function addMonths(date, n) { const d = new Date(date); d.setMonth(d.getMonth() + n); return d; }

function parseLocalDateTime(date, time) {
  if (!date || !time) return null;
  return new Date(`${date}T${time}`);
}

function getDurationMinutes(value, fallbackMinutes = 30) {
  const normalized = Number(String(value ?? '').replace(/[^\d.]/g, ''));
  if (Number.isFinite(normalized) && normalized > 0) return Math.max(1, Math.round(normalized));
  const fallback = Number(fallbackMinutes);
  return Number.isFinite(fallback) && fallback > 0 ? Math.max(1, Math.round(fallback)) : 0;
}

function getApplicablePromotion(promotions = [], serviceId = '', referenceDate = getToday()) {
  const ref = referenceDate || getToday();
  const selectedServiceId = String(serviceId || '').trim();
  return (Array.isArray(promotions) ? promotions : [])
    .filter((promo) => String(promo?.status || '').toLowerCase() === 'active')
    .filter((promo) => !promo?.validUntil || String(promo.validUntil) >= ref)
    .filter((promo) => {
      const serviceIds = Array.isArray(promo?.serviceIds) ? promo.serviceIds.map((id) => String(id)) : [];
      return !serviceIds.length || (selectedServiceId && serviceIds.includes(selectedServiceId));
    })
    .sort((a, b) => {
      const aSpecific = Array.isArray(a?.serviceIds) && a.serviceIds.length ? 0 : 1;
      const bSpecific = Array.isArray(b?.serviceIds) && b.serviceIds.length ? 0 : 1;
      if (aSpecific !== bSpecific) return aSpecific - bSpecific;
      return String(a.validUntil || '9999-12-31').localeCompare(String(b.validUntil || '9999-12-31'));
    })[0] || null;
}

function promotionSummary(promotion) {
  if (!promotion) return '';
  return `${promotion.name || 'Promoción'} - ${promotion.discountType === 'percentage' ? `${promotion.discountValue}%` : formatCurrency(promotion.discountValue)}`;
}

function getAppointmentDurationMinutes(apt, fallbackMinutes = 30, services = []) {
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

  return Math.max(1, Math.round(Number(fallbackMinutes || 30)));
}

function getAppointmentEndOrFallback(apt, fallbackMinutes = 30, services = []) {
  const endTime = apt?.endTime || apt?.end || apt?.to || apt?.horaFin || apt?.finish || '';
  if (endTime) return endTime;
  const startTime = apt?.startTime || apt?.start || apt?.time || apt?.hora || '';
  if (!startTime || !apt?.appointmentDate) return '';
  const start = parseLocalDateTime(apt.appointmentDate, startTime);
  if (!start) return '';
  const end = new Date(start.getTime() + getAppointmentDurationMinutes(apt, fallbackMinutes, services) * 60000);
  return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
}

function isAppointmentTimeConflict(candidate, existing, services = []) {
  if (!candidate || !existing) return false;
  if (candidate.appointmentDate !== existing.appointmentDate) return false;
  if (existing.status === 'cancelada') return false;

  const candidateStart = parseLocalDateTime(candidate.appointmentDate, candidate.startTime);
  const candidateEnd = parseLocalDateTime(candidate.appointmentDate, getAppointmentEndOrFallback(candidate, 30, services) || candidate.startTime);
  const existingStart = parseLocalDateTime(existing.appointmentDate, existing.startTime);
  const existingEnd = parseLocalDateTime(existing.appointmentDate, getAppointmentEndOrFallback(existing, 30, services) || existing.startTime);

  if (!candidateStart || !candidateEnd || !existingStart || !existingEnd) return false;
  return candidateStart < existingEnd && existingStart < candidateEnd;
}

function getAppointmentTimeStatus(apt, now = new Date()) {
  if (!apt?.appointmentDate) return 'pendiente';
  if (apt.status === 'cancelada') return 'cancelada';

  const start = parseLocalDateTime(apt.appointmentDate, apt.startTime || '00:00');
  const end = parseLocalDateTime(apt.appointmentDate, getAppointmentEndOrFallback(apt, 30) || apt.startTime || '00:00');
  if (!start || !end) return apt.status || 'pendiente';

  if (now < start) return 'pendiente';
  if (now >= start && now < end) return 'en_proceso';
  return 'finalizada';
}

function isAppointmentFinalized(apt) {
  return getAppointmentTimeStatus(apt) === 'finalizada';
}

function appointmentDisplayStatus(apt) {
  return getAppointmentTimeStatus(apt);
}

async function syncAppointmentStatuses(appointments = [], { persist = false } = {}) {
  const now = new Date();
  const updates = [];

  for (const apt of appointments) {
    if (!apt?.id || apt.status === 'cancelada') continue;
    const nextStatus = getAppointmentTimeStatus(apt, now);
    if (!nextStatus || nextStatus === apt.status) continue;
    if (persist) updates.push(update('appointments', apt.id, { status: nextStatus }));
  }

  if (persist && updates.length) {
    await Promise.all(updates);
  }

  return appointments.map((apt) => (
    apt?.status === 'cancelada'
      ? apt
      : { ...apt, status: getAppointmentTimeStatus(apt, now) }
  ));
}

function appointmentStatusLabel(apt) {
  const key = appointmentDisplayStatus(apt);
  return appointmentStatuses[key]?.label || (apt?.status || 'N/A');
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

function openMediaPreviewModal({ title = '', subtitle = '', image = '', description = '', footer = '' }) {
  const slot = document.createElement('div');
  slot.className = 'media-preview-slot';
  slot.innerHTML = `
    <div class="modal-backdrop open" data-modal="media-preview">
      <div class="modal" style="max-width:min(980px, calc(100vw - 24px));">
        <div class="modal-head">
          <div>
            <h2 class="card-title">${escapeHTML(title)}</h2>
            ${subtitle ? `<p class="card-desc">${escapeHTML(subtitle)}</p>` : ''}
          </div>
          <button class="btn icon ghost js-close" type="button">×</button>
        </div>
        <div class="modal-body">
          ${image ? `
            <div style="border-radius:18px;overflow:hidden;background:var(--surface-2);">
              <img src="${escapeHTML(image)}" alt="${escapeHTML(title || subtitle || 'Vista previa')}" style="width:100%;max-height:min(72vh,760px);object-fit:contain;display:block;background:var(--surface-2);">
            </div>
          ` : `<div class="empty" style="margin:0"><div class="icon">🖼️</div><div class="helper">Sin imagen para mostrar</div></div>`}
          ${description ? `<div class="separator"></div><p class="helper" style="margin:0">${escapeHTML(description)}</p>` : ''}
        </div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div>
    </div>`;
  document.body.appendChild(slot);
  const backdrop = slot.querySelector('.modal-backdrop');
  promoteModalToFront(backdrop);
  const onKeyDown = (event) => {
    if (event.key === 'Escape') close();
  };
  const onBackdropClick = (event) => {
    if (event.target === backdrop) close();
  };
  function close() {
    document.removeEventListener('keydown', onKeyDown);
    backdrop.removeEventListener('click', onBackdropClick);
    slot.remove();
  }
  document.addEventListener('keydown', onKeyDown);
  backdrop.addEventListener('click', onBackdropClick);
  slot.querySelectorAll('.js-close').forEach((button) => button.addEventListener('click', close));
  return { close, slot, backdrop };
}

function appointmentStatusClass(apt) {
  const key = appointmentDisplayStatus(apt);
  return appointmentStatuses[key]?.cls || 'neutral';
}

function appointmentDateTime(apt) {
  return parseLocalDateTime(apt?.appointmentDate, apt?.endTime || apt?.startTime || '00:00');
}

function appointmentChip(apt) {
  const finalized = appointmentDisplayStatus(apt) === 'finalizada';
  const cls = appointmentStatusClass(apt);
  return `<div class="badge ${cls} appointment-chip ${finalized ? 'finalized-chip' : ''}" style="justify-content:flex-start;padding:5px 8px;cursor:grab" draggable="true" data-apt="${apt.id}" title="Arrastra para reprogramar">${escapeHTML(apt.startTime)}${apt.endTime ? `-${escapeHTML(apt.endTime)}` : ''}</div>`;
}

function statusBadge(status) {
  const s = appointmentStatuses[status] || { label: status || 'N/A', cls: 'neutral' };
  return `<span class="badge ${s.cls}">${escapeHTML(s.label)}</span>`;
}
function reminderStatusBadge(status) {
  const map = { enviado: ['Enviado', 'success'], fallido: ['Fallido', 'danger'], pendiente: ['Pendiente', 'warning'] };
  const [label, cls] = map[status] || [status || 'Pendiente', 'neutral'];
  return `<span class="badge ${cls}">${escapeHTML(label)}</span>`;
}

function shellWithHeader(title, subtitle, actions, body) {
  return pageShell({ title, subtitle, actions, content: body });
}

async function loadProfile() {
  const user = getCurrentUser();
  return user || null;
}

function authFields() {
  return `
    <div class="form-stack">
      <div class="field">
        <label class="label">Email</label>
        <input class="input" name="email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Ingresa tu correo electronico" required>
      </div>
      <div class="field">
        <label class="label">Contraseña</label>
        <input class="input" name="password" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" placeholder="Ingresa tu contraseña" required>
      </div>
    </div>
  `;
}

export function loginPage() {
  return {
    html: renderAuthShell(`
      <h1 class="auth-title">Bienvenido a SAWY</h1>
      <p class="auth-desc">Ingresa tus credenciales para continuar</p>
      <form id="login-form" class="form-stack">
        ${authFields()}
        <button class="btn primary" type="submit" style="width:100%">Iniciar sesión</button>
      </form>
      <p class="helper" style="text-align:center;margin-top:16px">¿No tienes cuenta? <a href="#/signup" class="auth-link">Regístrate</a></p>
    `),
    bind(root) {
      root.querySelector('#login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        try {
          const user = await login(fd.get('email'), fd.get('password'));
          if (!user.onboardingCompleted) navigate('#/onboarding');
          else navigate('#/home');
        } catch (err) {
          notify.error('Email o contraseña incorrectos');
        }
      });
    }
  };
}

export function signupPage() {
  return {
    html: renderAuthShell(`
      <h1 class="auth-title">Crear cuenta</h1>
      <p class="auth-desc">Completa el formulario para comenzar</p>
      <form id="signup-form" class="form-stack">
        <div class="field"><label class="label">Email</label><input class="input" name="email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Ingresa tu correo electronico" required></div>
        <div class="field">
          <label class="label">Tipo de usuario</label>
          <select class="select" name="userType" required>
            <option value="">Selecciona una opción</option>
            <option value="salon">Salón de belleza</option>
            <option value="independiente">Profesional independiente</option>
          </select>
        </div>
        <div class="field"><label class="label">Contraseña</label><input class="input" name="password" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false" minlength="8" placeholder="Ingresa tu contraseña" required><div class="helper">Mínimo 8 caracteres</div></div>
        <div class="field"><label class="label">Confirmar contraseña</label><input class="input" name="passwordConfirm" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false" minlength="8" placeholder="Ingresa tu contraseña" required></div>
        <button class="btn primary" type="submit" style="width:100%">Crear cuenta</button>
      </form>
      <p class="helper" style="text-align:center;margin-top:16px">¿Ya tienes cuenta? <a href="#/login" class="auth-link">Inicia sesión</a></p>
    `),
    bind(root) {
      root.querySelector('#signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (fd.get('password') !== fd.get('passwordConfirm')) return notify.error('Las contraseñas no coinciden');
        try {
          await signup(fd.get('email'), fd.get('password'), fd.get('userType'));
          navigate('#/onboarding');
        } catch (err) {
          if (String(err.code || '').includes('email-already-in-use')) notify.error('Este email ya está registrado');
          else notify.error('Error al crear la cuenta');
        }
      });
    }
  };
}

function renderOnboardingService(service = {}, index = 0) {
  return `
  <div class="card">
    <div class="card-body">
      <div class="panel" style="margin-bottom:10px">
        <strong>Servicio ${index + 1}</strong>
        ${index > 0 ? `<button type="button" class="btn sm ghost js-remove-service" data-index="${index}">${'Eliminar'}</button>` : ''}
      </div>
      <div class="form-grid">
        <div><label class="label">Nombre *</label><input class="input" data-field="name" data-index="${index}" value="${escapeHTML(service.name || '')}" placeholder="Ej: Manicure clásico"></div>
        <div><label class="label">Precio *</label><input class="input" data-field="price" data-index="${index}" type="number" min="0" step="0.01" value="${escapeHTML(service.price || '')}" placeholder="0.00"></div>
      </div>
      <div class="form-grid" style="margin-top:14px">
        <div style="grid-column:1/-1"><label class="label">Descripción</label><textarea class="textarea" data-field="description" data-index="${index}" rows="2" placeholder="Descripción del servicio">${escapeHTML(service.description || '')}</textarea></div>
        <div>
          <label class="label">Duración (minutos)</label>
          <input class="input" data-field="duration" data-index="${index}" type="number" min="1" step="1" value="${escapeHTML(service.duration || '30')}" list="duration-options" placeholder="Ej: 90">
          <datalist id="duration-options">
            ${['15','30','45','60','90','120'].map(v => `<option value="${v}">${v} min</option>`).join('')}
          </datalist>
          <div class="helper">Puedes elegir una opción o escribir cualquier tiempo en minutos</div>
        </div>
      </div>
    </div>
  </div>`;
}

function renderOnboardingSchedule(schedule = {}, index = 0) {
  return `
  <div class="card">
    <div class="card-body">
      <div class="panel" style="margin-bottom:10px">
        <strong>Horario ${index + 1}</strong>
        ${index > 0 ? `<button type="button" class="btn sm ghost js-remove-schedule" data-index="${index}">Eliminar</button>` : ''}
      </div>
      <div class="form-grid">
        <div>
          <label class="label">Día de la semana</label>
          <select class="select" data-field="dayOfWeek" data-index="${index}">
            ${weekdays.map(v => `<option value="${v}" ${String(schedule.dayOfWeek||'lunes')===v?'selected':''}>${weekdayLabels[v]}</option>`).join('')}
          </select>
        </div>
        <div></div>
      </div>
      <div class="form-grid" style="margin-top:14px">
        <div><label class="label">Hora inicio</label><input class="input" type="time" data-field="startTime" data-index="${index}" value="${escapeHTML(schedule.startTime || '09:00')}"></div>
        <div><label class="label">Hora fin</label><input class="input" type="time" data-field="endTime" data-index="${index}" value="${escapeHTML(schedule.endTime || '18:00')}"></div>
      </div>
    </div>
  </div>`;
}


export function onboardingPage() {
  const user = getCurrentUser();

  const state = {
    step: 1,
    salonName: user?.salonName || user?.name || '',
    services: [
      { name: '', description: '', price: '', duration: '30' }
    ],
    schedules: [
      { dayOfWeek: 'lunes', startTime: '09:00', endTime: '18:00' }
    ]
  };

  const renderShell = () => `
    <div style="max-width:860px;margin:0 auto">
      <div class="card" style="padding:00px;border-radius:28px">
        <div class="auth-brand">
          <div class="brand-mark" style="width:72px;height:72px;border-radius:24px">N</div>
        </div>

        <h1 class="auth-title" style="margin-top:0">Configuración inicial</h1>
        <p class="auth-desc">Paso ${state.step} de 4</p>
        <div class="progress"><span style="width:${(state.step / 4) * 100}%"></span></div>
        <div class="separator"></div>

        <div id="onboarding-body"></div>

        <div class="toolbar" style="margin-top:18px">
          ${state.step > 1 ? `<button class="btn outline" id="prev-step" type="button">Atrás</button>` : ''}
          <div class="spacer"></div>
          ${
            state.step < 4
              ? `<button class="btn primary" id="next-step" type="button">Siguiente</button>`
              : `<button class="btn primary" id="finish-onboarding" type="button">Completar</button>`
          }
        </div>
      </div>
    </div>`;

  const renderStepBody = (root) => {
    const body = root.querySelector('#onboarding-body');
    if (!body) return;

    if (state.step === 1) {
      body.innerHTML = `
        <div class="form-stack">
          <div>
            <label class="label">Nombre del salón o profesional *</label>
            <input class="input" id="salonName" value="${escapeHTML(state.salonName)}" placeholder="Ej: Salón Bella Nails">
          </div>
        </div>`;
      return;
    }

    if (state.step === 2) {
      body.innerHTML = `
        <div class="form-stack">
          <div id="services-block">
            ${state.services.map((s, i) => renderOnboardingService(s, i)).join('')}
          </div>
          <button class="btn outline" id="add-service" type="button">Agregar servicio</button>
        </div>`;
      return;
    }

    if (state.step === 3) {
      body.innerHTML = `
        <div class="form-stack">
          <div id="schedules-block">
            ${state.schedules.map((s, i) => renderOnboardingSchedule(s, i)).join('')}
          </div>
          <button class="btn outline" id="add-schedule" type="button">Agregar horario</button>
        </div>`;
      return;
    }

    if (state.step === 4) {
      body.innerHTML = `
        <div class="form-stack">
          <div class="card">
            <div class="card-body">
              <strong>Información básica</strong>
              <p class="helper">Nombre: ${escapeHTML(state.salonName || '')}</p>
            </div>
          </div>

          <div class="card">
            <div class="card-body">
              <strong>Servicios (${state.services.filter(s => s.name.trim()).length})</strong>
              <div class="helper">
                ${state.services
                  .filter(s => s.name.trim())
                  .map((s) => `${escapeHTML(s.name)} - ${formatCurrency(s.price)} (${escapeHTML(s.duration)} min)`)
                  .join('<br>')}
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-body">
              <strong>Horarios (${state.schedules.length})</strong>
              <div class="helper">
                ${state.schedules
                  .map((s) => `${weekdayLabels[s.dayOfWeek]}: ${escapeHTML(s.startTime)} - ${escapeHTML(s.endTime)}`)
                  .join('<br>')}
              </div>
            </div>
          </div>
        </div>`;
    }
  };

  const readStepData = (root) => {
    if (state.step === 1) {
      state.salonName = root.querySelector('#salonName')?.value || '';
      return;
    }

    if (state.step === 2) {
      const cards = [...root.querySelectorAll('#services-block .card')];
      state.services = cards.map((card) => ({
        name: card.querySelector('[data-field="name"]')?.value || '',
        description: card.querySelector('[data-field="description"]')?.value || '',
        price: card.querySelector('[data-field="price"]')?.value || '',
        duration: card.querySelector('[data-field="duration"]')?.value || '30',
      }));
      return;
    }

    if (state.step === 3) {
      const cards = [...root.querySelectorAll('#schedules-block .card')];
      state.schedules = cards.map((card) => ({
        dayOfWeek: card.querySelector('[data-field="dayOfWeek"]')?.value || 'lunes',
        startTime: card.querySelector('[data-field="startTime"]')?.value || '09:00',
        endTime: card.querySelector('[data-field="endTime"]')?.value || '18:00',
      }));
    }
  };

  const rerender = (root) => {
    root.innerHTML = renderAuthShell(renderShell());
    renderStepBody(root);
  };

  return {
    html: renderAuthShell(renderShell()),
    bind(root) {
      renderStepBody(root);

      if (root.__onboardingCleanup) {
        root.__onboardingCleanup();
      }

      const handleClick = async (e) => {
        const nextBtn = e.target.closest('#next-step');
        const prevBtn = e.target.closest('#prev-step');
        const finishBtn = e.target.closest('#finish-onboarding');
        const addServiceBtn = e.target.closest('#add-service');
        const addScheduleBtn = e.target.closest('#add-schedule');
        const removeServiceBtn = e.target.closest('.js-remove-service');
        const removeScheduleBtn = e.target.closest('.js-remove-schedule');

        if (nextBtn) {
          readStepData(root);

          if (state.step === 1 && !state.salonName.trim()) {
            notify.error('Ingresa el nombre de tu salón o negocio');
            return;
          }

          if (state.step === 2 && !state.services.some((s) => s.name.trim() && String(s.price).trim())) {
            notify.error('Agrega al menos un servicio');
            return;
          }

          if (state.step === 3 && !state.schedules.length) {
            notify.error('Agrega al menos un horario');
            return;
          }

          state.step += 1;
          rerender(root);
          return;
        }

        if (prevBtn) {
          readStepData(root);
          state.step = Math.max(1, state.step - 1);
          rerender(root);
          return;
        }

        if (finishBtn) {
          readStepData(root);

          try {
            await updateUserProfile({
              name: state.salonName,
              salonName: state.salonName,
              onboardingCompleted: true
            });

            const current = getCurrentUser();

            for (const s of state.services.filter((x) => x.name.trim() && String(x.price).trim())) {
              await create('services', {
                userId: current.id,
                name: s.name,
                description: s.description,
                price: Number(s.price),
                duration: s.duration
              });
            }

            for (const s of state.schedules) {
              await create('schedules', {
                userId: current.id,
                dayOfWeek: s.dayOfWeek,
                startTime: s.startTime,
                endTime: s.endTime
              });
            }

            notify.success('Configuración completada con éxito');
            navigate('#/home');
          } catch (err) {
            console.error(err);
            notify.error('Error al guardar la configuración');
          }
          return;
        }

        if (addServiceBtn) {
          readStepData(root);
          state.services.push({ name: '', description: '', price: '', duration: '30' });
          rerender(root);
          return;
        }

        if (addScheduleBtn) {
          state.schedules.push({ dayOfWeek: 'lunes', startTime: '09:00', endTime: '18:00' });
          rerender(root);
          return;
        }

        if (removeServiceBtn) {
          const idx = Number(removeServiceBtn.dataset.index);
          state.services.splice(idx, 1);
          if (!state.services.length) {
            state.services.push({ name: '', description: '', price: '', duration: '30' });
          }
          rerender(root);
          return;
        }

        if (removeScheduleBtn) {
          const idx = Number(removeScheduleBtn.dataset.index);
          state.schedules.splice(idx, 1);
          if (!state.schedules.length) {
            state.schedules.push({ dayOfWeek: 'lunes', startTime: '09:00', endTime: '18:00' });
          }
          rerender(root);
          return;
        }
      };

      root.addEventListener('click', handleClick);
      
      const handleInput = (e) => {
        const input = e.target.closest('[data-field][data-index]');
        if (!input) return;
        const idx = Number(input.dataset.index);
        const field = input.dataset.field;
        const value = input.value;
        
        if (state.step === 2 && state.services[idx]) {
          state.services[idx][field] = value;
        } else if (state.step === 3 && state.schedules[idx]) {
          state.schedules[idx][field] = value;
        }
      };
      
      root.addEventListener('input', handleInput);
      root.addEventListener('change', handleInput);
      
      root.__onboardingCleanup = () => {
        root.removeEventListener('click', handleClick);
        root.removeEventListener('input', handleInput);
        root.removeEventListener('change', handleInput);
      };
    }
  };
}



async function loadDashboardStats(userId) {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);
  const [appointments, clients, services] = await Promise.all([
    list('appointments', { userId }),
    list('clients', { userId }),
    list('services', { userId }),
  ]);
  return {
    appointments,
    todayAppointments: appointments.filter(a => a.appointmentDate >= toDateInputValue(today) && a.appointmentDate < toDateInputValue(tomorrow)),
    upcomingAppointments: appointments.filter(a => a.appointmentDate >= toDateInputValue(tomorrow) && a.appointmentDate <= toDateInputValue(weekEnd)).sort((a,b) => (a.appointmentDate+a.startTime).localeCompare(b.appointmentDate+b.startTime)),
    totalClients: clients.length,
    totalServices: services.length,
    todayCount: appointments.filter(a => a.appointmentDate === toDateInputValue(today)).length,
  };
}

export function homePage() {
  const user = getCurrentUser();
  const state = { loading: true, data: null };
  return {
    html: shellWithHeader('Inicio', 'Resumen del día', '', `
      <div id="home-content">
        <div class="grid cols-3">
          <div class="card"><div class="card-header stat"><div><div class="card-title">Citas hoy</div><div class="value">—</div></div></div></div>
          <div class="card"><div class="card-header stat"><div><div class="card-title">Total clientes</div><div class="value">—</div></div></div></div>
          <div class="card"><div class="card-header stat"><div><div class="card-title">Servicios activos</div><div class="value">—</div></div></div></div>
        </div>
      </div>
    `),
    async bind(root) {
      let destroyed = false;
      let refreshTimer = null;
      const scheduleRefresh = () => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          if (!destroyed) loadAndRender();
        }, 50);
      };

      const unsubscribers = [
        await subscribe('appointments', { userId: user.id }, scheduleRefresh),
        await subscribe('clients', { userId: user.id }, scheduleRefresh),
        await subscribe('services', { userId: user.id }, scheduleRefresh),
      ].filter((fn) => typeof fn === 'function');

      async function loadAndRender() {
        const data = await loadDashboardStats(user.id);
        if (destroyed) return;
        const content = root.querySelector('#home-content');
        if (!content) return;
        content.innerHTML = `
        <div class="grid cols-3" style="margin-bottom:18px">
          <div class="card"><div class="card-header stat"><div><div class="card-title">Citas hoy</div><div class="value">${data.todayCount}</div></div>${icon('clock', 'nav-icon')}</div></div>
          <div class="card"><div class="card-header stat"><div><div class="card-title">Total clientes</div><div class="value">${data.totalClients}</div></div>${icon('users', 'nav-icon')}</div></div>
          <div class="card"><div class="card-header stat"><div><div class="card-title">Servicios activos</div><div class="value">${data.totalServices}</div></div>${icon('briefcase', 'nav-icon')}</div></div>
        </div>
        <div class="grid cols-2" style="margin-bottom:18px">
          <div class="card">
            <div class="card-header"><div class="card-title">Citas de hoy</div><div class="card-desc">${data.todayAppointments.length} citas programadas</div></div>
            <div class="card-body">
              ${data.todayAppointments.length ? data.todayAppointments.map((apt) => `
                <div class="list-item">
                  <div>
                    <div style="font-weight:700">${escapeHTML(apt.startTime)} - ${escapeHTML(apt.endTime)}</div>
                    <div class="helper">Cliente ID: ${escapeHTML(String(apt.clientId || '').slice(0, 8))}</div>
                  </div>
                  ${statusBadge(appointmentDisplayStatus(apt))}
                </div>
              `).join('') : emptyState('No hay citas para hoy', 'Puedes crear una nueva cita desde la agenda.', 'calendar')}
            </div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">Próximas citas</div><div class="card-desc">Siguientes 7 días</div></div>
            <div class="card-body">
              ${data.upcomingAppointments.length ? data.upcomingAppointments.slice(0,5).map((apt) => `
                <div class="list-item">
                  <div>
                    <div style="font-weight:700">${formatDate(apt.appointmentDate, { month: 'short', day: 'numeric' })}</div>
                    <div class="helper">${escapeHTML(apt.startTime)} - ${escapeHTML(apt.endTime)}</div>
                  </div>
                  ${statusBadge(appointmentDisplayStatus(apt))}
                </div>
              `).join('') : emptyState('Sin citas próximas', 'Agenda más citas para verlas aquí.', 'calendar')}
            </div>
          </div>
        </div>
        <div class="grid cols-4">
          ${[
            ['Agenda','calendar','#/calendar'],
            ['Clientes','users','#/clients'],
            ['Servicios','briefcase','#/services'],
            ['Perfil','settings','#/profile'],
          ].map(([label, ic, href]) => `<a class="card" href="${href}" style="padding:18px;text-align:center"><div class="avatar" style="margin:0 auto 10px;width:52px;height:52px;border-radius:18px">${icon(ic)}</div><strong>${label}</strong></a>`).join('')}
        </div>
      `;
      }

      await loadAndRender();
      return () => {
        destroyed = true;
        clearTimeout(refreshTimer);
        unsubscribers.forEach((fn) => fn?.());
      };
    }
  };
}

function appointmentCard(apt, clientsMap, servicesMap, onEdit, onDelete, onView) {
  const client = clientsMap[apt.clientId]?.name || apt.clientName || 'Cliente';
  const service = servicesMap[apt.serviceId]?.name || apt.serviceName || String(apt.serviceId || 'Servicio');
  const finalized = appointmentDisplayStatus(apt) === 'finalizada';
  return `
    <div class="list-item ${finalized ? 'finalized-row' : ''}">
      <div style="min-width:0">
        <div style="font-weight:800">${escapeHTML(apt.startTime)} - ${escapeHTML(apt.endTime)} <span style="opacity:.7">·</span> ${escapeHTML(formatLocalDate(apt.appointmentDate, { month:'short', day:'numeric' }))}</div>
        <div class="helper clamp-2">${escapeHTML(client)} · ${escapeHTML(service)}</div>
        ${apt.promotionName ? `<div class="helper" style="margin-top:4px">Promoción: ${escapeHTML(apt.promotionName)}${apt.promotionDiscountValue ? ` · ${escapeHTML(apt.promotionDiscountType === 'percentage' ? `${apt.promotionDiscountValue}%` : formatCurrency(apt.promotionDiscountValue))}` : ''}</div>` : ''}
        <div style="margin-top:8px">${statusBadge(appointmentDisplayStatus(apt))} ${apt.reminderStatus ? `<span style="margin-left:8px">${reminderStatusBadge(apt.reminderStatus)}</span>` : ''}</div>
      </div>
      <div class="toolbar">
        <button class="btn sm outline js-view" data-id="${apt.id}">Ver</button>
        <button class="btn sm outline js-edit" data-id="${apt.id}">Editar</button>
        ${appointmentDisplayStatus(apt) !== 'finalizada' && apt.status !== 'cancelada' ? `<button class="btn sm danger js-cancel" data-id="${apt.id}">Cancelar</button>` : ''}
        <button class="btn sm danger js-delete" data-id="${apt.id}">Eliminar</button>
      </div>
    </div>`;
}

function dayDetailModalHTML({ day, appointments = [], clients = [], services = [] }) {
  const dayLabel = formatLocalDate(day, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const hasUpcoming = day >= getToday();
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));
  const serviceMap = Object.fromEntries(services.map((s) => [s.id, s]));
  const items = appointments.length ? appointments.map((apt) => {
    const client = clientMap[apt.clientId]?.name || apt.clientName || 'Cliente';
    const service = serviceMap[apt.serviceId]?.name || apt.serviceName || 'Servicio';
    return `
      <div class="list-item ${appointmentDisplayStatus(apt) === 'finalizada' ? 'finalized-row' : ''}" style="align-items:flex-start">
        <div style="min-width:0">
          <div style="font-weight:800">${escapeHTML(apt.startTime)} - ${escapeHTML(apt.endTime)}</div>
          <div class="helper clamp-2">${escapeHTML(client)} · ${escapeHTML(service)}</div>
          ${apt.promotionName ? `<div class="helper" style="margin-top:4px">Promoción: ${escapeHTML(apt.promotionName)}${apt.promotionDiscountValue ? ` · ${escapeHTML(apt.promotionDiscountType === 'percentage' ? `${apt.promotionDiscountValue}%` : formatCurrency(apt.promotionDiscountValue))}` : ''}</div>` : ''}
          <div style="margin-top:8px">${statusBadge(appointmentDisplayStatus(apt))}</div>
        </div>
        <div class="toolbar" style="flex-wrap:wrap;justify-content:flex-end">
          <button class="btn sm outline js-view-apt" data-id="${apt.id}">Ver</button>
          <button class="btn sm outline js-edit-apt" data-id="${apt.id}">Editar</button>
          ${appointmentDisplayStatus(apt) !== 'finalizada' && apt.status !== 'cancelada' ? `<button class="btn sm danger js-cancel-apt" data-id="${apt.id}">Cancelar</button>` : ''}
          <button class="btn sm danger js-delete-apt" data-id="${apt.id}">Eliminar</button>
        </div>
      </div>`;
  }).join('') : emptyState('Sin citas', 'No hay agendas registradas para este día.', 'calendar');
  return `
    <div class="modal-backdrop open" data-modal="day-detail">
      <div class="modal" style="max-width:760px">
        <div class="modal-head">
          <div>
            <h2 class="card-title">${escapeHTML(dayLabel)}</h2>
            <p class="card-desc">${appointments.length} agenda${appointments.length === 1 ? '' : 's'} programada${appointments.length === 1 ? '' : 's'}</p>
          </div>
          <button class="btn icon ghost js-close-day">×</button>
        </div>
        <div class="modal-body">
          <div class="toolbar" style="margin-bottom:14px;justify-content:space-between">
            <div class="helper">Arrastra una agenda sobre otro día para reprogramarla.</div>
            ${hasUpcoming ? `<button class="btn primary js-new-day-apt" data-day="${escapeHTML(day)}">Nueva cita</button>` : ''}
          </div>
          <div class="form-stack" style="gap:10px">${items}</div>
        </div>
        <div class="modal-foot">
          <button class="btn outline js-close-day" type="button">Cerrar</button>
        </div>
      </div>
    </div>`;
}
export function calendarPage() {
  const state = { date: new Date(), appointments: [], clients: [], services: [], selectedId: null, modal: null, draggingId: null };

  const renderCalendar = () => {
    const days = monthDays(state.date);
    return days.map((day) => {
      const dayKey = toDateInputValue(day);
      const dayApps = state.appointments.filter((a) => a.appointmentDate === dayKey).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
      const isToday = sameDay(day, new Date());
      const isPast = dayKey < getToday() && !isToday;
      return `
        <div class="card calendar-day" data-day="${dayKey}" style="min-height:120px;padding:12px;cursor:pointer;opacity:${isPast ? '.75' : '1'};${isToday ? 'outline:2px solid var(--primary-strong)' : ''}">
          <div style="font-size:.95rem;font-weight:800;margin-bottom:8px;${isToday ? 'color:var(--primary-strong)' : ''}${isPast ? 'opacity:.75' : ''}">${day.getDate()}</div>
          <div class="list" style="gap:6px">
            ${dayApps.slice(0, 3).map((a) => appointmentChip(a)).join('')}
            ${dayApps.length > 3 ? `<div class="helper">+${dayApps.length - 3} más</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  };

  return {
    html: shellWithHeader('Agenda', 'Gestiona tus citas', `<button class="btn primary" id="new-appointment-btn">${'Nueva cita'}</button>`, `
      <div class="card">
        <div class="card-body">
          <div class="panel" style="margin-bottom:16px">
            <button class="btn outline sm" id="prev-month">${'◀'}</button>
            <div style="font-size:1.1rem;font-weight:800" id="month-title"></div>
            <button class="btn outline sm" id="next-month">${'▶'}</button>
          </div>
          <div class="grid" style="grid-template-columns:repeat(7,minmax(0,1fr));gap:10px;margin-bottom:10px">
            ${['Lun','Mar','Mie','Jue','Vie','Sab','Dom'].map((d) => `<div class="helper" style="text-align:center;font-weight:700">${d}</div>`).join('')}
          </div>
          <div id="calendar-grid" class="grid" style="grid-template-columns:repeat(7,minmax(0,1fr));gap:10px"></div>
        </div>
      </div>
      <div id="appointment-modal-slot"></div>
      <div id="day-modal-slot"></div>
    `),
    async bind(root) {
      const user = getCurrentUser();
      let destroyed = false;
      let refreshTimer = null;
      const scheduleLoad = () => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          if (!destroyed) load();
        }, 50);
      };

      const unsubscribers = [
        await subscribe('appointments', { userId: user.id }, scheduleLoad),
        await subscribe('clients', { userId: user.id }, scheduleLoad),
        await subscribe('services', { userId: user.id }, scheduleLoad),
      ].filter((fn) => typeof fn === 'function');

      async function load() {
        const [apps, clients, services] = await Promise.all([
          list('appointments', { userId: user.id }),
          list('clients', { userId: user.id }),
          list('services', { userId: user.id }),
        ]);
        const syncedApps = await syncAppointmentStatuses(
          apps.sort((a, b) => `${a.appointmentDate}${a.startTime}`.localeCompare(`${b.appointmentDate}${b.startTime}`)),
          { persist: true },
        );
        state.appointments = syncedApps;
        state.clients = clients;
        state.services = services;
        renderGrid();
      }

      function renderGrid() {
        root.querySelector('#month-title').textContent = toMonthTitle(state.date);
        root.querySelector('#calendar-grid').innerHTML = `${Array.from({ length: ((new Date(state.date.getFullYear(), state.date.getMonth(), 1).getDay() + 6) % 7) }).map(() => '<div></div>').join('')}${renderCalendar()}`;
      }

      async function openDay(day) {
        const dayAppointments = state.appointments.filter((a) => a.appointmentDate === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
        const slot = root.querySelector('#day-modal-slot');
        slot.innerHTML = dayDetailModalHTML({ day, appointments: dayAppointments, clients: state.clients, services: state.services });
        const backdrop = slot.querySelector('.modal-backdrop');
        promoteModalToFront(backdrop);
        const close = () => { backdrop?.remove(); slot.innerHTML = ''; };
        const openAppointmentAfterClose = (appointment, selectedDate = null) => {
          close();
          const appointmentSlot = root.querySelector('#appointment-modal-slot');
          if (appointmentSlot) appointmentSlot.innerHTML = '';
          requestAnimationFrame(() => openAppointmentModal(appointment, selectedDate, state, load, root));
        };
        slot.querySelectorAll('.js-close-day').forEach((btn) => btn.addEventListener('click', close));

        slot.querySelectorAll('.js-view-apt').forEach((btn) => btn.addEventListener('click', () => {
          openAppointmentAfterClose(state.appointments.find((a) => a.id === btn.dataset.id), null);
        }));
        slot.querySelectorAll('.js-edit-apt').forEach((btn) => btn.addEventListener('click', () => {
          openAppointmentAfterClose(state.appointments.find((a) => a.id === btn.dataset.id), null);
        }));
        slot.querySelectorAll('.js-cancel-apt').forEach((btn) => btn.addEventListener('click', async () => {
          const apt = state.appointments.find((a) => a.id === btn.dataset.id);
          if (!apt) return;
          if (!await confirmDialog('¿Cancelar esta agenda?', { title: 'Cancelar agenda', confirmText: 'Sí, cancelar' })) return;
          await update('appointments', apt.id, { status: 'cancelada' });
          notify.success('Agenda cancelada');
          close();
          await load();
        }));
        slot.querySelectorAll('.js-delete-apt').forEach((btn) => btn.addEventListener('click', async () => {
          const apt = state.appointments.find((a) => a.id === btn.dataset.id);
          if (!apt) return;
          if (!await confirmDialog('¿Eliminar esta cita de forma definitiva?', { title: 'Eliminar cita', confirmText: 'Sí, eliminar' })) return;
          await remove('appointments', apt.id);
          notify.success('Cita eliminada');
          close();
          await load();
        }));
        slot.querySelector('.js-new-day-apt')?.addEventListener('click', () => {
          openAppointmentAfterClose(null, day);
        });
      }

      async function moveAppointment(appointmentId, day) {
        const apt = state.appointments.find((a) => a.id === appointmentId);
        if (!apt) return;
        if (appointmentDisplayStatus(apt) === 'finalizada') return notify.error('No puedes reprogramar una agenda finalizada');
        if (apt.status === 'cancelada') return notify.error('No puedes reprogramar una agenda cancelada');
        const movingToToday = day === getToday();
        if (day < getToday()) return notify.error('No puedes mover una agenda a un día pasado');
        if (movingToToday && isPastDateTime(day, apt.startTime)) return notify.error('No puedes moverla a una hora pasada');

        const conflict = state.appointments.find((other) => {
          if (!other || other.id === apt.id) return false;
          if (appointmentDisplayStatus(other) === 'cancelada') return false;
          return isAppointmentTimeConflict({ ...apt, appointmentDate: day }, other);
        });
        if (conflict) return notify.error('Ya existe otra cita en ese mismo horario');

        await update('appointments', apt.id, { appointmentDate: day });
        notify.success('Agenda reprogramada');
        await load();
      }

      root.querySelector('#prev-month').onclick = () => { state.date = addMonths(state.date, -1); load(); };
      root.querySelector('#next-month').onclick = () => { state.date = addMonths(state.date, 1); load(); };
      root.querySelector('#new-appointment-btn').onclick = () => openAppointmentModal(null, null, state, load, root);

      root.addEventListener('click', (e) => {
        const aptEl = e.target.closest('[data-apt]');
        if (aptEl && !e.target.closest('.js-view-apt, .js-edit-apt, .js-cancel-apt')) {
          const id = aptEl.dataset.apt;
          const apt = state.appointments.find((a) => a.id === id);
          if (apt) openAppointmentModal(apt, null, state, load, root);
        }
        const dayEl = e.target.closest('[data-day]');
        if (dayEl && !e.target.closest('[data-apt]')) {
          openDay(dayEl.dataset.day);
        }
      });

      root.addEventListener('dragstart', (e) => {
        const chip = e.target.closest('.appointment-chip');
        if (!chip) return;
        state.draggingId = chip.dataset.apt;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', chip.dataset.apt);
        chip.classList.add('dragging');
      });
      root.addEventListener('dragend', (e) => {
        const chip = e.target.closest('.appointment-chip');
        chip?.classList.remove('dragging');
        state.draggingId = null;
      });
      root.addEventListener('dragover', (e) => {
        const dayEl = e.target.closest('[data-day]');
        if (!dayEl) return;
        e.preventDefault();
        dayEl.classList.add('drop-target');
      });
      root.addEventListener('dragleave', (e) => {
        const dayEl = e.target.closest('[data-day]');
        dayEl?.classList.remove('drop-target');
      });
      root.addEventListener('drop', async (e) => {
        const dayEl = e.target.closest('[data-day]');
        if (!dayEl) return;
        e.preventDefault();
        dayEl.classList.remove('drop-target');
        const id = e.dataTransfer.getData('text/plain') || state.draggingId;
        if (id) await moveAppointment(id, dayEl.dataset.day);
      });

      await load();
      return () => {
        destroyed = true;
        clearTimeout(refreshTimer);
        unsubscribers.forEach((fn) => fn?.());
      };
    }
  };
}

function appointmentModalHTML({ appointment = null, selectedDate = null, clients = [], services = [], promotions = [] }) {
  const today = getToday();
  const initialDate = appointment?.appointmentDate || selectedDate || today;
  const minDate = appointment?.id && appointment.appointmentDate < today ? appointment.appointmentDate : today;
  const canCancel = !!appointment?.id && appointment.status !== 'cancelada' && !isAppointmentFinalized(appointment);
  const displayStatus = appointmentDisplayStatus(appointment);
  const initialPromotion = appointment?.promotionId
    ? promotions.find((promo) => promo.id === appointment.promotionId)
    : getApplicablePromotion(promotions, appointment?.serviceId || '', initialDate);
  
  return `
  <div class="modal-backdrop open" data-modal="appointment">
    <div class="modal">
      <div class="modal-head">
        <div>
          <h2 class="card-title">${appointment ? 'Editar cita' : 'Nueva cita'}</h2>
          <p class="card-desc">${appointment ? `Estado actual: ${escapeHTML(appointmentStatuses[displayStatus]?.label || displayStatus)}` : 'Completa la información de la cita'}</p>
        </div>
        <button class="btn icon ghost js-close-modal">×</button>
      </div>
      <div class="modal-body">
        <form id="appointment-form" class="form-stack">
          <input type="hidden" name="id" value="${escapeHTML(appointment?.id || '')}">
          <input type="hidden" name="promotionId" value="${escapeHTML(initialPromotion?.id || '')}">
          <div class="form-grid">
            <div>
              <label class="label">Cliente</label>
              <select class="select" name="clientId" required>
                <option value="">Selecciona un cliente</option>
                ${clients.map((c) => `<option value="${c.id}" ${appointment?.clientId===c.id?'selected':''}>${escapeHTML(c.name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="label">Servicio</label>
              <select class="select" name="serviceId" required>
                <option value="">Selecciona un servicio</option>
                ${services.map((s) => `<option value="${s.id}" data-duration="${s.duration || '30'}" ${appointment?.serviceId===s.id?'selected':''}>${escapeHTML(s.name)}</option>`).join('')}
              </select>
              <div class="helper" id="promotion-discount">${initialPromotion ? `Promoción aplicada: ${escapeHTML(promotionSummary(initialPromotion))}` : 'Sin promoción aplicable para este servicio.'}</div>
            </div>
            <div>
              <label class="label">Fecha</label>
              <input class="input js-appointment-date" type="date" name="appointmentDate" value="${escapeHTML(initialDate)}" min="${escapeHTML(minDate)}" required>
            </div>
            <div><label class="label">Estado</label>
              <select class="select" name="status">
                ${['pendiente','confirmada','en_proceso','finalizada','cancelada'].map((s) => `<option value="${s}" ${appointment?.status===s||(!appointment&&s==='pendiente')?'selected':''}>${appointmentStatuses[s].label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="label">Hora inicio</label>
              <input class="input js-start-time" type="time" name="startTime" value="${escapeHTML(appointment?.startTime || '09:00')}" step="900" required>
            </div>
            <div>
              <label class="label">Hora fin</label>
              <input class="input js-end-time" type="time" name="endTime" value="${escapeHTML(appointment?.endTime || '10:00')}" step="900" required>
            </div>
            <div style="grid-column:1/-1"><label class="label">Notas</label><textarea class="textarea" name="notes" rows="3">${escapeHTML(appointment?.notes || '')}</textarea></div>
          </div>
        </form>
      </div>
      <div class="modal-foot">
        ${appointment?.id ? `<button class="btn danger js-delete-appointment" type="button">Eliminar cita</button>` : ''}
        ${canCancel ? `<button class="btn danger js-cancel-appointment" type="button">Cancelar agenda</button>` : ''}
        <button class="btn outline js-close-modal" type="button">Cerrar</button>
        <button class="btn primary" form="appointment-form" type="submit">Guardar</button>
      </div>
    </div>
  </div>`;
}

async function openAppointmentModal(appointment, selectedDate, state, refresh, root) {
  const slot = root.querySelector('#appointment-modal-slot');
  const user = getCurrentUser();
  const [clients, services, promotions] = await Promise.all([
    list('clients', { userId: user.id }),
    list('services', { userId: user.id }),
    list('promotions', { userId: user.id }),
  ]);
  slot.innerHTML = appointmentModalHTML({ appointment, selectedDate, clients, services, promotions });
  const backdrop = slot.querySelector('.modal-backdrop');
  promoteModalToFront(backdrop);
  const form = slot.querySelector('#appointment-form');
  const dateInput = slot.querySelector('.js-appointment-date');
  const startInput = slot.querySelector('.js-start-time');
  const endInput = slot.querySelector('.js-end-time');
  const promotionDiscount = slot.querySelector('#promotion-discount');
  const promotionIdInput = slot.querySelector('input[name="promotionId"]');
  const close = () => { backdrop?.remove(); };

  const syncConstraints = () => {
    const today = getToday();
    const isEditingPastAppointment = !!appointment?.id && appointment.appointmentDate < today;

    if (dateInput) {
      dateInput.min = isEditingPastAppointment ? appointment.appointmentDate : today;
    }
    if (startInput) {
      // No establecemos min para permitir seleccionar cualquier hora
      startInput.min = '';
    }
    if (endInput) {
      // La hora fin mínima debe ser la hora de inicio (si hay una seleccionada)
      endInput.min = startInput?.value || '';
    }
  };

  slot.querySelectorAll('.js-close-modal').forEach((btn) => btn.addEventListener('click', close));
  slot.querySelector('.js-delete-appointment')?.addEventListener('click', async () => {
    if (!appointment?.id) return;
    if (!await confirmDialog('¿Eliminar esta cita de forma definitiva?', { title: 'Eliminar cita', confirmText: 'Sí, eliminar' })) return;
    try {
      await remove('appointments', appointment.id);
      notify.success('Cita eliminada');
      close();
      await refresh();
    } catch {
      notify.error('No se pudo eliminar la cita');
    }
  });
  slot.querySelector('.js-cancel-appointment')?.addEventListener('click', async () => {
    if (!appointment?.id) return;
    if (!await confirmDialog('¿Cancelar esta agenda?', { title: 'Cancelar agenda', confirmText: 'Sí, cancelar' })) return;
    try {
      const updatedAppointment = await update('appointments', appointment.id, { status: 'cancelada' });
      notify.success('Agenda cancelada');
      await sendAppointmentCancellationEmail({
        ...appointment,
        ...updatedAppointment,
        status: 'cancelada',
      });
      close();
      await refresh();
    } catch {
      notify.error('No se pudo cancelar la agenda');
    }
  });
  const serviceSelect = slot.querySelector('select[name="serviceId"]');
  const updateAppliedPromotion = () => {
    const promotion = getApplicablePromotion(promotions, serviceSelect?.value || '', dateInput?.value || getToday());
    if (promotionIdInput) promotionIdInput.value = promotion?.id || '';
    if (promotionDiscount) {
      promotionDiscount.textContent = promotion
        ? `Promoción aplicada: ${promotionSummary(promotion)}`
        : 'Sin promoción aplicable para este servicio.';
    }
    return promotion;
  };

  dateInput?.addEventListener('change', () => {
    syncConstraints();
    updateAppliedPromotion();
  });
  startInput?.addEventListener('change', syncConstraints);
  syncConstraints();

  let selectedServiceDuration = 60; // duración por defecto en minutos

  const updateEndTime = () => {
    const startTime = startInput?.value;
    if (!startTime || !selectedServiceDuration) return;
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + selectedServiceDuration;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    const endTimeStr = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    if (endInput) endInput.value = endTimeStr;
  };

  serviceSelect?.addEventListener('change', () => {
    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
    selectedServiceDuration = parseInt(selectedOption?.dataset.duration || '60', 10);
    updateEndTime();
    updateAppliedPromotion();
  });

  startInput?.addEventListener('change', updateEndTime);

  // inicializar duración del servicio seleccionado
  if (serviceSelect?.value) {
    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
    selectedServiceDuration = parseInt(selectedOption?.dataset.duration || '60', 10);
  }

  updateAppliedPromotion();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const appointmentDate = String(fd.get('appointmentDate') || '');
    const startTime = String(fd.get('startTime') || '');
    const endTime = String(fd.get('endTime') || '');
    const originalDateTime = appointment ? `${appointment.appointmentDate}T${appointment.startTime}` : null;
    const selectedDateTime = `${appointmentDate}T${startTime}`;
    const isUnchangedExistingDateTime = appointment && originalDateTime === selectedDateTime;

    if (!appointmentDate || !startTime || !endTime) {
      notify.error('Completa la fecha y las horas');
      return;
    }
    if (!appointment && appointmentDate < getToday()) {
      notify.error('No puedes agendar en días pasados');
      return;
    }
    if (appointmentDate === getToday() && isPastDateTime(appointmentDate, startTime) && !isUnchangedExistingDateTime) {
      notify.error('No puedes agendar una hora pasada');
      return;
    }
    if (appointmentDate < getToday() && !isUnchangedExistingDateTime) {
      notify.error('No puedes agendar en días pasados');
      return;
    }
    if (endTime <= startTime) {
      notify.error('La hora de fin debe ser mayor que la de inicio');
      return;
    }

    const conflict = String(fd.get('status') || '') === 'cancelada'
      ? null
      : state.appointments.find((apt) => {
          if (!apt || apt.id === appointment?.id) return false;
          if (appointmentDisplayStatus(apt) === 'cancelada') return false;
          return isAppointmentTimeConflict({ appointmentDate, startTime, endTime }, apt);
        });
    if (conflict) {
      notify.error('Ya existe otra cita en ese mismo horario');
      return;
    }

    const nextStatus = String(fd.get('status') || 'pendiente');
    const promotion = getApplicablePromotion(promotions, fd.get('serviceId'), appointmentDate);
    const promotionId = promotion?.id || '';
    
    const data = {
      userId: user.id,
      clientId: fd.get('clientId'),
      serviceId: fd.get('serviceId'),
      appointmentDate,
      startTime,
      endTime,
      status: nextStatus,
      notes: fd.get('notes'),
      clientName: clients.find(c => c.id === fd.get('clientId'))?.name || '',
      serviceName: services.find(s => s.id === fd.get('serviceId'))?.name || '',
      promotionId,
      promotionName: promotion?.name || '',
      promotionDiscountType: promotion?.discountType || '',
      promotionDiscountValue: promotion?.discountValue || '',
    };
    try {
      const savedAppointment = fd.get('id')
        ? await update('appointments', fd.get('id'), data)
        : await create('appointments', data);

      notify.success(fd.get('id') ? 'Cita actualizada' : 'Cita creada');

      const finalAppointment = {
        ...appointment,
        ...data,
        ...savedAppointment,
        id: savedAppointment?.id || fd.get('id') || appointment?.id,
      };

      const shouldSendCancellation = appointment?.status !== 'cancelada' && nextStatus === 'cancelada';
      const shouldSendConfirmation = !fd.get('id') || (appointment?.status !== 'confirmada' && nextStatus === 'confirmada');

      if (shouldSendCancellation) {
        await sendAppointmentCancellationEmail(finalAppointment);
      } else if (shouldSendConfirmation && nextStatus !== 'cancelada') {
        await sendAppointmentConfirmationEmail(finalAppointment);
      }

      close();
      await refresh();
    } catch (err) {
      notify.error('Error al guardar la cita');
    }
  });
}

export function clientsPage() {
  const state = { clients: [], search: '', selected: null };
  return {
    html: shellWithHeader('Clientes', 'Gestiona tus clientes', `<button class="btn primary" id="new-client-btn">Nuevo cliente</button>`, `
      <div class="card"><div class="card-body">
        <div class="toolbar" style="margin-bottom:16px">
          <div style="flex:1;min-width:240px"><input class="input" id="clients-search" placeholder="Buscar cliente, teléfono o email"></div>
        </div>
        <div id="clients-list"></div>
      </div></div>
      <div id="client-modal-slot"></div>
    `),
    async bind(root) {
      const user = getCurrentUser();
      async function refresh() {
        state.clients = await list('clients', { userId: user.id });
        render();
      }
      function render() {
        const filtered = state.clients.filter((c) => compareText(c.name, state.search) || compareText(c.phone, state.search) || compareText(c.email, state.search));
        root.querySelector('#clients-list').innerHTML = filtered.length ? `
          <div class="grid cols-2">${filtered.map((c) => `
            <div class="card" style="padding:18px;cursor:pointer">
              <div class="panel">
                <div>
                  <div style="font-size:1.1rem;font-weight:800">${escapeHTML(c.name)}</div>
                  <div class="helper">${escapeHTML(c.phone || '')} ${c.email ? `· ${escapeHTML(c.email)}` : ''}</div>
                </div>
                <button class="btn sm outline js-open-client" data-id="${c.id}">Ver</button>
                <button class="btn sm danger js-delete-client" data-id="${c.id}">Eliminar</button>
              </div>
            </div>
          `).join('')}</div>` : emptyState(state.search ? 'No se encontraron clientes' : 'No hay clientes', state.search ? 'Intenta con otro término de búsqueda.' : 'Comienza agregando tu primer cliente.', 'users','');
      }
      root.querySelector('#clients-search').addEventListener('input', (e) => { state.search = e.target.value; render(); });
      root.querySelector('#new-client-btn').onclick = () => openClientModal(null, root, refresh);
      root.addEventListener('click', async (e) => {
        const btn = e.target.closest('.js-open-client');
        if (btn) return navigate(`#/clients/${btn.dataset.id}`);
        const del = e.target.closest('.js-delete-client');
        if (del) {
          if (!await confirmDialog('¿Eliminar este cliente de forma definitiva?', { title: 'Eliminar cliente', confirmText: 'Sí, eliminar' })) return;
          try {
            await remove('clients', del.dataset.id);
            notify.success('Cliente eliminado');
            await refresh();
          } catch {
            notify.error('No se pudo eliminar el cliente');
          }
        }
      });
      root.querySelector('#empty-new-client')?.addEventListener('click', () => openClientModal(null, root, refresh));
      await refresh();
    }
  };
}

function clientModalHTML(client = null) {
  return `
  <div class="modal-backdrop open">
    <div class="modal">
      <div class="modal-head"><div><h2 class="card-title">${client ? 'Editar cliente' : 'Nuevo cliente'}</h2><p class="card-desc">Información del cliente</p></div><button class="btn icon ghost js-close">×</button></div>
      <div class="modal-body">
        <form id="client-form" class="form-stack">
          <input type="hidden" name="id" value="${escapeHTML(client?.id || '')}">
          <div class="form-grid">
            <div><label class="label">Nombre *</label><input class="input" name="name" value="${escapeHTML(client?.name || '')}" required></div>
            <div><label class="label">Teléfono</label><input class="input" name="phone" value="${escapeHTML(client?.phone || '')}"></div>
            <div><label class="label">Email</label><input class="input" name="email" type="email" value="${escapeHTML(client?.email || '')}"></div>
            <div style="grid-column:1/-1"><label class="label">Notas</label><textarea class="textarea" name="notes" rows="4">${escapeHTML(client?.notes || '')}</textarea></div>
          </div>
        </form>
      </div>
      <div class="modal-foot">${client?.id ? '<button class="btn danger js-delete-client-modal" type="button">Eliminar cliente</button>' : ''}<button class="btn outline js-close">Cancelar</button><button class="btn primary" form="client-form" type="submit">Guardar</button></div>
    </div>
  </div>`;
}

async function openClientModal(client, root, refresh) {
  const slot = root.querySelector('#client-modal-slot');
  slot.innerHTML = clientModalHTML(client);
  const backdrop = slot.querySelector('.modal-backdrop');
  promoteModalToFront(backdrop);
  const close = () => slot.innerHTML = '';
  slot.querySelectorAll('.js-close').forEach((b) => b.addEventListener('click', close));
  slot.querySelector('.js-delete-client-modal')?.addEventListener('click', async () => {
    if (!client?.id) return;
    if (!await confirmDialog('¿Eliminar este cliente de forma definitiva?', { title: 'Eliminar cliente', confirmText: 'Sí, eliminar' })) return;
    try {
      await remove('clients', client.id);
      notify.success('Cliente eliminado');
      close();
      await refresh();
    } catch {
      notify.error('No se pudo eliminar el cliente');
    }
  });
  slot.querySelector('#client-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const user = getCurrentUser();
    const data = { userId: user.id, name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email'), notes: fd.get('notes') };
    try {
      if (fd.get('id')) await update('clients', fd.get('id'), data);
      else await create('clients', data);
      notify.success(fd.get('id') ? 'Cliente actualizado' : 'Cliente creado');
      close(); await refresh();
    } catch {
      notify.error('Error al guardar el cliente');
    }
  });
}

export function clientProfilePage(params = {}) {
  const id = params.id;
  return {
    html: shellWithHeader('Cliente', 'Perfil del cliente', `<button class="btn outline" id="back-clients">Volver a clientes</button>`, `<div id="client-profile-content"></div><div id="client-edit-slot"></div>`),
    async bind(root) {
      root.querySelector('#back-clients').onclick = () => navigate('#/clients');
      const [client, appointments] = await Promise.all([
        get('clients', id),
        list('appointments', { userId: getCurrentUser().id }).then((rows) => rows.filter((a) => a.clientId === id).sort((a,b)=>b.appointmentDate.localeCompare(a.appointmentDate))),
      ]);
      if (!client) return notify.error('Cliente no encontrado');
      const content = root.querySelector('#client-profile-content');
      const total = appointments.length;
      const last = appointments[0]?.appointmentDate;
      const next = appointments.find((a) => a.appointmentDate >= toDateInputValue());
      content.innerHTML = `
        <div class="grid cols-2">
          <div class="card">
            <div class="card-header"><div class="panel"><div><div class="card-title">${escapeHTML(client.name)}</div><div class="card-desc">${escapeHTML(client.email || '')}</div></div><div class="toolbar"><button class="btn outline" id="edit-client-btn">Editar</button><button class="btn danger" id="delete-client-btn">Eliminar</button></div></div></div>
            <div class="card-body">
              <div class="list">
                ${client.phone ? `<div class="list-item"><div><strong>Teléfono</strong><div class="helper">${escapeHTML(client.phone)}</div></div></div>` : ''}
                ${client.email ? `<div class="list-item"><div><strong>Email</strong><div class="helper">${escapeHTML(client.email)}</div></div></div>` : ''}
                <div class="list-item"><div><strong>Total de citas</strong><div class="helper">${total}</div></div></div>
                ${last ? `<div class="list-item"><div><strong>Última cita</strong><div class="helper">${escapeHTML(formatDate(last))}</div></div></div>` : ''}
                ${next ? `<div class="list-item"><div><strong>Próxima cita</strong><div class="helper">${escapeHTML(formatDate(next.appointmentDate))}</div></div></div>` : ''}
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">Notas</div><div class="card-desc">Observaciones internas</div></div>
            <div class="card-body">
              <textarea id="notes" class="textarea" rows="8">${escapeHTML(client.notes || '')}</textarea>
              <div class="toolbar" style="margin-top:12px;justify-content:flex-end">
                <button class="btn outline" id="toggle-notes-edit" type="button">Editar notas</button>
                <button class="btn primary" id="save-notes" type="button">Guardar</button>
              </div>
            </div>
          </div>
        </div>
        <div class="card" style="margin-top:18px">
          <div class="card-header"><div class="card-title">Historial de citas</div></div>
          <div class="card-body">${appointments.length ? appointments.map((apt) => `
            <div class="list-item">
              <div><strong>${escapeHTML(formatLocalDate(apt.appointmentDate, { month:'short', day:'numeric' }))}</strong><div class="helper">${escapeHTML(apt.startTime)} - ${escapeHTML(apt.endTime)} · ${escapeHTML(apt.serviceName || apt.serviceId || '')}</div></div>
              ${statusBadge(appointmentDisplayStatus(apt))}
            </div>`).join('') : emptyState('Sin citas', 'Este cliente aún no tiene citas registradas.', 'calendar')}</div>
        </div>
      `;
      const saveNotes = async () => {
        try { await update('clients', id, { notes: root.querySelector('#notes').value }); notify.success('Notas guardadas'); }
        catch { notify.error('Error al guardar notas'); }
      };
      root.querySelector('#save-notes').onclick = saveNotes;
      root.querySelector('#toggle-notes-edit').onclick = () => root.querySelector('#notes').focus();
      root.querySelector('#edit-client-btn').onclick = () => openClientModal(client, root, async () => location.hash = `#/clients/${id}`);
      root.querySelector('#delete-client-btn').onclick = async () => {
        if (!await confirmDialog('¿Eliminar este cliente de forma definitiva?', { title: 'Eliminar cliente', confirmText: 'Sí, eliminar' })) return;
        try {
          await remove('clients', id);
          notify.success('Cliente eliminado');
          navigate('#/clients');
        } catch {
          notify.error('No se pudo eliminar el cliente');
        }
      };
    }
  };
}

export function servicesPage() {
  return {
    html: shellWithHeader('Servicios', 'Gestiona tus servicios', `<button class="btn primary" id="new-service-btn">Nuevo servicio</button>`, `
      <div class="card"><div class="card-body">
        <div class="toolbar" style="margin-bottom:16px"><div style="flex:1;min-width:240px"><input class="input" id="services-search" placeholder="Buscar servicio"></div></div>
        <div id="services-list"></div>
      </div></div>
      <div id="service-modal-slot"></div>
    `),
    async bind(root) {
      const user = getCurrentUser();
      let services = [];
      const render = () => {
        const query = root.querySelector('#services-search').value;
        const filtered = services.filter((s) => compareText(s.name, query) || compareText(s.description, query));
        root.querySelector('#services-list').innerHTML = filtered.length ? `
          <div class="grid cols-2">${filtered.map((s) => `
            <div class="card">
              <div class="card-body">
                <div class="panel"><div><div class="card-title">${escapeHTML(s.name)}</div><div class="card-desc">${formatCurrency(s.price)} · ${escapeHTML(s.duration)} minutos</div></div></div>
                ${s.description ? `<p class="helper" style="margin:12px 0">${escapeHTML(s.description)}</p>` : ''}
                <div class="toolbar">
                  <button class="btn outline sm js-edit" data-id="${s.id}">Editar</button>
                  <button class="btn danger sm js-delete" data-id="${s.id}">Eliminar</button>
                </div>
              </div>
            </div>`).join('')}</div>` : emptyState(query ? 'No se encontraron servicios' : 'No hay servicios', query ? 'Intenta con otra búsqueda.' : 'Comienza agregando tu primer servicio.', 'briefcase','');
      };
      async function refresh() { services = await list('services', { userId: user.id }); render(); }
      root.querySelector('#services-search').addEventListener('input', render);
      root.querySelector('#new-service-btn').onclick = () => openServiceModal(null, root, refresh);
      root.addEventListener('click', async (e) => {
        const edit = e.target.closest('.js-edit');
        if (edit) return openServiceModal(services.find((s) => s.id === edit.dataset.id), root, refresh);
        const del = e.target.closest('.js-delete');
        if (del && await confirmDialog('¿Estás seguro de eliminar el servicio?', { title: 'Eliminar servicio', confirmText: 'Sí, eliminar' })) {
          await remove('services', del.dataset.id); notify.success('Servicio eliminado'); await refresh();
        }
      });
      root.querySelector('#empty-new-service')?.addEventListener('click', () => openServiceModal(null, root, refresh));
      await refresh();
    }
  };
}

function serviceModalHTML(service = null) {
  const durationOptions = ['15','30','45','60','75','90','120','150','180','240'];
  const currentDuration = String(getDurationMinutes(service?.duration || '30', 30));
  const usesCustomDuration = !durationOptions.includes(currentDuration);
  return `
  <div class="modal-backdrop open">
    <div class="modal">
      <div class="modal-head"><div><h2 class="card-title">${service ? 'Editar servicio' : 'Nuevo servicio'}</h2></div><button class="btn icon ghost js-close">×</button></div>
      <div class="modal-body">
        <form id="service-form" class="form-stack">
          <input type="hidden" name="id" value="${escapeHTML(service?.id || '')}">
          <div class="form-grid">
            <div><label class="label">Nombre *</label><input class="input" name="name" value="${escapeHTML(service?.name || '')}" required></div>
            <div><label class="label">Precio *</label><input class="input" name="price" type="number" min="0" step="0.01" value="${escapeHTML(service?.price || '')}" required></div>
            <div style="grid-column:1/-1"><label class="label">Descripción</label><textarea class="textarea" name="description" rows="3">${escapeHTML(service?.description || '')}</textarea></div>
            <div>
              <label class="label">Duración (minutos)</label>
              <select class="select" name="durationPreset" id="service-duration-preset">
                ${durationOptions.map((value) => `<option value="${value}" ${!usesCustomDuration && currentDuration === value ? 'selected' : ''}>${value} min</option>`).join('')}
                <option value="custom" ${usesCustomDuration ? 'selected' : ''}>Personalizada</option>
              </select>
              <input class="input" name="durationCustom" id="service-duration-custom" type="number" min="1" step="1" value="${escapeHTML(usesCustomDuration ? currentDuration : '')}" placeholder="Ej: 90" style="margin-top:10px;${usesCustomDuration ? '' : 'display:none'}">
              <div class="helper">Elige una duración de la lista o usa una personalizada.</div>
            </div>
          </div>
        </form>
      </div>
      <div class="modal-foot"><button class="btn outline js-close">Cancelar</button><button class="btn primary" form="service-form" type="submit">Guardar</button></div>
    </div>
  </div>`;
}
async function openServiceModal(service, root, refresh) {
  const slot = root.querySelector('#service-modal-slot');
  slot.innerHTML = serviceModalHTML(service);
  const backdrop = slot.querySelector('.modal-backdrop');
  promoteModalToFront(backdrop);
  const close = () => slot.innerHTML = '';
  slot.querySelectorAll('.js-close').forEach((b) => b.addEventListener('click', close));
  const durationPreset = slot.querySelector('#service-duration-preset');
  const durationCustom = slot.querySelector('#service-duration-custom');
  const syncCustomDuration = () => {
    if (!durationCustom || !durationPreset) return;
    durationCustom.style.display = durationPreset.value === 'custom' ? '' : 'none';
    durationCustom.required = durationPreset.value === 'custom';
  };
  durationPreset?.addEventListener('change', syncCustomDuration);
  syncCustomDuration();
  slot.querySelector('#service-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const duration = fd.get('durationPreset') === 'custom' ? fd.get('durationCustom') : fd.get('durationPreset');
    if (!getDurationMinutes(duration, 0)) {
      notify.error('Indica una duración válida');
      return;
    }
    const data = { userId: getCurrentUser().id, name: fd.get('name'), description: fd.get('description'), price: Number(fd.get('price')), duration };
    try {
      if (fd.get('id')) await update('services', fd.get('id'), data); else await create('services', data);
      notify.success(fd.get('id') ? 'Servicio actualizado' : 'Servicio creado');
      close(); await refresh();
    } catch { notify.error('Error al guardar el servicio'); }
  });
}

const REMINDER_LEAD_MINUTES = 60;
const REMINDER_LEAD_MS = REMINDER_LEAD_MINUTES * 60 * 1000;
let reminderAutomationTimer = null;
let reminderAutomationRunning = false;

function getAppointmentReminderDateTime(apt) {
  return parseLocalDateTime(apt?.appointmentDate, apt?.startTime || '00:00');
}

function getReminderSendTime(apt) {
  const appointmentAt = getAppointmentReminderDateTime(apt);
  return appointmentAt ? new Date(appointmentAt.getTime() - REMINDER_LEAD_MS) : null;
}

function isReminderDue(apt, now = new Date()) {
  if (!apt || apt.reminderSent) return false;
  if (apt.status === 'cancelada') return false;
  const appointmentAt = getAppointmentReminderDateTime(apt);
  const reminderAt = getReminderSendTime(apt);
  if (!appointmentAt || !reminderAt) return false;
  return now >= reminderAt && now < appointmentAt;
}

async function sendReminder(apt) {
  const user = getCurrentUser();
  const clients = await list('clients', { userId: user.id });
  const services = await list('services', { userId: user.id });
  const client = clients.find((c) => c.id === apt.clientId);
  const service = services.find((s) => s.id === apt.serviceId);
  if (!client?.email) throw new Error('El cliente no tiene correo electrónico');
  await sendEmailJs({
    to_name: client.name,
    to_email: client.email,
    date: apt.appointmentDate,
    time: `${apt.startTime} - ${apt.endTime}`,
    service_name: service?.name || '',
    salon_name: user.salonName || user.name || '',
  });
  await update('appointments', apt.id, { reminderSent: true, reminderStatus: 'enviado', reminderSentAt: new Date().toISOString() });
}

async function sendAutomaticReminders() {
  if (reminderAutomationRunning) return;
  const user = getCurrentUser();
  if (!user?.id || !user.remindersEnabled) return;

  reminderAutomationRunning = true;
  try {
    let apps = await list('appointments', { userId: user.id });
    const dueReminders = apps
      .filter((apt) => isReminderDue(apt))
      .sort((a, b) => (a.appointmentDate + a.startTime).localeCompare(b.appointmentDate + b.startTime));

    for (const apt of dueReminders) {
      try {
        await sendReminder(apt);
      } catch (err) {
        console.warn('No se pudo enviar el recordatorio automático:', err);
      }
    }
  } finally {
    reminderAutomationRunning = false;
  }
}


async function sendAppointmentConfirmationEmail(appointment) {
  try {
    await sendAppointmentConfirmation(appointment);
  } catch (err) {
    console.warn('No se pudo enviar el correo de confirmación:', err);
  }
}

async function sendAppointmentCancellationEmail(appointment) {
  try {
    await sendAppointmentCancellation(appointment);
  } catch (err) {
    console.warn('No se pudo enviar el correo de cancelación:', err);
  }
}

export function startAutomaticReminders() {
  if (reminderAutomationTimer) return;

  const run = () => {
    sendAutomaticReminders().catch((err) => {
      console.warn('Error en la automatización de recordatorios:', err);
    });
  };

  run();
  reminderAutomationTimer = setInterval(run, 30000);
}

export function remindersPage() {
  return {
    html: shellWithHeader('Recordatorios de Citas', 'Gestiona y envía recordatorios a tus clientes', '', `
      <div class="card reminders-compact"><div class="card-body"><div id="reminders-list"></div></div></div>
    `),
    async bind(root) {
      const user = getCurrentUser();
      let apps = await list('appointments', { userId: user.id });
      apps = apps.filter((a) => a.appointmentDate >= toDateInputValue()).sort((a, b) => (a.appointmentDate + a.startTime).localeCompare(b.appointmentDate + b.startTime));
      const clients = await list('clients', { userId: user.id });
      const services = await list('services', { userId: user.id });
      const mapC = Object.fromEntries(clients.map((c) => [c.id, c]));
      const mapS = Object.fromEntries(services.map((s) => [s.id, s]));

      const renderReminders = () => {
        const isMobile = window.innerWidth <= 760;
        root.querySelector('#reminders-list').innerHTML = apps.length ? (isMobile ? `
          <div class="reminders-list-mobile">
            ${apps.map((apt) => {
              const reminderStatus = apt.reminderStatus || 'pendiente';
              return `
              <div class="reminder-card-mobile">
                <div class="reminder-header">
                  <div>
                    <strong>${escapeHTML(mapC[apt.clientId]?.name || 'Cliente Desconocido')}</strong>
                    <div class="helper">${escapeHTML(mapS[apt.serviceId]?.name || apt.serviceId || '')}</div>
                  </div>
                  ${reminderStatusBadge(reminderStatus)}
                </div>
                <div class="reminder-body">
                  <div class="helper">${escapeHTML(formatLocalDate(apt.appointmentDate, { month:'short', day:'numeric' }))} · ${escapeHTML(apt.startTime)} - ${escapeHTML(apt.endTime)}</div>
                  <div class="helper">Recordatorio: ${apt.reminderSent ? 'Enviado' : (getReminderSendTime(apt) ? formatDateTime(getReminderSendTime(apt)) : 'Pendiente')}</div>
                </div>
                <div class="reminder-actions">
                  <button class="btn sm primary js-send" data-id="${apt.id}" ${apt.reminderSent ? 'disabled' : ''}>${apt.reminderSent ? 'Enviado' : 'Enviar'}</button>
                  <button class="btn sm danger js-delete-reminder" data-id="${apt.id}">Eliminar</button>
                </div>
              </div>`;
            }).join('')}
          </div>` : `
          <div class="table-wrap"><table class="table">
            <thead><tr><th>Fecha y Hora</th><th>Cliente</th><th>Servicio</th><th>Próximo Recordatorio</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              ${apps.map((apt) => {
                const reminderStatus = apt.reminderStatus || 'pendiente';
                return `
                <tr>
                  <td>${escapeHTML(apt.appointmentDate)}<br><span class="helper">${escapeHTML(apt.startTime)} - ${escapeHTML(apt.endTime)}</span></td>
                  <td>${escapeHTML(mapC[apt.clientId]?.name || 'Cliente Desconocido')}</td>
                  <td>${escapeHTML(mapS[apt.serviceId]?.name || apt.serviceId || '')}</td>
                  <td>${apt.reminderSent ? '-' : (getReminderSendTime(apt) ? formatDateTime(getReminderSendTime(apt)) : '-')}</td>
                  <td>${reminderStatusBadge(reminderStatus)}</td>
                  <td><button class="btn sm primary js-send" data-id="${apt.id}" ${apt.reminderSent ? 'disabled' : ''}>Enviar recordatorio</button> <button class="btn sm danger js-delete-reminder" data-id="${apt.id}">Eliminar</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table></div>`
        ) : emptyState('No hay citas próximas', 'Agrega citas para poder enviar recordatorios.', 'bell');
      };

      renderReminders();

      root.addEventListener('click', async (e) => {
        const btn = e.target.closest('.js-send');
        if (btn) {
          const apt = apps.find((a) => a.id === btn.dataset.id);
          if (!apt) return;
          btn.disabled = true;
          btn.textContent = 'Enviando...';
          try {
            await sendReminder(apt);
            notify.success('Recordatorio enviado exitosamente');
            apps = apps.map((a) => a.id === apt.id ? { ...a, reminderStatus: 'enviado', reminderSent: true } : a);
            renderReminders();
          } catch (err) {
            notify.error(err.message || 'Error al enviar recordatorio');
            btn.disabled = false;
            btn.textContent = 'Enviar recordatorio';
          }
          return;
        }

        const del = e.target.closest('.js-delete-reminder');
        if (!del) return;
        const apt = apps.find((a) => a.id === del.dataset.id);
        if (!apt) return;
        if (!await confirmDialog('¿Eliminar este recordatorio?', { title: 'Eliminar recordatorio', confirmText: 'Sí, eliminar' })) return;
        try {
          await remove('appointments', apt.id);
          notify.success('Recordatorio eliminado');
          apps = apps.filter((a) => a.id !== apt.id);
          renderReminders();
        } catch {
          notify.error('No se pudo eliminar el recordatorio');
        }
      });
    }
  };
}

export function financesPage() {

  return {
    html: shellWithHeader('Finanzas', 'Analiza tus ingresos y transacciones', `<button class="btn outline" id="export-csv">Exportar CSV</button>`, `
      <div id="finances-content"></div>
    `),
    async bind(root) {
      const user = getCurrentUser();
      let transactions = await list('transactions', { userId: user.id });
      if (!transactions.length) {
        const apt = await list('appointments', { userId: user.id });
        const services = await list('services', { userId: user.id });
        transactions = apt.map((a, i) => {
          const originalPrice = Number(services.find((s) => s.id === a.serviceId)?.price || 0);
          let discountedPrice = originalPrice;
          let hasPromotion = false;
          if (a.promotionDiscountType && a.promotionDiscountValue) {
            hasPromotion = true;
            if (a.promotionDiscountType === 'percentage') {
              discountedPrice = originalPrice - (originalPrice * Number(a.promotionDiscountValue) / 100);
            } else {
              discountedPrice = originalPrice - Number(a.promotionDiscountValue);
            }
            if (discountedPrice < 0) discountedPrice = 0;
          }
          return {
            id: `txn-${i}`,
            date: a.appointmentDate,
            amount: discountedPrice,
            originalPrice: originalPrice,
            discountedPrice: discountedPrice,
            hasPromotion: hasPromotion,
            promotionName: a.promotionName || '',
            status: a.status === 'cancelada' ? 'pending' : 'completed',
            serviceId: services.find((s) => s.id === a.serviceId)?.name || a.serviceId,
            clientId: a.clientId,
          };
        });
      }
      const completed = transactions.filter((t) => t.status === 'completed');
      const today = toDateInputValue();
      const weekAgo = addDays(new Date(), -7).toISOString().slice(0, 10);
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const summary = {
        today: completed.filter((t) => String(t.date).slice(0,10) === today).reduce((a,b)=>a+Number(b.amount||0),0),
        week: completed.filter((t) => String(t.date).slice(0,10) >= weekAgo).reduce((a,b)=>a+Number(b.amount||0),0),
        month: completed.filter((t) => String(t.date).slice(0,10) >= monthStart).reduce((a,b)=>a+Number(b.amount||0),0),
      };
      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = addDays(new Date(), -6 + i);
        const ds = toDateInputValue(d);
        return { date: ds, label: d.toLocaleDateString('es-ES', { weekday:'short' }), amount: completed.filter((t) => String(t.date).slice(0,10) === ds).reduce((a,b)=>a+Number(b.amount||0),0) };
      });
      const max = Math.max(...last7.map((x) => x.amount), 1);
      const fiveDaysAgo = addDays(new Date(), -5).toISOString().slice(0, 10);
      const recentTransactions = transactions.filter((t) => String(t.date).slice(0,10) >= fiveDaysAgo);
      const isMobile = window.innerWidth <= 760;
      root.querySelector('#finances-content').innerHTML = `
        <div class="grid cols-3" style="margin-bottom:18px">
          <div class="card"><div class="card-header stat"><div><div class="card-title">Ingresos Hoy</div><div class="kpi">${formatCurrency(summary.today)}</div></div>${icon('dollar')}</div></div>
          <div class="card"><div class="card-header stat"><div><div class="card-title">Esta Semana</div><div class="kpi">${formatCurrency(summary.week)}</div></div>${icon('trend')}</div></div>
          <div class="card"><div class="card-header stat"><div><div class="card-title">Este Mes</div><div class="kpi">${formatCurrency(summary.month)}</div></div>${icon('calendar')}</div></div>
        </div>
        <div class="grid cols-2" style="margin-bottom:18px">
          <div class="card"><div class="card-header"><div class="card-title">Ingresos (Últimos 7 días)</div></div><div class="card-body">
            <div class="chart-box"><svg viewBox="0 0 700 280" width="100%" height="100%">
              ${last7.map((x, i) => {
                const barW = 700/7 - 16;
                const xPos = i * (700/7) + 8;
                const h = (x.amount / max) * 200;
                return `<rect x="${xPos}" y="${240-h}" width="${barW}" height="${h}" rx="10"></rect><text x="${xPos+barW/2}" y="260" text-anchor="middle" fill="currentColor" font-size="12">${x.label}</text><text x="${xPos+barW/2}" y="${230-h}" text-anchor="middle" fill="currentColor" font-size="11">${Math.round(x.amount)}</text>`;
              }).join('')}
            </svg></div>
          </div></div>
          <div class="card"><div class="card-header"><div class="card-title">Top Servicios</div><div class="card-desc">Más vendidos este mes</div></div><div class="card-body">
            ${(() => {
              const topServices = Object.values(completed.reduce((acc, t) => {
                const key = t.serviceId || t.serviceName || 'Servicio';
                if (!acc[key]) acc[key] = { name: String(t.serviceId || t.serviceName || 'Servicio'), count: 0, amount: 0 };
                acc[key].count += 1;
                acc[key].amount += Number(t.amount || 0);
                return acc;
              }, {})).sort((a, b) => b.count - a.count).slice(0, 3);
              return `<div class="list">${topServices.length ? topServices.map((s) => `<div class="list-item"><div><strong>${escapeHTML(s.name)}</strong><div class="helper">${s.count} citas</div></div><div class="font-semibold">${formatCurrency(s.amount)}</div></div>`).join('') : '<div class="helper">Aún no hay servicios con ventas</div>'}</div>`;
            })()}
          </div></div>
        </div>
        ${isMobile ? `
        <div class="card">
          <div class="card-header"><div class="card-title">Transacciones Recientes</div></div>
          <div class="card-body">
            <div class="transactions-mobile-list">
              ${recentTransactions.slice(0,5).map((t) => `
                <div class="transaction-card-mobile">
                  <div>
                    <strong>${escapeHTML(formatLocalDate(t.date, { month:'short', day:'numeric' }))}</strong>
                    <div class="helper">${escapeHTML(t.serviceId || '')}</div>
                  </div>
                  <div style="text-align:right">
                    ${t.hasPromotion ? `<div class="font-semibold" style="text-decoration:line-through;opacity:0.6;font-size:0.85em">${formatCurrency(t.originalPrice)}</div><div class="font-semibold">${formatCurrency(t.discountedPrice)}</div>` : `<div class="font-semibold">${formatCurrency(t.amount)}</div>`}
                    ${statusBadge(t.status === 'completed' ? 'confirmada' : 'pendiente')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>` : `
        <div class="card"><div class="card-header"><div class="card-title">Transacciones Recientes</div></div><div class="card-body">
          <div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Cliente</th><th>Servicio</th><th>Estado</th><th>Precio Original</th><th>Precio Final</th></tr></thead><tbody>
            ${recentTransactions.slice(0,10).map((t) => `<tr><td>${escapeHTML(formatDate(t.date))}</td><td>${escapeHTML(t.clientId || '')}</td><td>${escapeHTML(t.serviceId || '')}</td><td>${statusBadge(t.status === 'completed' ? 'confirmada' : 'pendiente')}</td><td>${t.hasPromotion ? `<span style="text-decoration:line-through;opacity:0.6">${formatCurrency(t.originalPrice)}</span>` : formatCurrency(t.amount)}</td><td>${formatCurrency(t.discountedPrice)}</td></tr>`).join('')}
          </tbody></table></div>
        </div></div>`}
      `;
      root.querySelector('#export-csv').onclick = () => {
        const headers = ['Fecha','Precio Original','Precio Final','Estado','Servicio','Cliente'];
        const csv = [headers.join(','), ...transactions.map((t) => [formatDate(t.date), t.originalPrice || t.amount, t.discountedPrice || t.amount, t.status, t.serviceId, t.clientId].join(','))].join('\n');
        downloadText(`finanzas_${toDateInputValue()}.csv`, csv, 'text/csv');
      };
    }
  };
}



async function saveDesignFile(file) {
  const reader = new FileReader();
  return await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

async function fileToDataUrl(file) {
  const reader = new FileReader();
  return await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

function csvEscape(value = '') {
  const text = String(value ?? '');
  return /[",\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function detectDelimiter(text) {
  const firstLine = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .find((line) => line.trim().length);

  if (!firstLine) return ',';
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = -1;

  for (const delimiter of candidates) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i += 1) {
      const char = firstLine[i];
      if (char === '"') {
        const next = firstLine[i + 1];
        if (inQuotes && next === '"') { i += 1; continue; }
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && char === delimiter) count += 1;
    }
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }

  return best;
}

function parseDelimitedText(text) {
  const cleaned = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];
  const delimiter = detectDelimiter(cleaned);
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  const pushCell = () => {
    row.push(current);
    current = '';
  };
  const pushRow = () => {
    if (row.length) rows.push(row);
    row = [];
  };

  for (let i = 0; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    const next = cleaned[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && char === delimiter) {
      pushCell();
      continue;
    }
    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i += 1;
      pushCell();
      pushRow();
      continue;
    }
    current += char;
  }

  pushCell();
  pushRow();

  if (!rows.length) return [];

  const headers = rows.shift().map((value) => String(value || '').trim());
  return rows
    .filter((cols) => cols.some((value) => String(value || '').trim() !== ''))
    .map((cols) => {
      const record = {};
      headers.forEach((header, index) => {
        if (!header) return;
        record[header] = String(cols[index] ?? '').trim();
      });
      return record;
    });
}

function normalizeTemplateHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function mapTemplateRow(row) {
  const mapped = {};
  for (const [rawKey, value] of Object.entries(row || {})) {
    const key = normalizeTemplateHeader(rawKey);
    if (!key) continue;
    mapped[key] = value;
  }
  return mapped;
}

function buildDesignTemplateCSV() {
  const headers = ['filename', 'name', 'categoria', 'tiempoEstimado', 'dificultad', 'descripcion', 'image'];
  const rows = [
    headers.join(','),
    [
      'imagen-01.jpg',
      'Manicure clásico',
      'Clásicos',
      '60 min',
      'Medio',
      'Diseño sencillo para catálogo',
      '',
    ].map(csvEscape).join(','),
    [
      'imagen-02.jpg',
      'Pedicure spa',
      'Spa',
      '75 min',
      'Fácil',
      'Incluye exfoliación y mascarilla',
      '',
    ].map(csvEscape).join(','),
  ];
  return rows.join('\n');
}

function normalizeFilename(value = '') {
  return String(value || '').trim().toLowerCase();
}

function fileBaseName(file, index = 0) {
  const raw = String(file?.name || '').replace(/\.[^.]+$/, '').trim();
  return raw || `Diseño ${index + 1}`;
}

function normalizeTimeValue(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^\d+$/.test(text)) return `${text} min`;
  return text;
}

function buildDesignPayloadFromRow({ row = {}, file = null, index = 0, userId = '' }) {
  const baseName = fileBaseName(file, index);
  return {
    userId,
    name: row.name || row.nombre || baseName,
    categoria: row.categoria || row.category || '',
    tiempoEstimado: normalizeTimeValue(row.tiempoEstimado || row.tiempoestimado || row.tiempo || row.duration || row.duracion || ''),
    dificultad: row.dificultad || row.difficulty || 'Medio',
    descripcion: row.descripcion || row.description || '',
    image: row.image || row.imagen || row.dataUrl || row.dataurl || row.url || '',
  };
}

function renderDesignEditorModal(design = null) {
  return `
  <div class="modal-backdrop open">
    <div class="modal">
      <div class="modal-head"><div><h2 class="card-title">${design ? 'Editar diseño' : 'Crear Nuevo Diseño'}</h2></div><button class="btn icon ghost js-close">×</button></div>
      <div class="modal-body">
        <form id="design-form" class="form-stack">
          <input type="hidden" name="id" value="${escapeHTML(design?.id || '')}">
          <div class="form-grid">
            <div><label class="label">Nombre *</label><input class="input" name="name" value="${escapeHTML(design?.name || '')}" required></div>
            <div><label class="label">Categoría</label><input class="input" name="categoria" value="${escapeHTML(design?.categoria || '')}"></div>
            <div><label class="label">Tiempo estimado</label><input class="input" name="tiempoEstimado" value="${escapeHTML(design?.tiempoEstimado || '')}"></div>
            <div><label class="label">Dificultad</label><select class="select" name="dificultad">${['Fácil','Medio','Difícil'].map(v => `<option ${design?.dificultad===v?'selected':''}>${v}</option>`).join('')}</select></div>
            <div style="grid-column:1/-1"><label class="label">Descripción</label><textarea class="textarea" name="descripcion" rows="3">${escapeHTML(design?.descripcion || '')}</textarea></div>
            <div style="grid-column:1/-1"><label class="label">Enlace de imagen</label><input class="input" name="image" value="${escapeHTML(design?.image || '')}" placeholder="https://..."></div>
            <div style="grid-column:1/-1"><label class="label">Subir imagen local</label><input class="input" type="file" name="file" accept="image/*"></div>
          </div>
        </form>
      </div>
      <div class="modal-foot"><button class="btn outline js-close">Cancelar</button><button class="btn primary" form="design-form" type="submit">Guardar</button></div>
    </div>
  </div>`;
}

function buildBulkDesignPreview(items) {
  if (!items.length) {
    return emptyState(
      'Sin imágenes',
      'Selecciona una carpeta local con imágenes para previsualizar los datos antes de guardar.',
      'image'
    );
  }

  return `
    <div class="form-stack" style="gap:14px">
      ${items.map((item, index) => `
        <div class="card" data-design-row data-index="${index}" data-filename="${escapeHTML(item.filename)}">
          <div class="card-body">
            <div class="grid cols-2" style="align-items:start">
              <div>
                <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" style="width:100%;height:220px;object-fit:cover;border-radius:18px">
                <div class="helper" style="margin-top:10px">Archivo: ${escapeHTML(item.filename)}</div>
              </div>
              <div class="form-stack">
                <div class="form-grid">
                  <div><label class="label">Nombre *</label><input class="input" data-field="name" value="${escapeHTML(item.name)}"></div>
                  <div><label class="label">Categoría</label><input class="input" data-field="categoria" value="${escapeHTML(item.categoria)}"></div>
                  <div><label class="label">Tiempo estimado</label><input class="input" data-field="tiempoEstimado" value="${escapeHTML(item.tiempoEstimado)}" placeholder="Ej: 60 min"></div>
                  <div><label class="label">Dificultad</label><select class="select" data-field="dificultad">
                    ${['Fácil','Medio','Difícil'].map((v) => `<option ${item.dificultad === v ? 'selected' : ''}>${v}</option>`).join('')}
                  </select></div>
                  <div style="grid-column:1/-1"><label class="label">Descripción</label><textarea class="textarea" rows="3" data-field="descripcion">${escapeHTML(item.descripcion)}</textarea></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function buildBulkDesignItems({ templateFile, files }) {
  const localFiles = [...files];
  const templateRows = templateFile
    ? parseDelimitedText(await templateFile.text()).map(mapTemplateRow)
    : [];

  const templateMap = new Map();
  for (const row of templateRows) {
    const keys = [
      row.filename,
      row.file,
      row.archivo,
      row.imagen,
      row.imagefile,
      row.image_name,
    ].filter(Boolean).map(normalizeFilename);
    for (const key of keys) templateMap.set(key, row);
  }

  const items = [];
  for (const [index, file] of localFiles.entries()) {
    const filename = String(file?.name || '').trim();
    if (!filename) continue;
    const row = templateMap.get(normalizeFilename(filename)) || {};
    const image = await saveDesignFile(file);
    const baseName = fileBaseName(file, index);

    items.push({
      file,
      filename,
      image,
      name: row.name || row.nombre || baseName,
      categoria: row.categoria || row.category || '',
      tiempoEstimado: normalizeTimeValue(row.tiempoestimado || row.tiempo || row.duration || row.duracion || ''),
      dificultad: row.dificultad || 'Medio',
      descripcion: row.descripcion || row.description || '',
    });
  }

  return items;
}

async function persistBulkDesignItems(items, userId) {
  const created = [];
  for (const item of items) {
    const payload = buildDesignPayloadFromRow({ row: item, file: item.file, index: created.length, userId });
    if (!payload.image) payload.image = item.image || '';
    await create('designs', payload);
    created.push(payload.name);
  }
  return created;
}

export function designsPage() {
  const state = { designs: [], favorites: [], selectedIds: [], selectionMode: false };
  return {
    html: shellWithHeader('Galería de Diseños', 'Explora y administra tus diseños', `<button class="btn outline" id="bulk-design-btn">Carga masiva</button><button class="btn primary" id="new-design-btn">Nuevo diseño</button>`, `
      <div class="card"><div class="card-body">
        <div class="toolbar" style="margin-bottom:16px;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:240px"><input class="input" id="designs-search" placeholder="Buscar diseño o categoría"></div>
          <button class="btn outline sm" id="toggle-select-btn" type="button">Seleccionar</button>
          <button class="btn outline sm" id="select-all-btn" type="button">Seleccionar todo</button>
          <button class="btn danger sm" id="delete-selected-btn" type="button" style="display:none">Eliminar seleccionadas (0)</button>
        </div>
        <div id="designs-grid"></div>
      </div></div>
      <div id="design-modal-slot"></div>
      <div id="bulk-design-modal-slot"></div>
      <div id="design-detail-slot"></div>
    `),
    async bind(root) {
      const user = getCurrentUser();

      const isSelected = (id) => state.selectedIds.includes(id);
      const toggleSelected = (id) => {
        if (state.selectedIds.includes(id)) {
          state.selectedIds = state.selectedIds.filter((selectedId) => selectedId !== id);
        } else {
          state.selectedIds = [...state.selectedIds, id];
        }
        state.selectionMode = state.selectedIds.length > 0;
      };
      const clearSelection = () => {
        state.selectedIds = [];
        state.selectionMode = false;
      };

      async function refresh() {
        state.designs = await list('designs', { userId: user.id });
        state.favorites = (await list('favoriteDesigns', { userId: user.id })).map((f) => f.designId);
        state.selectedIds = state.selectedIds.filter((id) => state.designs.some((design) => design.id === id));
        if (!state.selectedIds.length) state.selectionMode = false;
        render();
      }
      function getImage(design) {
        return design.image || design.dataUrl || '';
      }
      function renderSelectionControls(filtered) {
        const selectedCount = state.selectedIds.length;
        const toggleBtn = root.querySelector('#toggle-select-btn');
        const selectAllBtn = root.querySelector('#select-all-btn');
        const deleteBtn = root.querySelector('#delete-selected-btn');
        if (!toggleBtn || !selectAllBtn || !deleteBtn) return;

        toggleBtn.textContent = state.selectionMode ? 'Cancelar selección' : 'Seleccionar';

        const selectableFiltered = filtered.filter((d) => d.userId === user.id);
        const allFilteredSelected = selectableFiltered.length > 0 && selectableFiltered.every((d) => state.selectedIds.includes(d.id));
        selectAllBtn.textContent = allFilteredSelected ? 'Deseleccionar todo' : 'Seleccionar todo';
        selectAllBtn.disabled = !selectableFiltered.length;

        deleteBtn.style.display = selectedCount ? '' : 'none';
        deleteBtn.textContent = `Eliminar seleccionadas (${selectedCount})`;
      }
      function render() {
        const q = root.querySelector('#designs-search').value;
        const filtered = state.designs.filter((d) => compareText(d.name, q) || compareText(d.categoria, q));
        root.querySelector('#designs-grid').innerHTML = filtered.length ? `<div class="grid cols-3">${filtered.map((d) => {
          const image = getImage(d);
          const selected = isSelected(d.id);
          return `
          <div class="card" data-id="${d.id}" style="overflow:hidden;cursor:pointer;${selected ? 'outline:2px solid var(--primary-strong);outline-offset:2px' : ''}">
            <div style="position:relative;${image ? '' : 'background:var(--surface-2);min-height:220px;display:flex;align-items:center;justify-content:center'}">
              ${image ? `<img class="js-design-preview" src="${escapeHTML(image)}" alt="${escapeHTML(d.name)}" style="height:220px;width:100%;object-fit:cover;cursor:zoom-in">` : `<div class="empty" style="padding:28px 16px;margin:0;background:transparent;border:none;box-shadow:none"><div class="icon">🖼️</div><div class="helper">Sin imagen</div></div>`}
              <div style="position:absolute;top:10px;left:10px">
                ${state.selectionMode ? `<button class="btn icon primary js-select" data-id="${d.id}" type="button" aria-label="Seleccionar">${selected ? '✓' : '○'}</button>` : ''}
              </div>
              <div style="position:absolute;top:10px;right:10px;display:flex;gap:8px">
                ${d.userId === user.id ? `<button class="btn icon danger js-del" data-id="${d.id}" type="button">×</button>` : ''}
                <button class="btn icon primary js-fav" data-id="${d.id}" type="button">${state.favorites.includes(d.id) ? '♥' : '♡'}</button>
              </div>
              <div style="position:absolute;left:10px;bottom:10px" class="badge neutral">${escapeHTML(d.categoria || 'Diseño')}</div>
            </div>
            <div class="card-body">
              <div style="font-weight:800;font-size:1.05rem">${escapeHTML(d.name)}</div>
              <div class="helper">${escapeHTML(d.tiempoEstimado || 'N/A')} · ${escapeHTML(d.dificultad || 'N/A')}</div>
            </div>
          </div>`;
        }).join('')}</div>` : emptyState('Sin diseños', 'Crea el primer diseño para empezar tu galería.', 'image', '');
        renderSelectionControls(filtered);
      }
      root.querySelector('#designs-search').addEventListener('input', render);
      root.querySelector('#new-design-btn').onclick = () => openDesignEditorModal(null, root, refresh);
      root.querySelector('#bulk-design-btn').onclick = () => openBulkDesignModal(root, refresh);
      root.querySelector('#toggle-select-btn').onclick = () => {
        if (state.selectionMode) clearSelection();
        else state.selectionMode = true;
        render();
      };
      root.querySelector('#select-all-btn').onclick = () => {
        const q = root.querySelector('#designs-search').value;
        const filtered = state.designs.filter((d) => compareText(d.name, q) || compareText(d.categoria, q));
        const selectableFiltered = filtered.filter((d) => d.userId === user.id);
        const allFilteredSelected = selectableFiltered.length > 0 && selectableFiltered.every((d) => state.selectedIds.includes(d.id));
        if (allFilteredSelected) {
          state.selectedIds = state.selectedIds.filter((id) => !selectableFiltered.some((d) => d.id === id));
        } else {
          state.selectedIds = [...new Set([...state.selectedIds, ...selectableFiltered.map((d) => d.id)])];
        }
        state.selectionMode = state.selectedIds.length > 0;
        render();
      };
      root.querySelector('#delete-selected-btn').onclick = async () => {
        const selected = state.designs.filter((d) => state.selectedIds.includes(d.id) && d.userId === user.id);
        if (!selected.length) return;
        const message = selected.length === 1
          ? '¿Eliminar este diseño de forma definitiva?'
          : `¿Eliminar ${selected.length} diseños de forma definitiva?`;
        if (!await confirmDialog(message, { title: 'Eliminar diseño', confirmText: 'Sí, eliminar' })) return;
        try {
          await Promise.all(selected.map((design) => remove('designs', design.id)));
          notify.success(`${selected.length} diseño${selected.length === 1 ? '' : 's'} eliminado${selected.length === 1 ? '' : 's'}`);
          clearSelection();
          await refresh();
        } catch (error) {
          console.error(error);
          notify.error('No se pudo eliminar la selección');
        }
      };
      root.querySelector('#empty-new-design')?.addEventListener('click', () => openDesignEditorModal(null, root, refresh));
      root.addEventListener('click', async (e) => {
        const card = e.target.closest('[data-id]');
        const fav = e.target.closest('.js-fav');
        const del = e.target.closest('.js-del');
        const select = e.target.closest('.js-select');
        const previewImage = e.target.closest('.js-design-preview');

        if (previewImage && !state.selectionMode) {
          const design = state.designs.find((d) => d.id === card?.dataset.id);
          if (design) openDesignDetail(design, root, refresh);
          return;
        }
        if (select) {
          toggleSelected(select.dataset.id);
          render();
          return;
        }
        if (state.selectionMode && card && !fav && !del && !select && !e.target.closest('button')) {
          toggleSelected(card.dataset.id);
          render();
          return;
        }
        if (fav) {
          const designId = fav.dataset.id;
          const existing = (await list('favoriteDesigns', { userId: user.id })).find((x) => x.designId === designId);
          if (existing) { await remove('favoriteDesigns', existing.id); notify.success('Eliminado de favoritos'); }
          else { await create('favoriteDesigns', { userId: user.id, designId }); notify.success('Guardado en favoritos'); }
          return refresh();
        }
        if (del) {
          if (await confirmDialog('¿Estás seguro de eliminar el diseño?', { title: 'Eliminar diseño', confirmText: 'Sí, eliminar' })) {
            await remove('designs', del.dataset.id);
            notify.success('Diseño eliminado');
            return refresh();
          }
        }
        if (card && !fav && !del && !e.target.closest('button') && !state.selectionMode) {
          const design = state.designs.find((d) => d.id === card.dataset.id);
          openDesignDetail(design, root, refresh);
        }
      });
      await refresh();
    }
  };
}

function openDesignEditorModal(design, root, refresh) {
  const slot = root.querySelector('#design-modal-slot');
  slot.innerHTML = renderDesignEditorModal(design);
  const backdrop = slot.querySelector('.modal-backdrop');
  promoteModalToFront(backdrop);
  const close = () => { backdrop?.remove(); slot.innerHTML = ''; };
  slot.querySelectorAll('.js-close').forEach((button) => button.addEventListener('click', close));

  const form = slot.querySelector('#design-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const file = fd.get('file');
    let image = String(fd.get('image') || '').trim();

    if (file instanceof File && file.size) {
      image = await saveDesignFile(file);
    }

    if (!image) {
      notify.error('Agrega una imagen o un enlace de imagen');
      return;
    }

    const payload = {
      name: String(fd.get('name') || '').trim(),
      categoria: String(fd.get('categoria') || '').trim(),
      tiempoEstimado: String(fd.get('tiempoEstimado') || '').trim(),
      dificultad: String(fd.get('dificultad') || 'Medio').trim(),
      descripcion: String(fd.get('descripcion') || '').trim(),
      image,
      userId: getCurrentUser().id,
    };

    if (!payload.name) {
      notify.error('El nombre del diseño es obligatorio');
      return;
    }

    const id = String(fd.get('id') || '').trim();
    try {
      if (id) await update('designs', id, payload);
      else await create('designs', payload);
      notify.success(id ? 'Diseño actualizado' : 'Diseño creado');
      close();
      await refresh();
    } catch (error) {
      console.error(error);
      notify.error('No se pudo guardar el diseño');
    }
  });
}

async function openBulkDesignModal(root, refresh) {
  const slot = root.querySelector('#bulk-design-modal-slot');
  slot.innerHTML = `
  <div class="modal-backdrop open">
    <div class="modal">
      <div class="modal-head">
        <div>
          <h2 class="card-title">Carga local de diseños</h2>
          <p class="card-desc">Selecciona una carpeta con imágenes y completa los datos antes de guardar.</p>
        </div>
        <button class="btn icon ghost js-close">×</button>
      </div>
      <div class="modal-body">
        <form id="bulk-design-form" class="form-stack">
          <div class="panel" style="margin-bottom:16px">
            <div>
              <strong>Plantilla opcional</strong>
              <div class="helper">Si tienes un CSV/TSV, el sistema usará el nombre del archivo para precargar categoría, tiempo y dificultad.</div>
            </div>
            <button class="btn outline sm js-download-template" type="button">Descargar plantilla</button>
          </div>
          <div class="form-grid">
            <div style="grid-column:1/-1">
              <label class="label">Archivo plantilla CSV/TSV</label>
              <input class="input" type="file" name="template" accept=".csv,.tsv,text/csv,text/tab-separated-values">
            </div>
            <div style="grid-column:1/-1">
              <label class="label">Carpeta o imágenes locales</label>
              <input class="input" type="file" name="files" accept="image/*" multiple webkitdirectory directory>
              <div class="helper">Selecciona una carpeta completa o varias imágenes a la vez.</div>
            </div>
          </div>
        </form>
        <div class="separator"></div>
        <div id="bulk-design-preview"></div>
      </div>
      <div class="modal-foot">
        <button class="btn outline js-close" type="button">Cancelar</button>
        <button class="btn primary" id="bulk-design-submit" type="button">Guardar diseños</button>
      </div>
    </div>
  </div>`;

  const backdrop = slot.querySelector('.modal-backdrop');
  promoteModalToFront(backdrop);

  const close = () => { backdrop?.remove(); slot.innerHTML = ''; };
  slot.querySelectorAll('.js-close').forEach((button) => button.addEventListener('click', close));
  slot.querySelector('.js-download-template').addEventListener('click', () => {
    downloadText('plantilla_carga_masiva_disenos.csv', buildDesignTemplateCSV(), 'text/csv');
    notify.info('Plantilla descargada');
  });

  const templateInput = slot.querySelector('input[name="template"]');
  const filesInput = slot.querySelector('input[name="files"]');
  const preview = slot.querySelector('#bulk-design-preview');
  let items = [];

  const renderPreview = () => {
    preview.innerHTML = buildBulkDesignPreview(items);
  };

  const rebuild = async () => {
    const templateFile = templateInput.files?.[0] || null;
    const files = filesInput.files ? [...filesInput.files].filter((file) => file instanceof File && file.size) : [];
    if (!files.length) {
      items = [];
      renderPreview();
      return;
    }
    preview.innerHTML = `<div class="empty"><div class="icon">⌛</div><h3 style="margin:0 0 8px">Preparando vista previa</h3><p style="margin:0;color:var(--muted)">Estamos leyendo las imágenes locales para mostrar los datos que vas a guardar.</p></div>`;
    try {
      items = await buildBulkDesignItems({ templateFile, files });
      renderPreview();
    } catch (error) {
      console.error(error);
      items = [];
      preview.innerHTML = `<div class="empty"><div class="icon">⚠️</div><h3 style="margin:0 0 8px">No se pudo leer la carpeta</h3><p style="margin:0;color:var(--muted)">Revisa que las imágenes sean válidas e inténtalo de nuevo.</p></div>`;
    }
  };

  templateInput.addEventListener('change', rebuild);
  filesInput.addEventListener('change', rebuild);

  slot.querySelector('#bulk-design-submit').addEventListener('click', async () => {
    if (!items.length) {
      notify.error('Selecciona al menos una imagen local');
      return;
    }

    const rows = [...preview.querySelectorAll('[data-design-row]')];
    if (!rows.length) {
      notify.error('Selecciona al menos una imagen local');
      return;
    }

    const normalizedItems = rows.map((row, index) => {
      const getField = (name) => row.querySelector(`[data-field="${name}"]`);
      const source = items[index] || {};
      return {
        ...source,
        name: String(getField('name')?.value || source.name || '').trim(),
        categoria: String(getField('categoria')?.value || source.categoria || '').trim(),
        tiempoEstimado: String(getField('tiempoEstimado')?.value || source.tiempoEstimado || '').trim(),
        dificultad: String(getField('dificultad')?.value || source.dificultad || 'Medio').trim(),
        descripcion: String(getField('descripcion')?.value || source.descripcion || '').trim(),
      };
    }).filter((item) => item.name);

    if (!normalizedItems.length) {
      notify.error('Completa al menos el nombre del diseño');
      return;
    }

    try {
      const created = await persistBulkDesignItems(normalizedItems, getCurrentUser().id);
      notify.success(`Se cargaron ${created.length} diseño${created.length === 1 ? '' : 's'} correctamente`);
      close();
      await refresh();
    } catch (error) {
      console.error(error);
      notify.error('No se pudo completar la carga local');
    }
  });

  await rebuild();
}

function openDesignDetail(design, root, refresh) {
  if (!design) return;
  const slot = root.querySelector('#design-detail-slot');
  const preview = openMediaPreviewModal({
    title: design.name,
    subtitle: design.categoria || '',
    image: design.image || '',
    description: design.descripcion || '',
    footer: `
      <button class="btn outline js-close" type="button">Cerrar</button>
      <button class="btn primary js-fav-detail" type="button">Guardar en favoritos</button>
    `,
  });
  if (slot) slot.innerHTML = '';
  preview.slot.querySelector('.js-fav-detail').onclick = async () => {
    const existing = (await list('favoriteDesigns', { userId: getCurrentUser().id })).find((x) => x.designId === design.id);
    if (!existing) await create('favoriteDesigns', { userId: getCurrentUser().id, designId: design.id });
    notify.success('Guardado en favoritos');
    preview.close();
    await refresh();
  };
}

function openRecommendationPreview(rec) {
  if (!rec) return;
  openMediaPreviewModal({
    title: rec.nombre || 'Referencia',
    subtitle: rec.categoria || rec.fuente || 'Recomendación IA',
    image: rec.imagen || '',
    description: rec['descripción'] || rec.descripcion || '',
  });
}

function buildPinterestSearchUrl(query = '') {
  const q = String(query || 'diseño de uñas').trim() || 'diseño de uñas';
  return `https://co.pinterest.com/search/pins/?q=${encodeURIComponent(q)}&rs=typed`;
}

function pinterestLoginUrl() {
  return 'http://127.0.0.1:8787/login';
}

const NAIL_SHAPES = [
  { value: 'ovaladas', label: 'Ovaladas' },
  { value: 'cuadradas', label: 'Cuadradas' },
  { value: 'almendradas', label: 'Almendradas' },
];

const NAIL_COLORS = [
  { value: 'rojo', label: 'Rojo' },
  { value: 'rosa', label: 'Rosa' },
  { value: 'blanco', label: 'Blanco' },
  { value: 'negro', label: 'Negro' },
  { value: 'azul', label: 'Azul' },
  { value: 'morado', label: 'Morado' },
];

const NAIL_DESIGNS = [
  { value: 'floral', label: 'Floral' },
  { value: 'minimalista', label: 'Minimalista' },
  { value: 'frances', label: 'Frances' },
];

const NAIL_COLOR_HEX = {
  rojo: '#e63946',
  rosa: '#ff8fab',
  blanco: '#f1faee',
  negro: '#1d3557',
  azul: '#457b9d',
  morado: '#7b2cbf',
};

export function recommendationsPage() {
  const state = {
    step: 'form',
    nailType: '',
    color: '',
    design: '',
    recommendations: [],
    loading: false,
    showCustom: { nailType: false, color: false, design: false },
    searchGen: 0,
  };

  return {
    html: `
      <div class="rec-full">
        <div class="page-head">
          <div>
            <h1 class="page-title">Recomendaciones</h1>
            <p class="page-subtitle">Encuentra el diseño perfecto para tus uñas</p>
          </div>
          <span class="bridge-status" id="bridge-status" style="display:none">⏳</span>
        </div>
        <div id="recommendations-content"></div>
      </div>
    `,
    bind(root) {
      const saveResultsToCache = () => {
        try {
          localStorage.setItem('rec_cache', JSON.stringify({
            nailType: state.nailType,
            color: state.color,
            design: state.design,
            recommendations: state.recommendations,
            step: 'results',
            savedAt: Date.now(),
          }));
        } catch {}
      };

      const loadResultsFromCache = () => {
        try {
          const raw = localStorage.getItem('rec_cache');
          if (!raw) return false;
          const data = JSON.parse(raw);
          const age = Date.now() - (data.savedAt || 0);
          if (age > 15 * 60 * 1000) {
            localStorage.removeItem('rec_cache');
            return false;
          }
          state.nailType = data.nailType || '';
          state.color = data.color || '';
          state.design = data.design || '';
          state.recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
          state.step = 'results';
          return true;
        } catch { return false; }
      };

      const searchPinterest = async () => {
        const gen = ++state.searchGen;
        const parts = [state.nailType, state.color, state.design].filter(Boolean);
        const query = `uñas ${parts.join(' ')}`;
        state.loading = true;
        state.recommendations = [];
        render();

        try {
          const recs = await getRecommendations({
            userId: getCurrentUser().id,
            preferences: query,
          });
          if (gen !== state.searchGen) return;
          state.recommendations = recs;
        } catch (err) {
          if (gen !== state.searchGen) return;
          console.error(err);
        }

        state.loading = false;
        state.step = 'results';
        render();
        saveResultsToCache();
      };

      const setCustomValue = (field, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        state[field] = trimmed;
        state.showCustom[field] = false;
        render();

        if (field === 'nailType') {
          setTimeout(() => {
            const el = root.querySelector('#q-color');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
        if (field === 'color') {
          setTimeout(() => {
            const el = root.querySelector('#q-design');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
        if (field === 'design') {
          setTimeout(searchPinterest, 300);
        }
      };

      const select = (field, value) => {
        if (value === '__custom__') {
          state.showCustom[field] = true;
          state[field] = '';
          render();
          setTimeout(() => {
            const inp = root.querySelector(`#custom-${field}`);
            if (inp) inp.focus();
          }, 50);
          return;
        }
        if (value === state[field]) return;
        state[field] = value;
        state.showCustom[field] = false;
        render();

        if (field === 'nailType') {
          setTimeout(() => {
            const el = root.querySelector('#q-color');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
        if (field === 'color') {
          setTimeout(() => {
            const el = root.querySelector('#q-design');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
        if (field === 'design') {
          setTimeout(searchPinterest, 300);
        }
      };

      const render = () => {
        const q1done = Boolean(state.nailType);
        const q2done = Boolean(state.color);
        const q3done = state.design !== '';

        root.querySelector('#recommendations-content').innerHTML = `
          <section class="ai-chat-shell">
            <div class="ai-chat-thread" id="rec-thread">

              ${state.step === 'form' ? `
                <div class="ai-message ai-message-assistant fade-up">
                  <div class="ai-avatar">💅</div>
                  <div class="ai-bubble">
                    <div class="ai-q-label">Hola! Cuentame que unas quieres</div>
                    <div class="ai-q-sub">Selecciona una opcion o escribe la tuya. Buscare las mejores imagenes.</div>

                    <div id="q-type" class="ai-q-group stagger-1">
                      <div class="ai-q-num">Que forma prefieres?</div>
                      <div class="ai-options">
                        ${NAIL_SHAPES.map((s) => `
                          <button class="ai-option${state.nailType === s.value ? ' selected' : ''}" data-field="nailType" data-value="${s.value}">${s.label}</button>
                        `).join('')}
                        <button class="ai-option ai-option-other${state.showCustom.nailType ? ' selected' : ''}" data-field="nailType" data-value="__custom__">Otra...</button>
                      </div>
                      ${state.showCustom.nailType ? `
                        <div class="ai-custom-wrap">
                          <input class="ai-custom-input" id="custom-nailType" type="text" placeholder="Escribe la forma que quieres" maxlength="40" autofocus>
                          <p class="ai-custom-hint">Presiona Enter para confirmar</p>
                        </div>
                      ` : ''}
                      ${!state.showCustom.nailType && state.nailType && !NAIL_SHAPES.some((s) => s.value === state.nailType) ? `
                        <div class="ai-custom-value">
                          Elegiste: <strong>${escapeHTML(state.nailType)}</strong>
                          <button class="ai-option ai-option-other selected" data-field="nailType" data-value="__custom__">Cambiar</button>
                        </div>
                      ` : ''}
                    </div>

                    ${q1done ? `
                      <div id="q-color" class="ai-q-group stagger-2">
                        <div class="ai-q-num">Que color te gusta?</div>
                        <div class="ai-options">
                          ${NAIL_COLORS.map((c) => `
                            <button class="ai-option ai-color-opt${state.color === c.value ? ' selected' : ''}" data-field="color" data-value="${c.value}">
                              <span class="ai-color-dot" style="background:${NAIL_COLOR_HEX[c.value] || '#ccc'}"></span>
                              ${c.label}
                            </button>
                          `).join('')}
                          <button class="ai-option ai-option-other${state.showCustom.color ? ' selected' : ''}" data-field="color" data-value="__custom__">Otra...</button>
                        </div>
                        ${state.showCustom.color ? `
                          <div class="ai-custom-wrap">
                            <input class="ai-custom-input" id="custom-color" type="text" placeholder="Escribe el color que quieres" maxlength="40" autofocus>
                            <p class="ai-custom-hint">Presiona Enter para confirmar</p>
                          </div>
                        ` : ''}
                        ${!state.showCustom.color && state.color && !NAIL_COLORS.some((c) => c.value === state.color) ? `
                          <div class="ai-custom-value">
                            Elegiste: <strong>${escapeHTML(state.color)}</strong>
                            <button class="ai-option ai-option-other selected" data-field="color" data-value="__custom__">Cambiar</button>
                          </div>
                        ` : ''}
                      </div>
                    ` : ''}

                    ${q2done ? `
                      <div id="q-design" class="ai-q-group stagger-3">
                        <div class="ai-q-num">Que diseno prefieres?</div>
                        <div class="ai-options">
                          ${NAIL_DESIGNS.map((d) => `
                            <button class="ai-option${state.design === d.value ? ' selected' : ''}" data-field="design" data-value="${d.value}">${d.label}</button>
                          `).join('')}
                          <button class="ai-option ai-option-other${state.showCustom.design ? ' selected' : ''}" data-field="design" data-value="__custom__">Otra...</button>
                        </div>
                        ${state.showCustom.design ? `
                          <div class="ai-custom-wrap">
                            <input class="ai-custom-input" id="custom-design" type="text" placeholder="Escribe el diseno que buscas" maxlength="40" autofocus>
                            <p class="ai-custom-hint">Presiona Enter para confirmar</p>
                          </div>
                        ` : ''}
                        ${!state.showCustom.design && state.design && !NAIL_DESIGNS.some((d) => d.value === state.design) ? `
                          <div class="ai-custom-value">
                            Elegiste: <strong>${escapeHTML(state.design)}</strong>
                            <button class="ai-option ai-option-other selected" data-field="design" data-value="__custom__">Cambiar</button>
                          </div>
                        ` : ''}
                      </div>
                    ` : ''}
                  </div>
                </div>
              ` : ''}

              ${state.loading ? `
                <div class="ai-message ai-message-assistant fade-up">
                  <div class="ai-avatar">✨</div>
                  <div class="ai-bubble">
                    <strong>Buscando imagenes...</strong>
                    <div class="ai-loading-dots">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              ` : ''}

              ${state.step === 'results' && !state.loading ? `
                <div class="ai-message ai-message-user">
                  <div class="ai-bubble">${escapeHTML(`uñas ${[state.nailType, state.color, state.design].filter(Boolean).join(' ')}`)}</div>
                </div>
                <div class="ai-message ai-message-assistant">
                  <div class="ai-avatar">✨</div>
                  ${state.recommendations.length ? `
                    <div style="flex:1;min-width:0">
                      <div class="ai-bubble" style="margin-bottom:10px">
                        <strong>${state.recommendations.length} referencias para ti</strong>
                        <span>Toca una imagen para verla en grande o guárdala si te gusta.</span>
                      </div>
                      <div class="ai-results-grid">
                        ${state.recommendations.map((rec, i) => `
                          <article class="ai-rec-card js-rec-card fade-up stagger-${Math.min(i + 1, 4)}" data-id="${escapeHTML(rec.id || '')}">
                            <img class="js-rec-preview" src="${escapeHTML(rec.imagen || '')}" alt="${escapeHTML(rec.nombre || 'Referencia')}" loading="lazy">
                            <div class="ai-rec-overlay">
                              <span class="badge neutral">Inspiración</span>
                              <button class="btn sm primary js-save-rec" type="button" data-id="${escapeHTML(rec.id || '')}">Guardar</button>
                            </div>
                          </article>
                        `).join('')}
                      </div>
                    </div>
                  ` : `
                    <div class="ai-bubble">
                      <strong>No encontre resultados</strong>
                      <span>Prueba con otras opciones o intenta de nuevo.</span>
                    </div>
                  `}
                </div>
                <div class="ai-message ai-message-assistant" style="margin-top:2px">
                  <div class="ai-avatar" style="background:transparent;border:none;font-size:.7rem;width:28px;min-width:28px;flex:0 0 28px">↩</div>
                  <div class="ai-bubble" style="cursor:pointer;padding:10px 16px;opacity:.65;transition:opacity .2s" id="start-over" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.65">
                    <span style="color:var(--text);font-size:.85rem;font-weight:600">Volver a empezar</span>
                  </div>
                </div>
              ` : ''}

            </div>
          </section>`;
      };

      if (loadResultsFromCache()) {
        render();
      }

      const checkBridgeStatus = async () => {
        const badge = root.querySelector('#bridge-status');
        if (!badge) return;
        const fnUrl = APP_CONFIG.media?.netlifyFunctionUrl;
        try {
          if (fnUrl) {
            const res = await fetch(`${String(fnUrl).replace(/\/$/, '')}?q=test`);
            if (res.ok) {
              badge.innerHTML = '🟢';
              badge.title = 'Netlify Function conectada';
              return;
            }
          }
        } catch {}
        try {
          const res = await fetch('http://127.0.0.1:8787/health');
          if (res.ok) {
            badge.innerHTML = '🟡';
            badge.title = 'Bridge local conectado';
            return;
          }
        } catch {}
        badge.innerHTML = '🔴';
        badge.title = 'Sin conexión';
      };
      checkBridgeStatus();
      setInterval(checkBridgeStatus, 15000);

      root.addEventListener('click', async (e) => {
        const opt = e.target.closest('.ai-option');
        if (opt) {
          select(opt.dataset.field, opt.dataset.value);
          return;
        }

        if (e.target.closest('#start-over')) {
          state.searchGen++;
          state.step = 'form';
          state.nailType = '';
          state.color = '';
          state.design = '';
          state.recommendations = [];
          state.loading = false;
          state.showCustom = { nailType: false, color: false, design: false };
          localStorage.removeItem('rec_cache');
          render();
          return;
        }

        const card = e.target.closest('.js-rec-card');
        const saveBtn = e.target.closest('.js-save-rec');
        const previewImg = e.target.closest('.js-rec-preview');

        if (saveBtn) {
          const rec = state.recommendations.find((r) => r.id === saveBtn.dataset.id);
          if (!rec) return;
          try {
            const userId = getCurrentUser().id;
            const existing = (await list('designs', { userId })).find((d) => {
              const img = d.image || d.dataUrl || '';
              return img && img === (rec.imagen || '') && compareText(d.name, rec.nombre || '');
            });
            if (existing) {
              notify.success('Ya guardada en Diseños');
              return;
            }
            await create('designs', {
              userId,
              name: rec.nombre || 'Diseño',
              image: rec.imagen || '',
              source: 'Inspiración',
              sourceUrl: rec.url || '',
              categoria: rec.categoria || 'Recomendación',
            });
            notify.success('Guardada en Diseños');
          } catch (err) {
            notify.error('Error al guardar');
          }
          return;
        }

        if (card || previewImg) {
          const id = card?.dataset.id || previewImg?.closest('.js-rec-card')?.dataset.id;
          const rec = state.recommendations.find((r) => r.id === id);
          if (rec) openRecommendationPreview(rec);
        }
      });

      root.addEventListener('keydown', (e) => {
        const inp = e.target.closest('.ai-custom-input');
        if (!inp) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          const field = inp.id.replace('custom-', '');
          setCustomValue(field, inp.value);
        }
      });

      render();
    },
  };
}

export function promotionsPage() {
  const state = { promotions: [], services: [], showModal: false };
  return {
    html: shellWithHeader('Promociones', 'Gestiona descuentos y campañas para tus clientes', `<button class="btn primary" id="new-promo-btn">Nueva Promoción</button>`, `
      <div class="card"><div class="card-body"><div id="promotions-list"></div></div></div>
      <div id="promotion-modal-slot"></div>
    `),
    async bind(root) {
      const user = getCurrentUser();
      const refresh = async () => { 
        state.promotions = await list('promotions', { userId: user.id }); 
        state.services = await list('services', { userId: user.id });
        render(); 
      };
      const render = () => {
        const servicesMap = Object.fromEntries(state.services.map((s) => [s.id, s]));
        const isMobile = window.innerWidth <= 760;
        root.querySelector('#promotions-list').innerHTML = state.promotions.length ? (isMobile ? `
          <div style="display:flex;flex-direction:column;gap:12px">
          ${state.promotions.map((p) => {
            const serviceNames = p.serviceIds && p.serviceIds.length
              ? p.serviceIds.map((id) => servicesMap[id]?.name || id).join(', ')
              : 'Todos los servicios';
            return `
            <div class="card" style="margin-bottom:0">
              <div class="card-header"><div class="card-title">${escapeHTML(p.name)}</div>${statusBadge(p.status === 'active' ? 'confirmada' : 'pendiente')}</div>
              <div class="card-body">
                <div style="display:flex;flex-direction:column;gap:8px">
                  <div style="display:flex;justify-content:space-between"><span class="helper">Descuento</span><strong>${p.discountType === 'percentage' ? `${p.discountValue}%` : formatCurrency(p.discountValue)}</strong></div>
                  <div style="display:flex;justify-content:space-between"><span class="helper">Válido hasta</span><span>${escapeHTML(formatDate(p.validUntil))}</span></div>
                  <div style="display:flex;justify-content:space-between"><span class="helper">Usos</span><span>${p.currentUses || 0}</span></div>
                  <div><span class="helper">Servicios</span><div style="margin-top:4px">${escapeHTML(serviceNames)}</div></div>
                  <div style="display:flex;gap:8px;margin-top:8px">
                    <button class="btn sm outline flex-1 js-notify" data-id="${p.id}">Notificar</button>
                    <button class="btn sm danger flex-1 js-delete-promo" data-id="${p.id}">Eliminar</button>
                  </div>
                </div>
              </div>
            </div>`;
          }).join('')}
          </div>` : `
          <div class="table-wrap"><table class="table"><thead><tr><th>Nombre</th><th>Descuento</th><th>Servicios</th><th>Válido hasta</th><th>Usos</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
          ${state.promotions.map((p) => {
            const serviceNames = p.serviceIds && p.serviceIds.length
              ? p.serviceIds.map((id) => servicesMap[id]?.name || id).join(', ')
              : 'Todos los servicios';
            return `
            <tr>
              <td class="font-medium">${escapeHTML(p.name)}</td>
              <td>${p.discountType === 'percentage' ? `${p.discountValue}%` : formatCurrency(p.discountValue)}</td>
              <td>${escapeHTML(serviceNames)}</td>
              <td>${escapeHTML(formatDate(p.validUntil))}</td>
              <td>${p.currentUses || 0}</td>
              <td>${statusBadge(p.status === 'active' ? 'confirmada' : 'pendiente')}</td>
              <td><button class="btn sm outline js-notify" data-id="${p.id}">Notificar</button> <button class="btn sm danger js-delete-promo" data-id="${p.id}">Eliminar</button></td>
            </tr>`;
          }).join('')}
          </tbody></table></div>`
        ) : emptyState('No hay promociones', 'Crea tu primera promoción para atraer más clientes.', 'tag', '');
      };
      root.querySelector('#new-promo-btn').onclick = () => openPromotionModal(root, refresh);
      root.querySelector('#empty-new-promo')?.addEventListener('click', () => openPromotionModal(root, refresh));
      root.addEventListener('click', async (e) => {
        const notifyBtn = e.target.closest('.js-notify');
        const deleteBtn = e.target.closest('.js-delete-promo');
        if (notifyBtn) {
          const promo = state.promotions.find((p) => p.id === notifyBtn.dataset.id);
          try {
            const result = await sendPromotionNotification(promo);
            notify.success(result.failed ? `Notificación enviada a ${result.sent} clientes (${result.failed} fallaron)` : `Notificación enviada a ${result.sent} clientes`);
          } catch (error) {
            notify.error(error?.message || 'No se pudo enviar la notificación');
          }
        }
        if (deleteBtn && await confirmDialog('¿Eliminar la promoción?', { title: 'Eliminar promoción', confirmText: 'Sí, eliminar' })) { await remove('promotions', deleteBtn.dataset.id); notify.success('Promoción eliminada'); await refresh(); }
      });
      await refresh();
    }
  };
}
function promotionModalHTML(services = []) {
  return `
  <div class="modal-backdrop open">
    <div class="modal">
      <div class="modal-head"><div><h2 class="card-title">Crear Promoción</h2></div><button class="btn icon ghost js-close">×</button></div>
      <div class="modal-body">
        <form id="promotion-form" class="form-stack">
          <div class="form-grid">
            <div><label class="label">Nombre de la campaña</label><input class="input" name="name" placeholder="Ej: Especial Día de la Madre" required></div>
            <div><label class="label">Tipo de Descuento</label><select class="select" name="discountType"><option value="percentage">Porcentaje (%)</option><option value="fixed">Monto Fijo ($)</option></select></div>
            <div><label class="label">Valor</label><input class="input" name="discountValue" type="number" min="1" required></div>
            <div><label class="label">Válido Hasta</label><input class="input" name="validUntil" type="date" required></div>
            <div style="grid-column:1/-1"><label class="label">Servicios aplicables</label>
              <select class="select" name="serviceIds" multiple size="5">
                ${services.map((s) => `<option value="${s.id}">${escapeHTML(s.name)} - ${formatCurrency(s.price)}</option>`).join('')}
              </select>
              <div class="helper">Mantén presionada la tecla Ctrl (Cmd en Mac) para seleccionar múltiples servicios. Si no seleccionas ninguno, la promoción aplicará a todos.</div>
            </div>
            <div style="grid-column:1/-1"><label class="label">Estado</label><select class="select" name="status"><option value="active">Activa</option><option value="inactive">Inactiva</option></select></div>
          </div>
        </form>
      </div>
      <div class="modal-foot"><button class="btn outline js-close">Cancelar</button><button class="btn primary" form="promotion-form" type="submit">Crear Promoción</button></div>
    </div>
  </div>`;
}
async function openPromotionModal(root, refresh) {
  const slot = root.querySelector('#promotion-modal-slot');
  const user = getCurrentUser();
  let services = [];
  try {
    services = await list('services', { userId: user.id });
  } catch (error) {
    console.error('Error al cargar servicios:', error);
    services = [];
  }
  slot.innerHTML = promotionModalHTML(services);
  const backdrop = slot.querySelector('.modal-backdrop');
  promoteModalToFront(backdrop);
  const close = () => slot.innerHTML = '';
  slot.querySelectorAll('.js-close').forEach((b) => b.addEventListener('click', close));
  slot.querySelector('#promotion-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const selectedServiceIds = fd.getAll('serviceIds');
    console.log('Datos del formulario:', Object.fromEntries(fd));
    console.log('serviceIds seleccionados:', selectedServiceIds);
    
    // Validaciones
    const discountValueRaw = fd.get('discountValue');
    const discountValue = Number(String(discountValueRaw).replace(',', '.'));
    if (isNaN(discountValue) || discountValue <= 0) {
      notify.error('El valor del descuento debe ser un número mayor que 0');
      return;
    }
    
    try {
      const payload = { 
        userId: user.id, 
        name: fd.get('name'), 
        discountType: fd.get('discountType'), 
        discountValue, 
        validUntil: fd.get('validUntil'), 
        status: fd.get('status'), 
        currentUses: 0,
        serviceIds: selectedServiceIds,
      };
      console.log('Payload a guardar:', payload);
      await create('promotions', payload);
      notify.success('Promoción creada');
      close(); await refresh();
    } catch (error) {
      console.error('Error al crear promoción:', error);
      let errorMsg = 'Error al crear promoción';
      if (error?.message) {
        errorMsg += `: ${error.message}`;
      } else if (error?.code) {
        errorMsg += ` (código: ${error.code})`;
      }
      notify.error(errorMsg);
    }
  });
}
async function sendPromotionNotification(promo) {
  const user = getCurrentUser();
  const [clients, services] = await Promise.all([
    list('clients', { userId: user.id }),
    list('services', { userId: user.id }),
  ]);
  const recipients = clients.filter((c) => String(c.email || '').trim());

  if (!recipients.length) {
    throw new Error('No hay clientes con correo registrado');
  }

  const validUntil = promo?.validUntil ? formatDate(promo.validUntil) : 'sin fecha definida';
  const discount = promo?.discountType === 'percentage'
    ? `${promo.discountValue}%`
    : formatCurrency(promo.discountValue);

  const serviceNames = Array.isArray(promo?.serviceIds) && promo.serviceIds.length
    ? promo.serviceIds.map((id) => services.find((s) => s.id === id)?.name || id).filter(Boolean)
    : [];

  const servicesText = serviceNames.length ? serviceNames.join(', ') : 'Todos los servicios';
  const templateId = APP_CONFIG.emailjs.promotionTemplateId;
  if (isPlaceholder(templateId)) {
    throw new Error('Configura promotionTemplateId en js/config.js');
  }

  const results = await Promise.allSettled(recipients.map((client) => sendEmailJs({
    to_name: client.name || 'Cliente',
    to_email: client.email,
    promo_name: promo?.name || 'Promoción',
    discount,
    valid_until: validUntil,
    services_text: servicesText,
    salon_name: user.salonName || user.name || '',
    message: `Hay una nueva promoción disponible en ${user.salonName || user.name || 'tu salón'} hasta ${validUntil}.`,
  }, templateId)));

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - sent;

  if (!sent) {
    throw new Error('No se pudo enviar la notificación');
  }

  return { sent, failed, total: results.length };
}

export function growthPage() {
  return {
    html: shellWithHeader('Crecimiento', 'Monitorea el rendimiento de tu negocio', '', `<div id="growth-content"></div>`),
    async bind(root) {
      const user = getCurrentUser();
      const [appointments, clients, services, promotions] = await Promise.all([
        list('appointments', { userId: user.id }),
        list('clients', { userId: user.id }),
        list('services', { userId: user.id }),
        list('promotions', { userId: user.id }),
      ]);
      const totalAppointments = appointments.length;
      const completed = appointments.filter((a) => a.status === 'confirmada').length;
      const occupancy = Math.min(95, Math.round((completed / Math.max(totalAppointments, 1)) * 100));
      root.querySelector('#growth-content').innerHTML = `
        <div class="grid cols-4" style="margin-bottom:18px">
          <div class="card"><div class="card-body"><div class="card-title">Clientes activos</div><div class="kpi">${clients.length}</div><div class="helper">Total registrados</div></div></div>
          <div class="card"><div class="card-body"><div class="card-title">Citas completadas</div><div class="kpi">${completed}</div><div class="helper">${totalAppointments} programadas</div></div></div>
          <div class="card"><div class="card-body"><div class="card-title">Promociones activas</div><div class="kpi">${promotions.filter((p) => p.status === 'active').length}</div><div class="helper">Campañas activas</div></div></div>
          <div class="card"><div class="card-body"><div class="card-title">Ocupación</div><div class="kpi">${occupancy}%</div><div class="helper">Estimación semanal</div></div></div>
        </div>
        <div class="grid cols-2">
          <div class="card"><div class="card-header"><div class="card-title">Tendencia semanal</div></div><div class="card-body"><div class="chart-box"><svg viewBox="0 0 700 280" width="100%" height="100%"><polyline fill="none" stroke="currentColor" stroke-width="4" points="${Array.from({length:7}, (_,i) => `${40+i*100},${220 - ((appointments.filter((a)=>a.appointmentDate===toDateInputValue(addDays(new Date(), -6+i))).length)/Math.max(appointments.length,1))*180}`).join(' ')}"></polyline></svg></div></div></div>
          <div class="card"><div class="card-header"><div class="card-title">Recomendaciones Automáticas</div></div><div class="card-body">
            <div class="list">
              <div class="list-item"><div><strong>Baja ocupación los Lunes</strong><div class="helper">Tu ocupación promedio los lunes es del 45%. Te sugerimos crear una promoción del 15% de descuento válida solo para este día.</div></div></div>
              <div class="list-item"><div><strong>Oportunidad de Upselling</strong><div class="helper">El 60% de tus clientes de "Manicure Clásico" no agregan diseño. Considera ofrecer un diseño sencillo a mitad de precio durante la cita.</div></div></div>
            </div>
          </div></div>
        </div>
      `;
    }
  };
}

function profileSchedulesHTML(schedules) {
  return schedules.map((s, i) => `
    <div class="card js-schedule" data-id="${s.id || `temp-${i}`}">
      <div class="card-body">
        <div class="panel" style="margin-bottom:10px"><strong>Horario ${i+1}</strong><button class="btn sm danger js-remove-schedule" type="button">Eliminar</button></div>
        <div class="form-grid">
          <div>
            <label class="label">Día de la semana</label>
            <select class="select" data-field="dayOfWeek">${weekdays.map((d) => `<option value="${d}" ${s.dayOfWeek===d?'selected':''}>${weekdayLabels[d]}</option>`).join('')}</select>
          </div>
          <div></div>
          <div><label class="label">Hora inicio</label><input class="input" type="time" data-field="startTime" value="${escapeHTML(s.startTime || '09:00')}"></div>
          <div><label class="label">Hora fin</label><input class="input" type="time" data-field="endTime" value="${escapeHTML(s.endTime || '18:00')}"></div>
        </div>
      </div>
    </div>
  `).join('');
}

export function profilePage() {
  const state = {
    schedules: [],
    profile: { salonName:'', phone:'', email:'', remindersEnabled:false, avatar:'' },
    password: { oldPassword:'', password:'', passwordConfirm:'' },
  };
  return {
    html: shellWithHeader('Perfil y Configuración', 'Ajusta tus datos', '', `<div id="profile-content"></div>`),
    async bind(root) {
      const user = getCurrentUser();
      const schedules = await list('schedules', { userId: user.id });
      const publicBookingUrl = new URL('./booking.html', window.location.href);
      publicBookingUrl.searchParams.set('owner', user.id);
      const weekdayOrder = { lunes: 0, martes: 1, miércoles: 2, miercoles: 2, jueves: 3, viernes: 4, sábado: 5, sabado: 5, domingo: 6 };
      const sortSchedules = (arr) => [...arr].sort((a, b) => {
        const orderA = a.order != null ? a.order : (weekdayOrder[a.dayOfWeek] ?? 99);
        const orderB = b.order != null ? b.order : (weekdayOrder[b.dayOfWeek] ?? 99);
        return orderA - orderB;
      });
      state.schedules = schedules.length ? sortSchedules(schedules) : [{ id: uid(), dayOfWeek:'lunes', startTime:'09:00', endTime:'18:00', isNew:true }];
      state.profile = { salonName: user.salonName || user.name || '', phone: user.phone || '', email: user.email || '', remindersEnabled: !!user.remindersEnabled, avatar: user.avatar || '' };
      const render = () => {
        const profileInitials = (state.profile.salonName || state.profile.email || 'U')
          .split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
        const avatarPreview = state.profile.avatar
          ? `<img src="${escapeHTML(state.profile.avatar)}" alt="Imagen de perfil">`
          : `<span style="font-size:1.1rem;font-weight:800">${escapeHTML(profileInitials)}</span>`;
        root.querySelector('#profile-content').innerHTML = `
          <form id="profile-form" class="card"><div class="card-header"><div class="card-title">Información del negocio</div><div class="card-desc">Actualiza los datos de tu salón o negocio</div></div><div class="card-body form-stack">
            <div class="panel profile-avatar-panel">
              <div class="avatar profile-avatar-preview" style="width:72px;height:72px;flex:0 0 auto">${avatarPreview}</div>
              <div class="profile-avatar-copy">
                <strong>Imagen de perfil</strong>
                <div class="helper">Sube una imagen para usarla en tu cuenta</div>
              </div>
              <div class="profile-avatar-actions">
                <input class="input" type="file" id="profile-avatar-input" accept="image/*" hidden>
                <button class="btn outline" id="change-avatar" type="button">Subir imagen</button>
                ${state.profile.avatar ? '<button class="btn ghost" id="remove-avatar" type="button">Quitar</button>' : ''}
              </div>
            </div>

            <div><label class="label">Nombre del salón</label><input class="input" name="salonName" value="${escapeHTML(state.profile.salonName)}"></div>
            <div><label class="label">Teléfono</label><input class="input" name="phone" value="${escapeHTML(state.profile.phone)}"></div>
            <div><label class="label">Email</label><input class="input" name="email" value="${escapeHTML(state.profile.email)}"></div>
            <div class="panel"><div><strong>Recordatorios por email</strong><div class="helper">Activa o desactiva los recordatorios automáticos</div></div><label class="switch"><input type="checkbox" name="remindersEnabled" ${state.profile.remindersEnabled ? 'checked' : ''}></label></div>
            <div class="toolbar"><button class="btn primary" type="submit">Guardar cambios</button></div>
          </div></form>
          <div class="card" style="margin-top:18px"><div class="card-header"><div class="card-title">Reserva pública</div><div class="card-desc">Comparte este enlace con tus clientes para que vean la disponibilidad real</div></div><div class="card-body form-stack">
            <div class="public-link-box">
              <input class="input public-link" id="public-booking-link" value="${escapeHTML(publicBookingUrl.toString())}" readonly>
              <button class="btn outline" id="copy-public-link" type="button">Copiar enlace</button>
              <a class="btn primary" id="open-public-link" href="${escapeHTML(publicBookingUrl.toString())}" target="_blank" rel="noreferrer">Abrir reserva</a>
            </div>
            <div class="public-note">Si cambias horarios o citas en la agenda, esta página mostrará esos cambios automáticamente.</div>
          </div></div>
          <div class="card" style="margin-top:18px"><div class="card-header"><div class="card-title">Horarios de atención</div><div class="card-desc">Administra tus horarios recurrentes</div></div><div class="card-body">
            <div class="form-stack" id="schedules-list">${profileSchedulesHTML(state.schedules)}</div>
            <div class="toolbar"><button class="btn outline" id="add-schedule" type="button">Agregar horario</button><button class="btn primary" id="save-schedules" type="button">Guardar horarios</button></div>
          </div></div>
          <div class="card" style="margin-top:18px"><div class="card-header"><div class="card-title">Cambiar contraseña</div></div><div class="card-body"><form id="password-form" class="form-grid">
            <div><label class="label">Contraseña actual</label><input class="input" name="oldPassword" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false"></div>
            <div><label class="label">Nueva contraseña</label><input class="input" name="password" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false"></div>
            <div><label class="label">Confirmar contraseña</label><input class="input" name="passwordConfirm" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false"></div>
            <div style="display:flex;align-items:end"><button class="btn primary" type="submit">Actualizar contraseña</button></div>
          </form></div></div>
        `;
      };
      render();

      const syncSchedulesFromDOM = () => {
        root.querySelectorAll('.js-schedule').forEach((card) => {
          const id = card.dataset.id;
          const schedule = state.schedules.find((x) => String(x.id) === String(id));
          if (!schedule) return;
          schedule.dayOfWeek = card.querySelector('[data-field="dayOfWeek"]').value;
          schedule.startTime = card.querySelector('[data-field="startTime"]').value;
          schedule.endTime = card.querySelector('[data-field="endTime"]').value;
        });
      };

      root.querySelector('#profile-content').addEventListener('change', async (e) => {
        if (e.target?.id === 'profile-avatar-input') {
          const file = e.target.files?.[0];
          if (!file) return;
          if (!file.type.startsWith('image/')) {
            notify.error('Selecciona una imagen válida');
            e.target.value = '';
            return;
          }
          try {
            const avatar = await fileToDataUrl(file);
            state.profile.avatar = avatar;
            await updateUserProfile({ avatar });
            render();
            notify.success('Imagen de perfil actualizada');
          } catch (err) {
            console.error(err);
            notify.error('No se pudo cargar la imagen');
          }
          return;
        }

        const scheduleCard = e.target.closest('.js-schedule');
        if (!scheduleCard) return;
        const id = scheduleCard.dataset.id;
        const schedule = state.schedules.find((x) => String(x.id) === String(id));
        if (!schedule) return;
        const field = e.target.dataset.field;
        if (field === 'dayOfWeek' || field === 'startTime' || field === 'endTime') {
          schedule[field] = e.target.value;
        }
      });

      root.querySelector('#profile-content').addEventListener('click', async (e) => {
        const addBtn = e.target.closest('#add-schedule');
        const saveBtn = e.target.closest('#save-schedules');
        const removeBtn = e.target.closest('.js-remove-schedule');
        const copyLinkBtn = e.target.closest('#copy-public-link');
        const changeAvatarBtn = e.target.closest('#change-avatar');
        const removeAvatarBtn = e.target.closest('#remove-avatar');

        if (changeAvatarBtn) {
          root.querySelector('#profile-avatar-input')?.click();
          return;
        }

        if (removeAvatarBtn) {
          try {
            await updateUserProfile({ avatar: '' });
            state.profile.avatar = '';
            render();
            notify.success('Imagen de perfil eliminada');
          } catch {
            notify.error('No se pudo quitar la imagen de perfil');
          }
          return;
        }

        if (addBtn) {
          syncSchedulesFromDOM();
          state.schedules.push({ id: uid(), dayOfWeek:'lunes', startTime:'09:00', endTime:'18:00', isNew:true });
          render();
          return;
        }

        if (saveBtn) {
          syncSchedulesFromDOM();
          try {
            const savedIds = new Set();
            await Promise.all(state.schedules.map(async (s, idx) => {
              const orderVal = weekdayOrder[s.dayOfWeek] ?? idx;
              const payload = { userId:user.id, dayOfWeek:s.dayOfWeek, startTime:s.startTime, endTime:s.endTime, order:orderVal };
              if (s.id && !s.isNew) {
                await update('schedules', s.id, payload);
                savedIds.add(String(s.id));
              } else {
                const created = await create('schedules', payload);
                s.id = created.id;
                s.isNew = false;
                savedIds.add(String(created.id));
              }
            }));
            state.schedules = state.schedules.filter((s) => savedIds.has(String(s.id)));
            notify.success('Horarios guardados');
            render();
          } catch (err) { console.error(err); notify.error('Error al guardar horarios'); }
          return;
        }

        if (removeBtn) {
          syncSchedulesFromDOM();
          const card = removeBtn.closest('.js-schedule');
          const id = card?.dataset.id;
          if (!id) return;
          if (!await confirmDialog('¿Eliminar este horario de forma definitiva?', { title: 'Eliminar horario', confirmText: 'Sí, eliminar' })) return;
          state.schedules = state.schedules.filter((x) => String(x.id) !== String(id));
          if (!String(id).startsWith('temp-')) {
            try { await remove('schedules', id); } catch { /* ignore */ }
          }
          state.schedules = sortSchedules(state.schedules);
          render();
          return;
        }

        if (copyLinkBtn) {
          try {
            await navigator.clipboard.writeText(publicBookingUrl.toString());
            notify.success('Enlace copiado al portapapeles');
          } catch {
            notify.error('No se pudo copiar el enlace');
          }
          return;
        }
      });

      root.querySelector('#profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        try {
          await updateUserProfile({ salonName: fd.get('salonName'), name: fd.get('salonName'), phone: fd.get('phone'), email: fd.get('email'), remindersEnabled: !!fd.get('remindersEnabled'), avatar: state.profile.avatar || '' });
          notify.success('Perfil actualizado correctamente');
        } catch { notify.error('Error al actualizar el perfil'); }
      });

      root.querySelector('#password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (fd.get('password') !== fd.get('passwordConfirm')) return notify.error('Las contraseñas no coinciden');
        if ((fd.get('password') || '').length < 8) return notify.error('La contraseña debe tener al menos 8 caracteres');
        try { await changePassword(fd.get('oldPassword'), fd.get('password')); notify.success('Contraseña actualizada'); e.currentTarget.reset(); }
        catch { notify.error('La contraseña actual es incorrecta o no se pudo cambiar'); }
      });
    }
  };
}
export const pages = {
  login: loginPage,
  signup: signupPage,
  onboarding: onboardingPage,
  home: homePage,
  calendar: calendarPage,
  clients: clientsPage,
  'client-profile': clientProfilePage,
  services: servicesPage,
  reminders: remindersPage,
  finances: financesPage,
  designs: designsPage,
  recommendations: recommendationsPage,
  promotions: promotionsPage,
  growth: growthPage,
  profile: profilePage,
};
