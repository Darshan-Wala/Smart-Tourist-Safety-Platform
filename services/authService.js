/**
 * authService.js
 *
 * Updated for unified Trip Planner:
 *  - Ensures collection = "tourists"
 *  - Adds avatarUrl & currentTripId support (allowed mutable fields)
 *  - Adds fetchProfile() helper used by AuthContext
 *  - Uses serverTimestamp() for createdAt / updatedAt
 *  - Keeps digital ID generation logic
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as fbUpdateProfile,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';

import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import { generateDigitalID } from '../utils/digitalID';
import { APP_CONSTANTS } from '../config/constants';

/* ---------------- Error Mapping ---------------- */
function mapError(e) {
  if (!e) return 'Unknown error';
  if (e.code) {
    switch (e.code) {
      case 'auth/email-already-in-use': return 'Email already registered.';
      case 'auth/invalid-email': return 'Invalid email address.';
      case 'auth/weak-password': return 'Password is too weak.';
      case 'auth/network-request-failed': return 'Network error. Check your connection.';
      case 'auth/wrong-password': return 'Incorrect password.';
      case 'auth/user-not-found': return 'No user found with those credentials.';
      case 'auth/too-many-requests': return 'Too many attempts. Try later.';
      case 'auth/requires-recent-login': return 'Please reauthenticate and try again.';
      default: return e.message || e.code;
    }
  }
  return e.message || 'Unexpected error';
}

/* ---------------- Auth Service Class ---------------- */
class AuthService {

  listenAuth(callback) {
    return auth.onAuthStateChanged(callback);
  }

  /**
   * Helper: fetch a profile doc (safe) by UID.
   */
  async fetchProfile(uid) {
    const touristsColl = APP_CONSTANTS.COLLECTIONS.TOURISTS || 'tourists';
    const ref = doc(db, touristsColl, uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  }

  /**
   * REGISTER
   * Creates Firebase Auth user + Firestore profile doc with immutable digital ID fields.
   */
  async register({
    fullName,
    email,
    password,
    phoneNumber,
    nationality,
    passportNumber = '',
    emergencyContact = '',
    emergencyPhone = ''
  }) {
    const timeline = [];
    const stamp = (label) => timeline.push({ label, t: Date.now() });

    try {
      stamp('start');

      const credential = await createUserWithEmailAndPassword(auth, email, password);
      stamp('createdUser');

      try {
        await fbUpdateProfile(credential.user, { displayName: fullName });
        stamp('updatedDisplayName');
      } catch (e) {
        console.warn('[AuthService.register] updateProfile failed', e);
      }

      let digital;
      try {
        digital = await generateDigitalID(credential.user.uid, fullName, nationality);
        stamp('digitalIDGenerated');
      } catch (e) {
        console.warn('[AuthService.register] digital ID generation failed -> fallback', e);
        digital = {
          id: `FALLBACK-${Date.now().toString(36).toUpperCase()}`,
            hash: 'FALLBACK',
          validUntil: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString()
        };
      }

      const touristsColl = APP_CONSTANTS.COLLECTIONS.TOURISTS || 'tourists';
      const userDocRef = doc(db, touristsColl, credential.user.uid);

      const nowISO = new Date().toISOString();
      const profileDoc = {
        uid: credential.user.uid,
        fullName,
        email,
        phoneNumber: phoneNumber || '',
        nationality: nationality || '',
        passportNumber: passportNumber || '',
        emergencyContact: emergencyContact || '',
        emergencyPhone: emergencyPhone || '',
        digitalTouristID: digital.id,
        digitalIDHash: digital.hash,
        digitalIDValidUntil: digital.validUntil,
        registrationDate: nowISO,
        lastLoginDate: nowISO,
        isActive: true,
        avatarUrl: '',          // NEW (default empty)
        currentTripId: null,    // NEW
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      try {
        await setDoc(userDocRef, profileDoc, { merge: false });
        stamp('profileWritten');
      } catch (e) {
        console.warn('[AuthService.register] Firestore write failed', e);
        throw new Error(mapError(e));
      }

      stamp('end');

      return {
        user: credential.user,
        profile: profileDoc,
        meta: { timeline }
      };
    } catch (e) {
      console.warn('[AuthService.register] FATAL', e);
      throw new Error(mapError(e));
    }
  }

  /**
   * LOGIN
   * Updates lastLoginDate & updatedAt (serverTimestamp).
   */
  async login(email, password) {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);

      const touristsColl = APP_CONSTANTS.COLLECTIONS.TOURISTS || 'tourists';
      const userDocRef = doc(db, touristsColl, credential.user.uid);

      try {
        await updateDoc(userDocRef, {
          lastLoginDate: new Date().toISOString(),
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.warn('[AuthService.login] Failed to update lastLoginDate', e);
      }

      let profileData = null;
      try {
        const snap = await getDoc(userDocRef);
        if (snap.exists()) profileData = snap.data();
      } catch (e) {
        console.warn('[AuthService.login] Fetch profile failed', e);
      }

      return { user: credential.user, profile: profileData };
    } catch (e) {
      throw new Error(mapError(e));
    }
  }

  async logout() {
    await signOut(auth);
  }

  /**
   * REAUTHENTICATE
   */
  async reauthenticate(password) {
    if (!auth.currentUser?.email) throw new Error('No active user');
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, password);
      await reauthenticateWithCredential(auth.currentUser, cred);
      return true;
    } catch (e) {
      throw new Error(mapError(e));
    }
  }

