
// --- Spanish forced description (100% always ES) ---
function __getESDescription(photo, query){
  try{
    const base = query || "manicura";
    return `Imagen de ${base} con manos y uñas cuidadas`;
  }catch(e){
    return "Imagen de manicura";
  }
}

import { APP_CONFIG, firebaseConfigured } from '../config.js';

const CDN = 'https://www.gstatic.com/firebasejs/10.12.5';

let firebaseApp = null;
let auth = null;
let db = null;
let storage = null;
let firebaseReady = false;

let initialized = false; // 🔥 CLAVE

async function loadFirebaseModules() {
  const [appMod, authMod, dbMod, storageMod] = await Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-auth.js`),
    import(`${CDN}/firebase-firestore.js`),
    import(`${CDN}/firebase-storage.js`),
  ]);

  return { appMod, authMod, dbMod, storageMod };
}

export async function initFirebase() {
  // 🔥 EVITA RE-INICIALIZAR
  if (initialized) {
    return { firebaseApp, auth, db, storage, firebaseReady };
  }

  if (!firebaseConfigured()) {
    firebaseReady = false;
    return { firebaseApp, auth, db, storage, firebaseReady };
  }

  try {
    const { appMod, authMod, dbMod, storageMod } = await loadFirebaseModules();

    // 🔥 IMPORTANTE: usar getApps()
    if (!appMod.getApps().length) {
      firebaseApp = appMod.initializeApp(APP_CONFIG.firebase);
    } else {
      firebaseApp = appMod.getApp();
    }

    auth = authMod.getAuth(firebaseApp);
    db = dbMod.getFirestore(firebaseApp);
    storage = storageMod.getStorage(firebaseApp);

    firebaseReady = true;
    initialized = true;

    return { firebaseApp, auth, db, storage, firebaseReady };

  } catch (error) {
    console.error("🔥 FIREBASE INIT ERROR:", error);
    firebaseReady = false;
    return { firebaseApp, auth, db, storage, firebaseReady };
  }
}

export function getFirebase() {
  return { firebaseApp, auth, db, storage, firebaseReady };
}

export { APP_CONFIG };