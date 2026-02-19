import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Importe Firestore
import { getMessaging, getToken, onMessage } from "firebase/messaging";

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

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);

// Exportation de la base de données Firestore pour l'utiliser dans ton App
export const db = getFirestore(app);

// Ajout du Messaging
export const messaging = getMessaging(app);

// Fonction pour demander la permission et récupérer le Token
export const requestForToken = () => {
  return getToken(messaging, { vapidKey: 'BKfanQvdHFWrraZIjoUGC8OkYOfijrUhSGWQBL9GrjXwiglMBpCtxKXpaKuBYWLk1svlXh1IsX_DEtEJquwZfxg' })
    .then((currentToken) => {
      if (currentToken) {
        console.log('Token généré :', currentToken);
        // Ici, on devra plus tard l'enregistrer dans Firestore
        return currentToken;
      } else {
        console.log('Pas de token généré.');
      }
    })
    .catch((err) => {
      console.log('Erreur récupération token', err);
    });
};

// Écouter les messages quand l'app est OUVERTE
export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });