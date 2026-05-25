
// --- Spanish forced description (100% always ES) ---
function __getESDescription(photo, query){
  try{
    const base = query || "manicura";
    return `Imagen de ${base} con manos y uñas cuidadas`;
  }catch(e){
    return "Imagen de manicura";
  }
}

import { initFirebase, getFirebase } from './firebase.js';
import {
  setUserProfile,
  getUserProfile,
  setMockSession,
  getMockSession,
  clearMockSession
} from './store.js';

let authUnsub = null;
let listeners = [];
let currentUser = null;
let authReady = false;
let booting = false;

/* =========================
   HELPERS
========================= */

function emit(user) {
  currentUser = user;
  listeners.forEach((fn) => fn(user));
}

function sanitize(value) {
  return (value || '').trim();
}

/* =========================
   LOAD USER PROFILE
========================= */

async function loadFirebaseAuthUser(user) {
  if (!user) {
    emit(null);
    return null;
  }

  let profile = {};

  try {
    profile = (await getUserProfile(user.uid)) || {};
  } catch (e) {
    console.warn("⚠️ Error cargando perfil:", e);
  }

  const merged = {
    id: user.uid,
    email: user.email || profile.email || '',
    name: profile.name || '',
    salonName: profile.salonName || profile.name || '',
    userType: profile.userType || '',
    phone: profile.phone || '',
    remindersEnabled: !!profile.remindersEnabled,
    onboardingCompleted: !!profile.onboardingCompleted,
    integrations: profile.integrations || {},
    avatar: profile.avatar || '',
  };

  emit(merged);
  return merged;
}

/* =========================
   INIT AUTH (FIXED)
========================= */

export async function initAuth() {
  if (booting) return currentUser;
  booting = true;

  await initFirebase();
  const { auth, firebaseReady } = getFirebase();
  authReady = true;

  if (firebaseReady && auth && !authUnsub) {
    const { onAuthStateChanged } = await import(
      'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
    );

    return new Promise((resolve) => {
      let resolved = false;

      authUnsub = onAuthStateChanged(auth, async (user) => {
        const mergedUser = await loadFirebaseAuthUser(user);

        if (!resolved) {
          resolved = true;
          resolve(mergedUser);
        }
      });
    });
  }

  const mock = getMockSession();
  emit(mock);
  return mock;
}

/* =========================
   LISTENERS
========================= */

export function listen(fn) {
  listeners.push(fn);
  fn(currentUser);
  return () => {
    listeners = listeners.filter((x) => x !== fn);
  };
}

export function getCurrentUser() {
  return currentUser;
}

export function isAuthenticated() {
  return !!currentUser;
}

/* =========================
   SIGNUP (ROBUSTO)
========================= */

export async function signup(email, password, userType) {
  const { auth, firebaseReady } = getFirebase();

  email = sanitize(email);
  password = sanitize(password);

  if (firebaseReady && auth) {
    const {
      createUserWithEmailAndPassword,
      updateProfile
    } = await import(
      'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
    );

    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // 🔥 Guardar perfil (NO rompe flujo)
      try {
        await setUserProfile(cred.user.uid, {
          email,
          userType,
          onboardingCompleted: false,
          integrations: {},
          remindersEnabled: false,
          name: '',
          salonName: '',
          createdAt: new Date().toISOString(),
        });
      } catch (profileError) {
        console.warn("⚠️ Error guardando perfil:", profileError);
      }

      // 🔥 Update displayName
      try {
        await updateProfile(cred.user, {
          displayName: email.split('@')[0],
        });
      } catch (e) {
        console.warn("⚠️ Error en updateProfile:", e);
      }

      return await loadFirebaseAuthUser(cred.user);

    } catch (error) {
      console.error("🔥 SIGNUP ERROR:", error);
      throw error;
    }
  }

  /* =========================
     MOCK MODE
  ========================= */

  const dbUser = {
    id: `mock-${Date.now()}`,
    email,
    userType,
    onboardingCompleted: false,
    integrations: {},
    remindersEnabled: false,
    name: '',
    salonName: ''
  };

  const existing = JSON.parse(
    localStorage.getItem('nailflow.mockauth.users') || '[]'
  );

  if (existing.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    const err = new Error('auth/email-already-in-use');
    err.code = 'auth/email-already-in-use';
    throw err;
  }

  existing.push({ ...dbUser, password });
  localStorage.setItem('nailflow.mockauth.users', JSON.stringify(existing));

  setMockSession(dbUser);
  emit(dbUser);

  return dbUser;
}

/* =========================
   LOGIN (FIXED)
========================= */

export async function login(email, password) {
  const { auth, firebaseReady } = getFirebase();

  email = sanitize(email);
  password = sanitize(password);

  if (firebaseReady && auth) {
    const { signInWithEmailAndPassword } = await import(
      'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
    );

    try {
      const cred = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      return await loadFirebaseAuthUser(cred.user);

    } catch (error) {
      console.error("🔥 LOGIN ERROR:", error);
      throw error;
    }
  }

  /* MOCK */

  const users = JSON.parse(
    localStorage.getItem('nailflow.mockauth.users') || '[]'
  );

  const found = users.find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase() &&
      u.password === password
  );

  if (!found) {
    const err = new Error('auth/wrong-password');
    err.code = 'auth/wrong-password';
    throw err;
  }

  const safe = { ...found };
  delete safe.password;

  setMockSession(safe);
  emit(safe);

  return safe;
}

/* =========================
   LOGOUT
========================= */

export async function logout() {
  const { auth, firebaseReady } = getFirebase();

  if (firebaseReady && auth) {
    const { signOut } = await import(
      'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
    );
    await signOut(auth);
  }

  clearMockSession();
  emit(null);
}

/* =========================
   UPDATE PROFILE
========================= */

export async function updateUserProfile(data) {
  if (!currentUser) throw new Error('No hay sesión');

  const { auth, firebaseReady } = getFirebase();

  if (firebaseReady && auth) {
    await setUserProfile(currentUser.id, data);

    const merged = { ...currentUser, ...data };
    emit(merged);
    return merged;
  }

  const users = JSON.parse(
    localStorage.getItem('nailflow.mockauth.users') || '[]'
  );

  const idx = users.findIndex((u) => u.id === currentUser.id);

  if (idx >= 0) {
    users[idx] = { ...users[idx], ...data };
    localStorage.setItem(
      'nailflow.mockauth.users',
      JSON.stringify(users)
    );
  }

  const merged = { ...currentUser, ...data };

  setMockSession(merged);
  emit(merged);

  return merged;
}

/* =========================
   CHANGE PASSWORD
========================= */

export async function changePassword(oldPassword, newPassword) {
  const { auth, firebaseReady } = getFirebase();

  if (firebaseReady && auth) {
    const {
      EmailAuthProvider,
      reauthenticateWithCredential,
      updatePassword
    } = await import(
      'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
    );

    const user = auth.currentUser;

    if (!user) throw new Error('No user');

    const credential = EmailAuthProvider.credential(
      user.email,
      sanitize(oldPassword)
    );

    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, sanitize(newPassword));

    return true;
  }

  throw new Error('Not supported in mock');
}