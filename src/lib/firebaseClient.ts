import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig, getFirebasePublicConfig } from "./firebaseConfig";

let cachedFirestore: Firestore | null = null;

const app = getApps().length > 0 ? getApp() : initializeApp(getFirebasePublicConfig());

function getDashboardFirestore() {
  if (cachedFirestore) return cachedFirestore;

  try {
    cachedFirestore = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    cachedFirestore = getFirestore(app);
  }

  return cachedFirestore;
}

export const auth = getAuth(app);
export const db = getDashboardFirestore();
export { app, firebaseConfig };
