import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuration publique Firebase Web forcee cote client pour eviter les env manquantes sur Vercel.
// Firebase Storage n'est pas initialise : les images sont stockees en Base64 dans Firestore.
export const firebaseConfig = {
  apiKey: "AIzaSyBUJunuUW_346uq0lygcouc_66wrBIkYNU",
  authDomain: "codeqrmenu-525a7.firebaseapp.com",
  projectId: "codeqrmenu-525a7",
  storageBucket: "codeqrmenu-525a7.firebasestorage.app",
  messagingSenderId: "942948658860",
  appId: "1:942948658860:web:989313482a946d96a1f909",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export { app };
