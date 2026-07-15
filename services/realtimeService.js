/**
 * realtimeService.js (updated)
 * - Removed empty lastLocation / risk on session create (Firestore rule compliance)
 * - Uses concrete firebase.firestore.Timestamp.now()
 * - Exports helpers for TravelTrackingScreen
 */

import { auth, db, firebase, rtdb } from '../firebase';

const rtdbRef = (path) => rtdb.ref(path);

export function makeSessionId(uid) {
  return `${uid}_${Date.now()}`;
}

/**
 * Create a live session document without lastLocation/risk (added later).
 */
export async function createLiveSession({ uid, durationMinutes, contacts, shareUrl }) {
  const sessionId = makeSessionId(uid);
  const startedAtDate = new Date();
  const endsAtDate = new Date(startedAtDate.getTime() + durationMinutes * 60000);

  const sessionDocRef = db.collection('liveTrackingSessions').doc(sessionId);
  const nowTs = firebase.firestore.Timestamp.now();

  const payload = {
    userId: uid,
    startedAt: firebase.firestore.Timestamp.fromDate(startedAtDate),
    endsAt: firebase.firestore.Timestamp.fromDate(endsAtDate),
    active: true,
    durationMinutes,
    contacts: contacts.map(c => ({ phone: c.phone, label: c.label || '' })).slice(0, 5),
    shareUrl,
    // lastLocation omitted until first actual position (rules require lat/lng if present)
    // risk omitted until first update
    createdAt: nowTs,
    updatedAt: nowTs
  };

  await sessionDocRef.set(payload);

  // Optional minimal RTDB mirror
  await rtdbRef(`liveTrackingSessions/${sessionId}`).set({
    userId: uid,
    startedAt: startedAtDate.getTime(),
    endsAt: endsAtDate.getTime(),
    active: true
  });

  return {
    sessionId,
    endsAt: endsAtDate
  };
}

export async function updateLiveSession(sessionId, partial) {
  const ref = db.collection('liveTrackingSessions').doc(sessionId);
  const shaped = {
    ...partial,
    updatedAt: firebase.firestore.Timestamp.now()
  };
  await ref.set(shaped, { merge: true });

  if (partial.active === false) {
    await rtdbRef(`liveTrackingSessions/${sessionId}`).update({
      active: false,
      endedAt: Date.now()
    });
  } else if (partial.lastLocation) {
    await rtdbRef(`liveTrackingSessions/${sessionId}`).update({
      lastLocation: {
        lat: partial.lastLocation.lat,
        lng: partial.lastLocation.lng,
        updatedAt: partial.lastLocation.updatedAt
      }
    });
  }
}

export async function endLiveSession(sessionId) {
  await updateLiveSession(sessionId, { active: false, endedAt: Date.now() });
}

export async function writeLiveLocation(uid, data) {
  if (!uid) return;
  await rtdbRef(`liveLocations/${uid}`).update({
    ...data,
    updatedAt: Date.now()
  });
}

export function throttle(fn, ms) {
  let last = 0;
  let pending = null;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    } else {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        last = Date.now();
        fn(...args);
      }, ms - (now - last));
    }
  };
}