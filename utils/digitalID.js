import * as Random from 'expo-random';

// Configurable validity (days)
const VALIDITY_DAYS = 180;

// Helper: safe initials extraction
function getInitials(fullName = '') {
  const letters = (fullName.match(/\b\w/g) || []).slice(0, 2);
  return letters.join('').toUpperCase().padEnd(2, 'X');
}

// Helper: safe country code-ish part
function getCountryPart(nationality = '') {
  return nationality.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
}

// Generate a random hex string of n bytes (2 hex chars per byte)
async function randomHex(bytes = 8) {
  const arr = await Random.getRandomBytesAsync(bytes);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a digital tourist ID object.
 * Returns:
 * {
 *   id: 'TR-INCOU-ABC12345',
 *   hash: '...random...',
 *   validUntil: ISO_STRING
 * }
 *
 * Never throws fatally; if something unexpected happens it returns a fallback.
 */
export async function generateDigitalID(uid, fullName, nationality) {
  try {
    const initials = getInitials(fullName);
    const country = getCountryPart(nationality);
    const hex = (await randomHex(8)).toUpperCase();
    // Compose an ID pattern you like (adjust as desired):
    const randomChunk = hex.slice(0, 8);
    const id = `TR-${initials}${country}-${randomChunk}`;
    const validUntil = new Date(Date.now() + VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    return {
      id,
      hash: hex, // Can store entire hex as "hash" surrogate
      validUntil
    };
  } catch (e) {
    console.warn('[digitalID] Failed to generate robust ID, falling back.', e);
    // Fallback: timestamp-based ID (still unique-ish)
    const fallback = `TR-FB-${Date.now().toString(36).toUpperCase()}`;
    return {
      id: fallback,
      hash: fallback,
      validUntil: new Date(Date.now() + VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString()
    };
  }
}

/**
 * Validity checker used elsewhere.
 */
export function isDigitalIDValid(validUntilISO) {
  if (!validUntilISO) return false;
  return new Date(validUntilISO).getTime() > Date.now();
}