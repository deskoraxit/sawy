const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PINTEREST_BRIDGE_PORT || 8787);
const DEBUG_PORT = Number(process.env.PINTEREST_DEBUG_PORT || 9223);
const HOST = '127.0.0.1';
const PROFILE_DIR = process.env.PINTEREST_PROFILE_DIR || path.resolve(__dirname, '..', '.pinterest-profile');
const PINTEREST_HOME = 'https://co.pinterest.com/';
const HEADLESS = !['0', 'false', 'no'].includes(String(process.env.PINTEREST_HEADLESS || '1').toLowerCase());

let browserProcess = null;
let cdpClient = null;
let sessionValid = true;
let lastSessionCheck = 0;
let shuttingDown = false;
let browserWatchdog = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function logSessionExpired() {
  const ts = new Date().toLocaleString('es-CO');
  console.error(`[${ts}] ⚠ SESIÓN DE PINTEREST EXPIRADA`);
  console.error(`[${ts}] ⚠ Ejecuta "start-pinterest-login.bat" para iniciar sesión de nuevo.`);
}

function logSessionOk() {
  const ts = new Date().toLocaleString('es-CO');
  console.log(`[${ts}] Sesión de Pinterest verificada - OK`);
}

function findBrowserPath() {
  const candidates = [
    process.env.PINTEREST_CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function waitForDebugger() {
  const versionUrl = `http://${HOST}:${DEBUG_PORT}/json/version`;
  for (let i = 0; i < 40; i += 1) {
    try {
      return await fetchJson(versionUrl);
    } catch {
      await sleep(250);
    }
  }
  throw new Error('No se pudo conectar con Chrome/Edge en modo remoto.');
}

async function ensureBrowser() {
  try {
    return await waitForDebugger();
  } catch {
    const browserPath = findBrowserPath();
    if (!browserPath) throw new Error('No encontré Chrome ni Edge instalado.');

    fs.mkdirSync(PROFILE_DIR, { recursive: true });
    const browserArgs = [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-popup-blocking',
      '--window-size=1600,1200',
      ...(HEADLESS ? ['--headless=new', '--disable-gpu', '--hide-scrollbars'] : []),
      PINTEREST_HOME,
    ];

    browserProcess = spawn(browserPath, browserArgs, {
      detached: false,
      stdio: 'ignore',
    });

    browserProcess.on('exit', (code, signal) => {
      if (shuttingDown) return;
      const ts = new Date().toLocaleString('es-CO');
      console.error(`[${ts}] ⚠ Chrome/Edge se cerró inesperadamente (código: ${code}, señal: ${signal})`);
      console.error(`[${ts}] ⚠ Reintentando en 3 segundos...`);
      cdpClient = null;
      setTimeout(() => {
        if (!shuttingDown) {
          browserProcess = null;
          ensureBrowser().catch(() => {});
        }
      }, 3000);
    });

    browserProcess.unref();
    return waitForDebugger();
  }
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.ws = null;
  }

  async connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout conectando CDP.')), 10000);
      this.ws.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      this.ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Error conectando CDP.'));
      };
    });

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message || 'Error CDP.'));
      else resolve(message);
    };
  }

  async send(method, params = {}, sessionId = '') {
    await this.connect();
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout CDP: ${method}`));
      }, 30000);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });
  }
}

async function getCDPClient() {
  const version = await ensureBrowser();
  if (!cdpClient || cdpClient.wsUrl !== version.webSocketDebuggerUrl) {
    cdpClient = new CDPClient(version.webSocketDebuggerUrl);
    await cdpClient.connect();
  }
  return cdpClient;
}

function pinterestSearchUrl(query) {
  return `https://co.pinterest.com/search/pins/?q=${encodeURIComponent(query)}&rs=typed`;
}

async function openPinterestLogin() {
  const cdp = await getCDPClient();
  await cdp.send('Target.createTarget', { url: PINTEREST_HOME });
}