  /**
   * FETCH SECURE DIGITAL ID (only the locked fields)
   */
  async fetchSecureDigitalID(uid) {
    const touristsColl = APP_CONSTANTS.COLLECTIONS.TOURISTS || 'tourists';
    const userDocRef = doc(db, touristsColl, uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) throw new Error('Profile not found');
    const data = snap.data();
    return {
      digitalTouristID: data.digitalTouristID,
      digitalIDHash: data.digitalIDHash,
      digitalIDValidUntil: data.digitalIDValidUntil
    };
  }

  /**
   * UPDATE PROFILE
   * Extends allowed fields to include avatarUrl & currentTripId (for unified trip planner).
   * currentTripId is optional and can be reset to null.
   */
  async updateProfile(partial) {
    if (!auth.currentUser?.uid) throw new Error('Not authenticated');

    const allowed = [
      'fullName',
      'phoneNumber',
      'nationality',
      'passportNumber',
      'emergencyContact',
      'emergencyPhone',
      'avatarUrl',        // NEW
      'currentTripId'     // NEW
    ];

    const update = {};
    allowed.forEach(k => {
      if (Object.prototype.hasOwnProperty.call(partial, k)) {
        update[k] = partial[k];
      }
    });

    if (Object.keys(update).length === 0) {
      throw new Error('No valid fields to update');
    }

    // Optional light validation
    if ('currentTripId' in update && update.currentTripId !== null && typeof update.currentTripId !== 'string') {
      throw new Error('currentTripId must be a string or null');
    }
    if ('avatarUrl' in update && update.avatarUrl && typeof update.avatarUrl !== 'string') {
      throw new Error('avatarUrl must be a string');
    }

    if (update.fullName) {
      try {
        await fbUpdateProfile(auth.currentUser, { displayName: update.fullName });
      } catch (e) {
        console.warn('[AuthService.updateProfile] displayName update failed', e);
      }
    }

    update.updatedAt = serverTimestamp();

    const touristsColl = APP_CONSTANTS.COLLECTIONS.TOURISTS || 'tourists';
    const userDocRef = doc(db, touristsColl, auth.currentUser.uid);

    try {
      await updateDoc(userDocRef, update);
    } catch (e) {
      console.warn('[AuthService.updateProfile] Firestore update failed', e);
      throw new Error(mapError(e));
    }

    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    } catch (e) {
      console.warn('[AuthService.updateProfile] fetch fresh failed', e);
      return null;
    }
  }

  /**
   * CHANGE PASSWORD
   */
  async changePassword(currentPwd, newPwd) {
    if (!auth.currentUser) throw new Error('No authenticated user');
    try {
      await this.reauthenticate(currentPwd);
      await updatePassword(auth.currentUser, newPwd);
      return true;
    } catch (e) {
      throw new Error(mapError(e));
    }
  }

  /**
   * RESET PASSWORD
   */
  async resetPassword(email) {
    if (!email) throw new Error('Email required');
    try {
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (e) {
      throw new Error(mapError(e));
    }
  }
}

export default new AuthService();