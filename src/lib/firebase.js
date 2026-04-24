import { initializeApp } from "firebase/app";
import { getAuth }        from "firebase/auth";
import { getFirestore }   from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app       = initializeApp(firebaseConfig);
export const auth      = getAuth(app);
export const db        = getFirestore(app);
export const messaging = getMessaging(app);

// Get FCM token for this device (call after user grants notification permission)
export async function getFCMToken() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;
  return getToken(messaging, { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY });
}

// Listen for foreground push messages
export function onForegroundMessage(callback) {
  return onMessage(messaging, callback);
}
