import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebase } from '../firebase';

/**
 * Keys:
 *  - legacy trips: AsyncStorage.getItem('trips')
 *  - legacy currentTrip: profile.currentTrip (Firestore 'tourists/{uid}')
 *  - migration marker: 'tripMigrationDone:<uid>'
 */

const MIGRATION_FLAG = (uid) => `tripMigrationDone:${uid}`;

function normalizeLegacyAsyncTrip(t) {
  if (!t) return null;
  return {
    tripName: (t.to?.description || t.waypoints?.find(w=>w.type==='to')?.address || 'Trip'),
    startDate: null,
    endDate: null,
    purpose: 'unspecified',
    travelMode: 'unspecified',
    status: 'finished', // treat legacy as finished (no dates)
    autoStatus: 'finished',
    from: t.from ? { lat: t.from.lat, lng: t.from.lng, address: t.from.description || '' } : { lat: 0, lng: 0, address: '' },
    to: t.to ? { lat: t.to.lat, lng: t.to.lng, address: t.to.description || '' } : { lat: 0, lng: 0, address: '' },
    halts: (t.halts || []).filter(Boolean).map(h => ({ lat: h.lat, lng: h.lng, address: h.description || '' })),
    encodedPolyline: t.encodedPolyline || '',
    distanceKm: typeof t.distance === 'number' ? t.distance : null,
    durationMinutes: typeof t.duration === 'number' ? t.duration : null,
    notes: '',
    checklist: {},
    budget: {},
    emergencyContacts: [],
    shareLiveLocation: false,
    createdAt: new Date(t.createdAt || Date.now()),
    updatedAt: new Date(),
    archived: false
  };
}

function normalizeLegacyProfileTrip(ct) {
  if (!ct) return null;
  return {
    tripName: ct.name || 'Trip',
    startDate: ct.startDate || null,
    endDate: ct.endDate || null,
    purpose: 'unspecified',
    travelMode: 'unspecified',
    status: 'planned',
    autoStatus: 'planned',
    from: { lat: ct.locations?.[0]?.lat || 0, lng: ct.locations?.[0]?.lng || 0, address: ct.locations?.[0]?.address || (ct.locations?.[0]?.name || '') },
    to: { lat: ct.locations?.slice(-1)?.[0]?.lat || 0, lng: ct.locations?.slice(-1)?.[0]?.lng || 0, address: ct.locations?.slice(-1)?.[0]?.address || (ct.locations?.slice(-1)?.[0]?.name || '') },
    halts: (ct.locations || []).slice(1, -1).map(l => ({ lat: l.lat || 0, lng: l.lng || 0, address: l.address || l.name || '' })),
    encodedPolyline: '',
    distanceKm: null,
    durationMinutes: null,
    notes: '',
    checklist: {},
    budget: {},
    emergencyContacts: [],
    shareLiveLocation: false,
    createdAt: new Date(ct.createdAt || Date.now()),
    updatedAt: new Date(),
    archived: false
  };
}

function deriveAutoStatus(doc) {
  if (!doc.startDate || !doc.endDate) return doc.status;
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const s = new Date(doc.startDate); s.setHours(0,0,0,0);
    const e = new Date(doc.endDate); e.setHours(0,0,0,0);
    if (today < s) return 'planned';
    if (today > e) return doc.status === 'cancelled' ? 'cancelled' : 'finished';
    return 'active';
  } catch {
    return doc.status;
  }
}

export async function runTripMigrationIfNeeded(uid, profileDoc) {
  if (!uid) return;
  const flagKey = MIGRATION_FLAG(uid);
  const already = await AsyncStorage.getItem(flagKey);
  if (already) return; // migration done

  const db = firebase.firestore();
  const tripColl = db.collection('tourists').doc(uid).collection('trips');
  const batch = db.batch();

  // 1. Migrate legacy AsyncStorage trips (history)
  try {
    const raw = await AsyncStorage.getItem('trips');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.slice(0, 50).forEach(legacy => {
          const norm = normalizeLegacyAsyncTrip(legacy);
            if (!norm) return;
          const ref = tripColl.doc();
          norm.status = norm.status || 'finished';
          norm.autoStatus = deriveAutoStatus(norm);
          norm.createdAt = firebase.firestore.Timestamp.fromDate(norm.createdAt);
          norm.updatedAt = firebase.firestore.Timestamp.fromDate(norm.updatedAt);
          batch.set(ref, norm);
        });
      }
    }
  } catch (e) {
    console.log('[TripMigration] AsyncStorage trips parse failed:', e?.message);
  }

  let newCurrentTripId = null;

  // 2. Migrate legacy profile.currentTrip
  try {
    const ct = profileDoc?.currentTrip;
    if (ct) {
      const norm = normalizeLegacyProfileTrip(ct);
      if (norm) {
        norm.autoStatus = deriveAutoStatus(norm);
        norm.createdAt = firebase.firestore.Timestamp.fromDate(norm.createdAt);
        norm.updatedAt = firebase.firestore.Timestamp.fromDate(norm.updatedAt);
        const ref = tripColl.doc();
        batch.set(ref, norm);
        newCurrentTripId = ref.id;
      }
    }
  } catch (e) {
    console.log('[TripMigration] currentTrip migration failed:', e?.message);
  }

  // 3. Commit batch
  try {
    await batch.commit();
  } catch (e) {
    console.log('[TripMigration] batch commit error:', e?.message);
  }

  // 4. Update tourist profile pointer (if any new currentTripId)
  if (newCurrentTripId) {
    try {
      await db.collection('tourists').doc(uid).update({
        currentTripId: newCurrentTripId,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.log('[TripMigration] set currentTripId failed:', e?.message);
    }
  }

  // 5. Flag completion
  await AsyncStorage.setItem(flagKey, '1');
  console.log('[TripMigration] Complete.');
}