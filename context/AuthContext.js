/**
 * AuthContext.js (UPDATED)
 *
 * Changes:
 *  - Firestore listener path changed from 'users' to 'tourists'
 *  - Supports avatarUrl & currentTripId in profile updates
 *  - Uses AuthService.fetchProfile() if available
 *  - Adds safe handling for currentTripId pointer logic
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef
} from 'react';

import AuthService from '../services/authService';
import {
  cacheProfile,
  getCachedProfile,
  clearCachedProfile
} from '../utils/profileCache';
import { isDigitalIDValid } from '../utils/digitalID';

import { auth, firebase } from '../firebase';

import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { base64urlEncode } from '../utils/base64url';
import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

const expoConfig = Constants.expoConfig || {};
const { extra = {} } = expoConfig;
const { google = {} } = extra;

const GOOGLE_WEB_CLIENT_ID =
  google.webClientId ||
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  null;

console.log('[AuthContext] Google Web Client ID:', GOOGLE_WEB_CLIENT_ID || 'MISSING');

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

/* ---------------- Per-user cache helpers ---------------- */
const userCacheKey = (uid) => `profile:${uid}`;

async function getPerUserCachedProfile(uid) {
  try {
    const raw = await AsyncStorage.getItem(userCacheKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function setPerUserCachedProfile(uid, data) {
  try {
    await AsyncStorage.setItem(userCacheKey(uid), JSON.stringify(data));
  } catch {}
}

/* ---------------- Normalization & Redaction ---------------- */
function normalizeProfile(p = {}, fallback = {}) {
  const emergencyObj = p.emergency || {};
  const uid = p.uid ?? fallback.uid ?? '';
  const email = p.email ?? fallback.email ?? '';
  const fullName = p.fullName ?? p.name ?? fallback.displayName ?? '';

  const phoneNumber =
    p.phoneNumber ??
    p.phone ??
    p.mobile ??
    p.contactNumber ??
    '';

  const nationality =
    p.nationality ??
    p.country ??
    p.citizenship ??
    '';

  const emergencyContact =
    p.emergencyContact ??
    p.emergencyName ??
    p.emergency_name ??
    emergencyObj.name ??
    '';

  const emergencyPhone =
    p.emergencyPhone ??
    p.emergencyContactPhone ??
    p.emergency_phone ??
    emergencyObj.phone ??
    '';

  return {
    uid,
    email,
    fullName,
    phoneNumber,
    nationality,
    emergencyContact,
    emergencyPhone,
    ...p
  };
}

const redactSensitive = (p) => {
  if (!p) return p;
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
  } = p;
  return safe;
};

function mergeMissingFromCache(normalized, cached) {
  if (!cached) return normalized;
  const out = { ...normalized };
  const keys = ['phoneNumber', 'nationality', 'emergencyContact', 'emergencyPhone'];
  for (const k of keys) {
    const v = out[k];
    if (v === undefined || v === null) {
      const cv = cached[k];
      if (cv !== undefined && cv !== null) out[k] = cv;
    }
  }
  return out;
}

/* ---------------- PKCE Helpers ---------------- */
async function createCodeVerifier() {
  try {
    const bytes = await Crypto.getRandomBytesAsync(64);
    let verifier = base64urlEncode(bytes);
    if (verifier.length < 43) {
      while (verifier.length < 43) verifier += verifier;
      verifier = verifier.slice(0, 64);
    }
    if (verifier.length > 128) verifier = verifier.slice(0, 128);
    return verifier;
  } catch (e) {
    console.warn('[AuthContext][PKCE] Fallback Math.random due to crypto error:', e);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let out = '';
    for (let i = 0; i < 64; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }
}

async function codeChallengeFromVerifier(codeVerifier) {
  const digestB64 = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    codeVerifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  return digestB64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ---------------- Provider ---------------- */
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const mountedRef = useRef(true);

  const profileDocUnsubRef = useRef(null);
  const detachProfileDocListener = () => {
    if (profileDocUnsubRef.current) {
      try { profileDocUnsubRef.current(); } catch {}
      profileDocUnsubRef.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      detachProfileDocListener();
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cached = await getCachedProfile();
        if (cached && mountedRef.current) {
          const normalized = normalizeProfile(cached);
          const safe = redactSensitive(normalized);
          setProfile(safe);
        }
      } catch {}
    })();
  }, []);

  const loadAndCacheProfile = useCallback(
    async (fbUser) => {
      if (!fbUser?.uid) return;
      let p = null;

      const perUserCached = await getPerUserCachedProfile(fbUser.uid);

      try {
        // Use new fetchProfile (modular)
        if (typeof AuthService.fetchProfile === 'function') {
          p = await AuthService.fetchProfile(fbUser.uid);
        }
      } catch (e) {
        console.warn('[AuthContext] fetchProfile failed:', e?.message || e);
      }

      if (!p) {
        const minimal = {
          uid: fbUser.uid,
          fullName: fbUser.displayName || '',
          email: fbUser.email || fbUser.providerData?.[0]?.email || '',
          phoneNumber: fbUser.phoneNumber || '',
          nationality: '',
          emergencyContact: '',
          emergencyPhone: '',
          avatarUrl: '',
          currentTripId: null,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        try {
          await AuthService.updateProfile({
            fullName: minimal.fullName,
            phoneNumber: minimal.phoneNumber,
            nationality: minimal.nationality,
            emergencyContact: minimal.emergencyContact,
            emergencyPhone: minimal.emergencyPhone
          });
        } catch (e) {
          console.warn('[AuthContext] Persist minimal profile failed (non-fatal):', e?.message || e);
        }
        p = minimal;
      }

      let normalized = normalizeProfile(p, {
        uid: fbUser.uid,
        email: fbUser.email || fbUser.providerData?.[0]?.email || '',
        displayName: fbUser.displayName || ''
      });

      normalized = mergeMissingFromCache(normalized, perUserCached);

      const safe = redactSensitive(normalized);
      if (mountedRef.current) {
        setProfile(safe);
        cacheProfile(safe).catch(() => {});
        setPerUserCachedProfile(fbUser.uid, safe).catch?.(() => {});
      }
    },
    []
  );

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!mountedRef.current) return;

      detachProfileDocListener();
      setUser(firebaseUser || null);

      if (firebaseUser) {
        const perUserCached = await getPerUserCachedProfile(firebaseUser.uid);
        if (perUserCached) {
          const safeCached = redactSensitive(normalizeProfile(perUserCached, {
            uid: firebaseUser.uid,
            email: firebaseUser.email || firebaseUser.providerData?.[0]?.email || '',
            displayName: firebaseUser.displayName || ''
          }));
          if (mountedRef.current) setProfile(safeCached);
        }

        await loadAndCacheProfile(firebaseUser);

        // Realtime listener now points to 'tourists/{uid}'
        try {
          const dbCompat = firebase?.firestore?.();
          if (dbCompat) {
            const ref = dbCompat.collection('tourists').doc(firebaseUser.uid);
            profileDocUnsubRef.current = ref.onSnapshot(async (snap) => {
              const data = snap.data() || {};
              const fallback = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || firebaseUser.providerData?.[0]?.email || '',
                displayName: firebaseUser.displayName || ''
              };
              const cached = await getPerUserCachedProfile(firebaseUser.uid);
              let normalized = normalizeProfile(data, fallback);
              normalized = mergeMissingFromCache(normalized, cached);
              const safe = redactSensitive(normalized);

              if (mountedRef.current) {
                setProfile(safe);
                cacheProfile(safe).catch(() => {});
                setPerUserCachedProfile(firebaseUser.uid, safe).catch?.(() => {});
              }
            }, (err) => {
              console.warn('[AuthContext] Firestore onSnapshot error:', err);
            });
          }
        } catch (e) {
          console.warn('[AuthContext] Firestore realtime unavailable:', e?.message || e);
        }

      } else {
        setProfile(null);
        clearCachedProfile().catch(() => {});
      }

      setInitializing(false);
    });
    return () => {
      unsub();
      detachProfileDocListener();
    };
  }, [loadAndCacheProfile]);

  const guarded = (fn) => async (...args) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      return await fn(...args);
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };

  /* ---------------- Actions ---------------- */
  const register = useCallback(
    guarded(async (data) => {
      const { user: u, profile: p } = await AuthService.register(data);
      if (!mountedRef.current) return;
      setUser(u);
      if (p) {
        const normalized = normalizeProfile(p, {
          uid: u?.uid,
          email: u?.email || u?.providerData?.[0]?.email || '',
          displayName: u?.displayName || ''
        });
        const safe = redactSensitive(normalized);
        setProfile(safe);
        cacheProfile(safe).catch(() => {});
        if (u?.uid) setPerUserCachedProfile(u.uid, safe).catch?.(() => {});
      } else if (u) {
        await loadAndCacheProfile(u);
      }
    }),
    [actionLoading, loadAndCacheProfile]
  );

  const login = useCallback(
    guarded(async (email, password) => {
      const { user: u, profile: p } = await AuthService.login(email, password);
      if (!mountedRef.current) return;
      setUser(u);
      if (p) {
        let normalized = normalizeProfile(p, {
          uid: u?.uid,
          email: u?.email || u?.providerData?.[0]?.email || '',
          displayName: u?.displayName || ''
        });
        const perUserCached = u?.uid ? await getPerUserCachedProfile(u.uid) : null;
        normalized = mergeMissingFromCache(normalized, perUserCached);
        const safe = redactSensitive(normalized);
        setProfile(safe);
        cacheProfile(safe).catch(() => {});
        if (u?.uid) setPerUserCachedProfile(u.uid, safe).catch?.(() => {});
      } else if (u) {
        await loadAndCacheProfile(u);
      }
    }),
    [actionLoading, loadAndCacheProfile]
  );

  const logout = useCallback(
    guarded(async () => {
      await AuthService.logout();
      if (!mountedRef.current) return;
      detachProfileDocListener();
      setUser(null);
      setProfile(null);
      clearCachedProfile().catch(() => {});
    }),
    [actionLoading]
  );

  const reauthenticate = useCallback(async (pwd) => AuthService.reauthenticate(pwd), []);
  const fetchSecureDigitalID = useCallback(async (uid) => AuthService.fetchSecureDigitalID(uid), []);

  const updateProfile = useCallback(
    guarded(async (partial) => {
      const fresh = await AuthService.updateProfile(partial);
      if (mountedRef.current) {
        if (fresh) {
          const normalized = normalizeProfile(fresh, {
            uid: auth.currentUser?.uid,
            email: auth.currentUser?.email || auth.currentUser?.providerData?.[0]?.email || '',
            displayName: auth.currentUser?.displayName || ''
          });
          const safe = redactSensitive(normalized);
          setProfile(safe);
          cacheProfile(safe).catch(() => {});
          if (auth.currentUser?.uid) setPerUserCachedProfile(auth.currentUser.uid, safe).catch?.(() => {});
        } else {
          setProfile((prev) => {
            const merged = normalizeProfile(
              { ...(prev || {}), ...partial, updatedAt: Date.now() },
              {
                uid: auth.currentUser?.uid,
                email: auth.currentUser?.email || auth.currentUser?.providerData?.[0]?.email || '',
                displayName: auth.currentUser?.displayName || ''
              }
            );
            const safe = redactSensitive(merged);
            cacheProfile(safe).catch(() => {});
            if (auth.currentUser?.uid) setPerUserCachedProfile(auth.currentUser.uid, safe).catch?.(() => {});
            return safe;
          });
        }
      }
    }),
    [actionLoading]
  );

  const changePassword = useCallback(guarded(async (currentPwd, newPwd) => {
    await AuthService.changePassword(currentPwd, newPwd);
  }), [actionLoading]);

  const resetPassword = useCallback(guarded(async (email) => {
    await AuthService.resetPassword(email);
  }), [actionLoading]);

  /* ---------------- Google Sign-In (PKCE) ---------------- */
  const signInWithGoogle = useCallback(async () => {
    if (actionLoading) {
      console.log('[AuthContext][Google] Ignored duplicate tap.');
      return;
    }
    if (!GOOGLE_WEB_CLIENT_ID) {
      console.warn('[AuthContext][Google] Missing web client ID');
      return;
    }

    setActionLoading(true);
    try {
      const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
      const codeVerifier = await createCodeVerifier();
      const codeChallenge = await codeChallengeFromVerifier(codeVerifier);

      const params = {
        response_type: 'code',
        client_id: GOOGLE_WEB_CLIENT_ID,
        redirect_uri: redirectUri,
        scope: 'openid email profile',
        prompt: 'select_account',
        access_type: 'offline',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      };

      const authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth?' +
        Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

      const result = await AuthSession.startAsync({ authUrl });

      if (result.type !== 'success' || !result.params?.code) {
        console.log('[AuthContext][Google] Cancelled or no code');
        return;
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: [
          'grant_type=authorization_code',
          'code=' + encodeURIComponent(result.params.code),
          'client_id=' + encodeURIComponent(GOOGLE_WEB_CLIENT_ID),
          'redirect_uri=' + encodeURIComponent(redirectUri),
          'code_verifier=' + encodeURIComponent(codeVerifier)
        ].join('&')
      }).then(r => r.json());

      if (tokenRes.error || !tokenRes.id_token) {
        console.warn('[AuthContext][Google] Token exchange error', tokenRes);
        return;
      }

      const credential = firebase.auth.GoogleAuthProvider.credential(tokenRes.id_token);
      await auth.signInWithCredential(credential);

      const current = auth.currentUser;
      if (current) {
        await loadAndCacheProfile(current);
      }

    } catch (e) {
      console.warn('[AuthContext][Google] Sign-in failed:', e);
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  }, [actionLoading, GOOGLE_WEB_CLIENT_ID, loadAndCacheProfile]);

  const refreshProfile = useCallback(async () => {
    if (user) await loadAndCacheProfile(user);
  }, [user, loadAndCacheProfile]);

  const value = useMemo(
    () => ({
      user,
      profile,
      initializing,
      actionLoading,
      isAuthenticated: !!user,
      register,
      login,
      logout,
      reauthenticate,
      fetchSecureDigitalID,
      updateProfile,
      changePassword,
      resetPassword,
      signInWithGoogle,
      refreshProfile,
      isDigitalIDValid
    }),
    [
      user,
      profile,
      initializing,
      actionLoading,
      register,
      login,
      logout,
      reauthenticate,
      fetchSecureDigitalID,
      updateProfile,
      changePassword,
      resetPassword,
      signInWithGoogle,
      refreshProfile
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { AuthProvider };