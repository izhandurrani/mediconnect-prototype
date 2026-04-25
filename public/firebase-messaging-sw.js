/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging — Background Service Worker
 *
 * This runs in its own thread and handles push notifications when the app
 * is in the background or closed.  Update the firebaseConfig below with
 * the same values used in your .env.local (VITE_FIREBASE_*).
 */

// Firebase compat SDKs (required inside service workers)
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"
);

// ─── Firebase config ───────────────────────────────────────────────
// Replace these placeholder values with your actual project credentials.
// They must match the VITE_FIREBASE_* env vars in .env.local:
//   apiKey            → VITE_FIREBASE_API_KEY
//   authDomain        → VITE_FIREBASE_AUTH_DOMAIN
//   projectId         → VITE_FIREBASE_PROJECT_ID
//   storageBucket     → VITE_FIREBASE_STORAGE_BUCKET
//   messagingSenderId → VITE_FIREBASE_MESSAGING_SENDER_ID
//   appId             → VITE_FIREBASE_APP_ID
firebase.initializeApp({
  apiKey:            "YOUR_FIREBASE_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID",
});

const messaging = firebase.messaging();

// ─── Background message handler ────────────────────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw] Background message received:", payload);

  const notificationTitle = payload.notification?.title || "MediConnect Alert";
  const notificationOptions = {
    body:    payload.notification?.body || "You have a new emergency update.",
    icon:    "/icons/icon-192.png",
    badge:   "/icons/icon-192.png",
    vibrate: [200, 100, 200],
    data:    payload.data || {},
    tag:     "mediconnect-emergency",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ─── Notification click handler ────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Open the app when the notification is tapped
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow("/home");
        }
      })
  );
});