async function checkSessionStatus() {
  const cdp = await getCDPClient();
  const created = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const targetId = created.result.targetId;
  const attached = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const sessionId = attached.result.sessionId;

  try {
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.navigate', { url: PINTEREST_HOME }, sessionId);
    await sleep(5000);

    const expression = `
      (() => {
        const href = location.href;
        const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
        return href.includes('/login') || href.includes('/signup') || bodyText.includes('inicia sesión') || bodyText.includes('log in');
      })()
    `;

    const evaluated = await cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise: false,
      returnByValue: true,
    }, sessionId);

    const loginRequired = evaluated.result.result.value === true;
    sessionValid = !loginRequired;
    lastSessionCheck = Date.now();

    if (loginRequired) logSessionExpired();
    else logSessionOk();

    return !loginRequired;
  } finally {
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
  }
}

async function tryRefreshSession() {
  const cdp = await getCDPClient();
  const created = await cdp.send('Target.createTarget', { url: PINTEREST_HOME });
  const targetId = created.result.targetId;
  const attached = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const sessionId = attached.result.sessionId;

  try {
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.navigate', { url: PINTEREST_HOME }, sessionId);
    await sleep(8000);

    const expression = `
      (() => {
        const href = location.href;
        const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
        return href.includes('/login') || href.includes('/signup') || bodyText.includes('inicia sesión') || bodyText.includes('log in');
      })()
    `;

    const evaluated = await cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise: false,
      returnByValue: true,
    }, sessionId);

    sessionValid = !evaluated.result.result.value;
    if (!sessionValid) logSessionExpired();
    else logSessionOk();
    return sessionValid;
  } finally {
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
  }
}

