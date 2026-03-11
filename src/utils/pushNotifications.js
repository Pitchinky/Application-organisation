// src/utils/pushNotifications.js
import { getToken } from "firebase/messaging";
import { messaging, db } from "../firebaseConfig";
import { doc, setDoc } from "firebase/firestore"; // Change updateDoc par setDoc
import { arrayUnion } from "firebase/firestore";

export const requestForToken = async (userId) => {
  if (!userId) return;

  try {
    const permission = await Notification.requestPermission();
    
    if (permission === "granted") {
      const token = await getToken(messaging, {
        vapidKey: "BKfanQvdHFWrraZIjoUGC8OkYOfijrUhSGWQBL9GrjXwiglMBpCtxKXpaKuBYWLk1svlXh1IsX_DEtEJquwZfxg"
      });

      if (token) {
        // --- UTILISATION DE SETDOC POUR ÉVITER L'ERREUR ---
        const userRef = doc(db, "users", userId);
        await setDoc(userRef, {
        fcmTokens: arrayUnion(token), // On stocke dans une liste 'fcmTokens'
        lastSeen: new Date().toISOString()
        }, { merge: true }); // Merge: true permet de ne pas écraser le reste du profil

        console.log("Token sauvegardé avec succès !");
        return token;
      }
    }
  } catch (error) {
    console.error("Erreur lors de la récupération du Token :", error);
  }
};