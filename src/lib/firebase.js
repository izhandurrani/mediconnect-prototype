import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Guard against double-initialization in HMR / strict mode
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);

// ── Messaging (lazy, null-safe) ─────────────────────────────────────────────
// Messaging is only available in browser contexts with service-worker support.
let _messaging = null;
async function getMessagingInstance() {
  if (_messaging) return _messaging;
  const supported = await isSupported();
  if (!supported) return null;
  _messaging = getMessaging(app);
  return _messaging;
}

// Resolves to null on unsupported environments (SSR, old browsers, etc.)
export const messaging = await getMessagingInstance().catch(() => null);

/**
 * Request notification permission and return an FCM registration token.
 * Returns null if messaging is unsupported or permission is denied.
 */
export async function getFCMToken() {
  const instance = await getMessagingInstance();
  if (!instance) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  return getToken(instance, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
  });
}

/**
 * Subscribe to foreground FCM messages.
 * Returns an unsubscribe function (or a no-op if messaging is unsupported).
 */
export function onForegroundMessage(callback) {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
