import * as admin from "firebase-admin";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

type FirebaseAdminConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  storageBucket?: string;
};

let cachedApp: App | null | undefined;

function getFirebaseAdminConfig(): FirebaseAdminConfig | null {
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
    storageBucket: storageBucket || undefined,
  };
}

export function getFirebaseAdminApp() {
  if (cachedApp !== undefined) {
    return cachedApp;
  }

  const config = getFirebaseAdminConfig();
  if (!config) {
    cachedApp = null;
    return cachedApp;
  }

  cachedApp =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          credential: cert({
            projectId: config.projectId,
            clientEmail: config.clientEmail,
            privateKey: config.privateKey,
          }),
          storageBucket: config.storageBucket,
        });

  return cachedApp;
}

export function getFirebaseAdminAuth() {
  const app = getFirebaseAdminApp();
  return app ? getAuth(app) : null;
}

export function getFirebaseAdminFirestore() {
  const app = getFirebaseAdminApp();
  return app ? getFirestore(app) : null;
}

export function getFirebaseAdminStorage() {
  const app = getFirebaseAdminApp();
  return app ? getStorage(app) : null;
}

export { admin };
