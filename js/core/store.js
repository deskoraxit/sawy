
// --- Spanish forced description (100% always ES) ---
function __getESDescription(photo, query){
  try{
    const base = query || "manicura";
    return `Imagen de ${base} con manos y uñas cuidadas`;
  }catch(e){
    return "Imagen de manicura";
  }
}

import { getFirebase } from './firebase.js';
import { uid } from './dom.js';

const KEY = 'nailflow.mockdb.v1';
const SESSION = 'nailflow.mocksession.v1';
const CLEANUP_FLAG = 'nailflow.catalog.cleanup.v1';

const DEFAULT_STATE = {
  users: [],
  clients: [],
  services: [],
  appointments: [],
  schedules: [],
  designs: [],
  promotions: [],
  transactions: [],
  favoriteDesigns: [],
};

function loadMock() {
  let db;
  try {
    db = JSON.parse(localStorage.getItem(KEY)) || structuredClone(DEFAULT_STATE);
  } catch {
    db = structuredClone(DEFAULT_STATE);
  }

  if (!localStorage.getItem(CLEANUP_FLAG)) {
    db.designs = [];
    db.favoriteDesigns = [];
    localStorage.setItem(CLEANUP_FLAG, '1');
    saveMock(db);
  }

  return db;
}

function saveMock(db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

function mockCurrent() {
  try {
    return JSON.parse(localStorage.getItem(SESSION)) || null;
  } catch {
    return null;
  }
}

function setMockCurrent(user) {
  if (!user) localStorage.removeItem(SESSION);
  else localStorage.setItem(SESSION, JSON.stringify(user));
}

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

function toISOString(value) {
  return value || new Date().toISOString();
}

export function hasFirebase() {
  return getFirebase().firebaseReady;
}

export async function list(entity, { userId = null } = {}) {
  const { db, firebaseReady } = getFirebase();

  if (firebaseReady) {
    const { collection, getDocs } = await import(
      'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
    );

    const snap = await getDocs(collection(db, entity));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return userId ? rows.filter((x) => x.userId === userId) : rows;
  }

  const dbx = loadMock();
  const rows = clone(dbx[entity] || []);
  return userId ? rows.filter((x) => x.userId === userId) : rows;
}

export async function get(entity, id) {
  const { db, firebaseReady } = getFirebase();

  if (firebaseReady) {
    const { doc, getDoc } = await import(
      'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
    );

    const snap = await getDoc(doc(db, entity, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  const dbx = loadMock();
  return clone((dbx[entity] || []).find((x) => x.id === id) || null);
}

export async function create(entity, data) {
  const { db, firebaseReady } = getFirebase();
  const payload = { ...clone(data) };

  if (firebaseReady) {
    const {
      collection,
      doc,
      setDoc,
      addDoc,
    } = await import(
      'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
    );

    // Siempre guardamos fechas como ISO para evitar problemas de serialización.
    if (!payload.createdAt) payload.createdAt = toISOString();

    // IMPORTANTÍSIMO:
    // - Si el objeto trae id, o si la colección es users, usamos ese id como documento.
    // - Esto permite que users/{uid} exista y get('users', uid) funcione bien.
    if (entity === 'users' || payload.id) {
      const docId = payload.id || uid();
      payload.id = docId;
      await setDoc(doc(db, entity, docId), payload, { merge: true });
      return clone(payload);
    }

    const ref = await addDoc(collection(db, entity), payload);
    return { id: ref.id, ...clone(payload) };
  }

  const dbx = loadMock();
  const row = {
    id: payload.id || uid(),
    ...payload,
    createdAt: payload.createdAt || new Date().toISOString(),
  };

  (dbx[entity] ||= []).push(row);
  saveMock(dbx);
  return clone(row);
}

export async function update(entity, id, data) {
  const { db, firebaseReady } = getFirebase();

  if (firebaseReady) {
    const { doc, updateDoc } = await import(
      'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
    );

    await updateDoc(doc(db, entity, id), clone(data));
    return { id, ...clone(data) };
  }

  const dbx = loadMock();
  const rows = dbx[entity] || [];
  const index = rows.findIndex((x) => x.id === id);

  if (index >= 0) {
    rows[index] = {
      ...rows[index],
      ...clone(data),
      updatedAt: new Date().toISOString(),
    };
  }

  saveMock(dbx);
  return clone(rows[index] || null);
}

export async function remove(entity, id) {
  const { db, firebaseReady } = getFirebase();

  if (firebaseReady) {
    const { doc, deleteDoc } = await import(
      'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
    );

    await deleteDoc(doc(db, entity, id));
    return true;
  }

  const dbx = loadMock();
  dbx[entity] = (dbx[entity] || []).filter((x) => x.id !== id);
  saveMock(dbx);
  return true;
}

export async function subscribe(entity, { userId = null } = {}, callback = () => {}) {
  const { db, firebaseReady } = getFirebase();

  if (firebaseReady) {
    const { collection, query, where, onSnapshot } = await import(
      'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
    );

    let ref = collection(db, entity);
    if (userId) {
      ref = query(ref, where('userId', '==', userId));
    }

    return onSnapshot(ref, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(clone(rows));
    }, (error) => {
      console.error(`Subscription error for ${entity}:`, error);
    });
  }

  const emit = async () => {
    callback(await list(entity, { userId }));
  };

  await emit();

  if (typeof window === 'undefined') return () => {};

  const handler = (event) => {
    if (event.key === KEY || event.key === SESSION) emit();
  };

  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export async function getUserProfile(uidValue) {
  return get('users', uidValue);
}

export async function setUserProfile(uidValue, data) {
  const { db, firebaseReady } = getFirebase();
  const payload = {
    id: uidValue,
    ...clone(data),
  };

  if (firebaseReady) {
    const { doc, setDoc } = await import(
      'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
    );

    // Esto corrige el problema principal:
    // users/{uid} queda alineado con Firebase Auth uid
    await setDoc(doc(db, 'users', uidValue), payload, { merge: true });
    return clone(payload);
  }

  const dbx = loadMock();
  const rows = dbx.users || [];
  const index = rows.findIndex((x) => x.id === uidValue);

  if (index >= 0) {
    rows[index] = { ...rows[index], ...payload };
  } else {
    rows.push(payload);
  }

  dbx.users = rows;
  saveMock(dbx);

  return clone(payload);
}

export function setMockSession(user) {
  setMockCurrent(user);
}

export function getMockSession() {
  return mockCurrent();
}

export function clearMockSession() {
  setMockCurrent(null);
}

export async function seedIfEmpty(userId) {
  const clients = await list('clients', { userId });
  if (clients.length) return;
}