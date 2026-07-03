import type { FirebaseOptions } from "firebase/app";

const firebasePublicConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() || "",
};

const requiredFirebasePublicConfig: Array<[keyof FirebaseOptions, string]> = [
  ["apiKey", "NEXT_PUBLIC_FIREBASE_API_KEY"],
  ["authDomain", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"],
  ["projectId", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"],
  ["storageBucket", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"],
  ["messagingSenderId", "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"],
  ["appId", "NEXT_PUBLIC_FIREBASE_APP_ID"],
];

export function getFirebasePublicConfig() {
  const missing = requiredFirebasePublicConfig
    .filter(([key]) => !firebasePublicConfig[key])
    .map(([, envName]) => envName);

  if (missing.length > 0) {
    throw new Error(
      `Configuration Firebase client incomplete. Variables Vercel manquantes: ${missing.join(", ")}.`
    );
  }

  return firebasePublicConfig;
}

export const firebaseConfig = firebasePublicConfig;
