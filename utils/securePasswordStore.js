import * as SecureStore from 'expo-secure-store';

const KEY_PREFIX = 'REMEMBER_PWD__'; // double underscore for clarity
const DEBUG = false;

/**
 * Normalize email (trim + lowercase). Returns '' if falsy.
 */
function normalizeEmail(email) {
  if (!email) return '';
  return email.trim().toLowerCase();
}

/**
 * Sanitize to allowed SecureStore key characters:
 * Allowed: a-z 0-9 . _ -
 * We already lowered the case, so we only keep lowercase letters.
 *
 * NOTE: This can create collisions if two emails differ ONLY by disallowed chars
 * in the same positions. For normal emails that’s extremely unlikely.
 *
 * If you want a collision-proof method, use a SHA-256 hash (see commented code).
 */
function sanitizeForKey(normalizedEmail) {
  return normalizedEmail.replace(/[^a-z0-9._-]/g, '_');
}

/**
 * Build the final SecureStore key.
 * (Hash-based alternative shown in comments)
 */
function keyForEmail(rawEmail) {
  const norm = normalizeEmail(rawEmail);
  if (!norm) return null;
  const sanitized = sanitizeForKey(norm);
  return KEY_PREFIX + sanitized;
}

/* ---------------- Hash-based Alternative (optional) ----------------
   Uncomment and use this instead of sanitizeForKey + keyForEmail
   if you prefer a non-reversible key and guaranteed uniqueness.

import * as Crypto from 'expo-crypto';
async function keyForEmailHashed(rawEmail) {
  const norm = normalizeEmail(rawEmail);
  if (!norm) return null;
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    norm
  );
  return KEY_PREFIX + digest; // 64 hex chars
}
--------------------------------------------------------------------- */

/**
 * Save password (overwrites existing).
 */
export async function savePasswordForEmail(email, password) {
  const key = keyForEmail(email);
  if (!key) return;
  if (DEBUG) console.log('[securePasswordStore] save key:', key);
  try {
    await SecureStore.setItemAsync(key, password, {
      keychainService: key,
      accessible: SecureStore.AFTER_FIRST_UNLOCK
    });
  } catch (e) {
    console.warn('[securePasswordStore] save failed', e);
  }
}

/**
 * Retrieve password (returns string or null).
 */
export async function getPasswordForEmail(email) {
  const key = keyForEmail(email);
  if (!key) return null;
  try {
    const val = await SecureStore.getItemAsync(key);
    if (DEBUG) console.log('[securePasswordStore] read key:', key, 'found:', !!val);
    return val;
  } catch (e) {
    console.warn('[securePasswordStore] read failed', e);
    return null;
  }
}

/**
 * Delete password for email.
 */
export async function deletePasswordForEmail(email) {
  const key = keyForEmail(email);
  if (!key) return;
  try {
    await SecureStore.deleteItemAsync(key);
    if (DEBUG) console.log('[securePasswordStore] deleted key:', key);
  } catch (e) {
    console.warn('[securePasswordStore] delete failed', e);
  }
}

/**
 * Check existence (boolean).
 */
export async function hasSavedPassword(email) {
  return !!(await getPasswordForEmail(email));
}