async function scrapePinterest(query, attempt = 1) {
  const cdp = await getCDPClient();
  const searchUrl = pinterestSearchUrl(query);
  const created = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const targetId = created.result.targetId;
  const attached = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const sessionId = attached.result.sessionId;

  try {
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.navigate', { url: searchUrl }, sessionId);
    await sleep(6500);

    const expression = `
      (async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        for (let i = 0; i < 5; i += 1) {
          window.scrollBy(0, Math.max(700, window.innerHeight * 0.85));
          await wait(900);
        }

        const href = location.href;
        const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
        const loginRequired = href.includes('/login') || href.includes('/signup') || bodyText.includes('inicia sesión') || bodyText.includes('log in');

        const cards = [...document.querySelectorAll('img')]
          .map((img) => {
            const src = img.currentSrc || img.src || '';
            const normalized = src.replace(/\\/\\d+x\\//, '/736x/');
            const link = img.closest('a');
            const rect = img.getBoundingClientRect();
            return {
              image: normalized,
              title: img.alt || img.getAttribute('aria-label') || 'Referencia Pinterest',
              url: link?.href || href,
              width: img.naturalWidth || Math.round(rect.width),
              height: img.naturalHeight || Math.round(rect.height),
            };
          })
          .filter((item) => item.image.includes('pinimg.com'))
          .filter((item) => item.width >= 160 && item.height >= 160)
          .filter((item) => !item.image.includes('/avatars/') && !item.image.includes('/75x75/'));

        const seen = new Set();
        const items = [];
        for (const card of cards) {
          const key = card.image.split('?')[0];
          if (seen.has(key)) continue;
          seen.add(key);
          items.push(card);
          if (items.length >= 18) break;
        }

        return { loginRequired, url: href, items };
      })()
    `;

    const evaluated = await cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId);

    const result = evaluated.result.result.value || { loginRequired: false, items: [] };

    if (result.loginRequired && attempt < 2) {
      sessionValid = false;
      logSessionExpired();
      const refreshed = await tryRefreshSession();
      if (refreshed) return scrapePinterest(query, 2);
      return { loginRequired: true, items: [], sessionExpired: true, message: 'Sesión de Pinterest expirada. Ejecuta start-pinterest-login.bat para renovarla.' };
    }

    if (!result.loginRequired && !sessionValid) {
      sessionValid = true;
      logSessionOk();
    }

    return result;
  } finally {
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, status, html) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(html);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });

  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    if (url.pathname === '/health') {
      await ensureBrowser();
      return sendJson(res, 200, { ok: true, profileDir: PROFILE_DIR, debugPort: DEBUG_PORT, headless: HEADLESS });
    }

    if (url.pathname === '/login') {
      if (HEADLESS) {
        return sendHtml(res, 200, `
          <!doctype html>
          <html lang="es">
            <head><meta charset="utf-8"><title>Login Pinterest</title></head>
            <body style="font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;line-height:1.5">
              <h1>Login de Pinterest</h1>
              <p>El puente esta corriendo en modo oculto para no abrir Chrome al usuario.</p>
              <p>Para iniciar sesion una sola vez, ejecuta <strong>start-pinterest-login.bat</strong> desde la carpeta del proyecto.</p>
              <p>Despues de iniciar sesion, cierra esa ventana visible y vuelve a ejecutar <strong>start-pinterest-bridge.bat</strong>.</p>
              <p>Perfil persistente: <code>${PROFILE_DIR}</code></p>
            </body>
          </html>
        `);
      }
      await openPinterestLogin();
      return sendHtml(res, 200, `
        <!doctype html>
        <html lang="es">
          <head><meta charset="utf-8"><title>Login Pinterest</title></head>
          <body style="font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;line-height:1.5">
            <h1>Pinterest abierto</h1>
            <p>Inicia sesion en la ventana visible de Chrome/Edge. Esa sesion queda guardada en el perfil persistente.</p>
          </body>
        </html>
      `);
    }

    if (url.pathname === '/session-status') {
      const status = sessionValid ? 'ok' : 'expired';
      const needsCheck = (Date.now() - lastSessionCheck) > 60000;
      return sendJson(res, 200, {
        ok: true,
        sessionValid,
        status,
        lastCheck: lastSessionCheck || null,
        needsCheck,
        message: sessionValid ? 'Sesión activa' : 'Sesión expirada - ejecuta start-pinterest-login.bat',
      });
    }

    if (url.pathname === '/refresh-session') {
      const refreshed = await tryRefreshSession();
      return sendJson(res, 200, { ok: true, sessionValid: refreshed });
    }

    if (url.pathname === '/shutdown') {
      sendJson(res, 200, { ok: true, message: 'Cerrando Pinterest bridge.' });
      shutdown('/shutdown');
      return;
    }

    if (url.pathname === '/search') {
      const query = String(url.searchParams.get('q') || '').trim();
      if (!query) return sendJson(res, 400, { ok: false, error: 'Falta q.' });
      const result = await scrapePinterest(query);
      return sendJson(res, 200, { ok: true, query, ...result });
    }

    return sendJson(res, 404, { ok: false, error: 'Ruta no encontrada.' });
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message || 'Error inesperado.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Pinterest bridge activo en http://${HOST}:${PORT}`);
  console.log(`Perfil persistente: ${PROFILE_DIR}`);
  console.log(`Modo navegador: ${HEADLESS ? 'oculto/headless' : 'visible para login'}`);
  console.log('Endpoints:');
  console.log('  GET /health          - Estado del puente');
  console.log('  GET /session-status  - Verificar si la sesión de Pinterest está activa');
  console.log('  GET /search?q=...    - Buscar en Pinterest');
  console.log('  GET /refresh-session - Intentar renovar sesión automáticamente');
  console.log('  GET /login           - Abrir Pinterest en modo visible');
  console.log('  GET /shutdown        - Cerrar el puente');
  console.log('Para iniciar sesion visualmente usa start-pinterest-login.bat.');

  if (HEADLESS) {
    setTimeout(() => checkSessionStatus(), 3000);
  }

  browserWatchdog = setInterval(() => {
    if (shuttingDown) return;
    if (!browserProcess || browserProcess.killed) {
      const ts = new Date().toLocaleString('es-CO');
      console.log(`[${ts}] Watchdog: Chrome no está corriendo, reiniciando...`);
      cdpClient = null;
      browserProcess = null;
      ensureBrowser().catch(() => {});
    }
  }, 30000);
});

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  const ts = new Date().toLocaleString('es-CO');
  console.log(`[${ts}] Cerrando SAWY Pinterest Bridge (${signal})...`);
  if (browserWatchdog) clearInterval(browserWatchdog);
  if (browserProcess && !browserProcess.killed) {
    try { browserProcess.kill(); } catch {}
  }
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('exit', () => { shuttingDown = true; });
