// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCwq64pM43q1jn6Mm9RrWCzUwmuL1RidbM",
  projectId: "mon-application-organisation",
  messagingSenderId: "158537370895",
  appId: "1:158537370895:web:632841d0031d946204427a"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Message reçu en arrière-plan:', payload);
});