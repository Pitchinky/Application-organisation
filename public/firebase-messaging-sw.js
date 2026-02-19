// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCwq64pM43q1jn6Mm9RrWCzUwmuL1RidbM",
  authDomain: "mon-application-organisation.firebaseapp.com",
  databaseURL: "https://mon-application-organisation-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "mon-application-organisation",
  storageBucket: "mon-application-organisation.firebasestorage.app",
  messagingSenderId: "158537370895",
  appId: "1:158537370895:web:632841d0031d946204427a",
  measurementId: "G-ZBBJ6QW05D"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Gère les notifications quand l'app est en arrière-plan
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Notification reçue en arrière-plan ', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png' // Assure-toi que ce fichier existe dans public/
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});