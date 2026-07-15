import 'dotenv/config';
import fs from 'fs';
import path from 'path';

/* ---------- Helpers ---------- */
function fileIfExists(relPath) {
  try {
    const abs = path.join(process.cwd(), relPath);
    if (fs.existsSync(abs)) return relPath;
  } catch {}
  return null;
}

function readEnv(name, { required = false, allowPlaceholder = false } = {}) {
  const v = process.env[name];
  const isPlaceholder = v && (v.startsWith('PASTE_') || v.startsWith('YOUR_'));
  if (!v || (isPlaceholder && !allowPlaceholder)) {
    const msg = `[app.config.js] WARNING: ${name} is ${v ? 'a placeholder' : 'missing'}${required ? ' (REQUIRED)' : ''}.`;
    console.warn(msg);
  }
  return v;
}

/* ---------- Assets ---------- */
const splashCandidatePrimary = './assets/splash.png';
const splashCandidateAlt = './assets/splash-icon.png';
const splashImage =
  fileIfExists(splashCandidatePrimary) ||
  fileIfExists(splashCandidateAlt) ||
  null;

/* ---------- Core Identifiers ---------- */
const APP_NAME = 'Smart Tourist Safety';
const SLUG = 'smart-tourist-safety';
const CUSTOM_SCHEME = 'tourtravel';

/* ---------- Env Vars (Public) ---------- */
const GOOGLE_WEB_CLIENT_ID = readEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', { required: true });
const FIREBASE_API_KEY = readEnv('EXPO_PUBLIC_FIREBASE_API_KEY', { required: true });
const FIREBASE_AUTH_DOMAIN = readEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', { required: true });
const FIREBASE_PROJECT_ID = readEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID', { required: true });
const FIREBASE_APP_ID = readEnv('EXPO_PUBLIC_FIREBASE_APP_ID', { required: true });
const FIREBASE_STORAGE_BUCKET = readEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', { required: true });
const FIREBASE_MESSAGING_SENDER_ID = readEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', { required: true });
const GOOGLE_IOS_CLIENT_ID = readEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
const GOOGLE_ANDROID_CLIENT_ID = readEnv('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID');

/* Optional API / feature flags */
const ML_API_URL = readEnv('EXPO_PUBLIC_ML_API_URL', { allowPlaceholder: true }) || 'http://192.168.27.205:5000';
const DEV_TOOLS_FLAG = readEnv('EXPO_PUBLIC_DEV_TOOLS', { allowPlaceholder: true }) || 'true'; // string form

if (!splashImage) {
  console.warn('[app.config.js] WARNING: No splash image found. Add assets/splash.png or assets/splash-icon.png.');
}

console.log('[app.config.js] Build summary:', {
  app: APP_NAME,
  slug: SLUG,
  splashImage,
  hasGoogleWebClient: !!GOOGLE_WEB_CLIENT_ID,
  hasFirebaseConfig: !!(FIREBASE_API_KEY && FIREBASE_PROJECT_ID),
});

/* ---------- Export Config ---------- */
export default {
  expo: {
    name: APP_NAME,
    slug: SLUG,
    scheme: CUSTOM_SCHEME,
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    icon: './assets/icon.png',
    ...(splashImage
      ? {
          splash: {
            image: splashImage,
            resizeMode: 'contain',
            backgroundColor: '#000000',
          },
        }
      : {}),
    ios: {
      bundleIdentifier: 'com.yourcompany.tourtravel',
      supportsTablet: true,
      /**
       * Add explicit location usage strings + background modes
       * Needed for continuous / background tracking (Live Tracking + BG task)
       */
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'This app needs location access to show your position and provide safety alerts.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Allow background location so the app can continue sharing your live position for safety tracking.',
        NSLocationAlwaysUsageDescription:
          'Always-on location powers emergency monitoring and live tracking sessions.',
        UIBackgroundModes: ['location', 'processing']
      },
    },
    android: {
      package: 'com.yourcompany.tourtravel',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FFFFFF',
      },
      /**
       * Added ACCESS_BACKGROUND_LOCATION already; keep original plus foreground service support.
       * (Expo will automatically handle the notification via startLocationUpdatesAsync foregroundService)
       */
      permissions: [
        'CAMERA',
        'RECORD_AUDIO',
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'ACCESS_MEDIA_LOCATION',
        'FOREGROUND_SERVICE'
      ],
    },
    web: {
      bundler: 'metro',
      favicon: './assets/favicon.png',
    },

    /* ---------- Plugins (extended) ---------- */
    plugins: [
      [
        'expo-camera',
        {
          cameraPermission:
            'This app needs camera access to capture emergency photos for your safety.',
        },
      ],
      [
        'expo-av',
        {
          microphonePermission:
            'This app needs microphone access to record emergency audio for your safety.',
        },
      ],
      /**
       * Enhanced expo-location plugin config:
       * - Provide custom permission strings (kept)
       * - Enable background on both platforms for BG task usage
       */
      [
        'expo-location',
        {
          locationForegroundPermission:
            'This app needs location access to track your position during emergencies.',
          locationBackgroundPermission:
            'This app needs background location access to continuously track your position during panic or live tracking mode.',
          isAndroidBackgroundLocationEnabled: true,
          isIosBackgroundLocationEnabled: true
        },
      ],
      [
        'expo-media-library',
        {
          photosPermission:
            'This app needs access to save emergency photos to your device.',
          savePhotosPermission:
            'This app needs permission to save emergency photos for your safety.',
        },
      ],
    ],

    /* ---------- Extra Runtime Config (unchanged + additions) ---------- */
    extra: {
      firebase: {
        apiKey: FIREBASE_API_KEY,
        authDomain: FIREBASE_AUTH_DOMAIN,
        projectId: FIREBASE_PROJECT_ID,
        appId: FIREBASE_APP_ID,
        storageBucket: FIREBASE_STORAGE_BUCKET,
        messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
      },
      google: {
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iosClientId: GOOGLE_IOS_CLIENT_ID,
        androidClientId: GOOGLE_ANDROID_CLIENT_ID,
      },
      mlApiUrl: ML_API_URL,
      DEV_TOOLS: DEV_TOOLS_FLAG === 'true',
    },

    privacy: 'public',
    runtimeMeta: {
      googleRedirectPatterns: [
        'https://auth.expo.io/@daksh1105/smart-tourist-safety',
        'https://auth.expo.dev/@daksh1105/smart-tourist-safety',
      ],
    },

    /**
     * (Optional) future updates channel / OTA config
     * updates: { url: '...', enabled: true }
     */
  },
};