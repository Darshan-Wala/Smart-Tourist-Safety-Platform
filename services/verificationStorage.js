// Firestore-backed verification storage using Firebase Compat (matches your firebase.js).
// Path now aligned with security rules: tourists/{uid}/private/verification
//
// Data shape:
// {
//   selectedMethods: ['passport','aadhaar'],
//   passport: { number: string, verified: boolean },
//   aadhaar:  { number: string, verified: boolean },
//   lastUpdated: server timestamp
// }

import { auth, db, firebase } from '../firebase';

const DEFAULT_STATE = {
  selectedMethods: [],
  passport: { number: '', verified: false },
  aadhaar: { number: '', verified: false },
  lastUpdated: null,
};

function requireUser() {
  const u = auth.currentUser;
  if (!u || !u.uid) throw new Error('Not authenticated');
  return u;
}

function docRef(uid) {
  // IMPORTANT: aligned to your rules under "tourists"
  return db.doc(`tourists/${uid}/private/verification`);
}

function serialize(data) {
  if (!data) return { ...DEFAULT_STATE };
  const ts = data.lastUpdated;
  let lastUpdated = null;
  if (ts && typeof ts.toDate === 'function') {
    lastUpdated = ts.toDate().toISOString();
  } else if (typeof ts === 'string') {
    lastUpdated = ts;
  }
  return {
    selectedMethods: Array.isArray(data.selectedMethods) ? data.selectedMethods : [],
    passport: (data.passport && typeof data.passport === 'object')
      ? { number: String(data.passport.number || ''), verified: !!data.passport.verified }
      : { number: '', verified: false },
    aadhaar: (data.aadhaar && typeof data.aadhaar === 'object')
      ? { number: String(data.aadhaar.number || ''), verified: !!data.aadhaar.verified }
      : { number: '', verified: false },
    lastUpdated,
  };
}

async function readState() {
  const u = requireUser();
  const ref = docRef(u.uid);
  const snap = await ref.get();
  if (!snap.exists) return { ...DEFAULT_STATE };
  return serialize(snap.data());
}

async function writeState(partial) {
  const u = requireUser();
  const ref = docRef(u.uid);
  const payload = {
    ...partial,
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
  };
  await ref.set(payload, { merge: true });
  const snap = await ref.get();
  return serialize(snap.data());
}

export async function getVerificationStatus() {
  return readState();
}

export async function saveVerificationStatus(next) {
  return writeState(next || DEFAULT_STATE);
}

export async function setSelectedMethods(methods) {
  const current = await readState();
  const next = { ...current, selectedMethods: Array.isArray(methods) ? methods : [] };
  return writeState(next);
}

export async function setPassportVerification(number, verified) {
  const current = await readState();
  const next = {
    ...current,
    passport: { number: number || '', verified: !!verified },
  };
  return writeState(next);
}

export async function setAadhaarVerification(number, verified) {
  const current = await readState();
  const next = {
    ...current,
    aadhaar: { number: number || '', verified: !!verified },
  };
  return writeState(next);
}

export async function clearPassportVerification() {
  const current = await readState();
  const next = {
    ...current,
    passport: { number: '', verified: false },
  };
  return writeState(next);
}

export async function clearAadhaarVerification() {
  const current = await readState();
  const next = {
    ...current,
    aadhaar: { number: '', verified: false },
  };
  return writeState(next);
}

export async function clearAllVerification() {
  const current = await readState();
  const next = {
    ...current,
    passport: { number: '', verified: false },
    aadhaar: { number: '', verified: false },
  };
  return writeState(next);
}