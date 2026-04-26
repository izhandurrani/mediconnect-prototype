importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCnt19gBr2v-hS4LQmFRZGDPzqcj_lfdac",
  authDomain: "medi-connect-6c1b2.firebaseapp.com",
  projectId: "medi-connect-6c1b2",
  storageBucket: "medi-connect-6c1b2.firebasestorage.app",
  messagingSenderId: "616924725651",
  appId: "1:616924725651:web:30abeac12dcd05c2612866"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'mediconnect-emergency',
    requireInteraction: true,
    data: payload.data,
    actions: [
      { action: 'open', title: 'Open MediConnect' }
    ]
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
