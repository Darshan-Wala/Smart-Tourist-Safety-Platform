import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cached_profile_v1';

/**
 * Cache ONLY SAFE profile (no digital ID or blockchain sensitive fields)
 * This function now strips sensitive fields before writing.
 */
export async function cacheProfile(profile) {
  try {
    if (!profile) return;

    const {
      digitalTouristID,
      digitalIDHash,
      digitalIDValidUntil,
      digitalIDIssuedAt,
      blockchainTxHash,
      blockchainBlockNumber,
      blockchainNetwork,
      blockchainChainId,
      ...safe
    } = profile;

    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ data: safe, cachedAt: Date.now() })
    );
  } catch {}
}

export async function getCachedProfile() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.data || null;
  } catch {
    return null;
  }
}

export async function clearCachedProfile() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}