import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { DefaultSession } from "next-auth";
import * as admin from 'firebase-admin';
import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: string; // "restaurateur" | "super_admin"
      restaurantId: string | null;
    } & DefaultSession["user"];
  }
  interface User {
    restaurantId: string | null;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    restaurantId: string | null;
  }
}

function getFirebaseClientAuth() {
  const firebaseConfig: FirebaseOptions = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
}

function getFirebaseAdminFirestore() {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  }

  return admin.firestore();
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        try {
          const email =
            typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
          const password = typeof credentials?.password === "string" ? credentials.password : "";

          if (!email || !password) return null;

          const firebaseAuth = getFirebaseClientAuth();

          const userCredential = await signInWithEmailAndPassword(
            firebaseAuth,
            email,
            password
          );

          const firebaseUser = userCredential?.user;
          const uid = firebaseUser?.uid;

          if (!uid) {
            console.error("NextAuth Authorize Error: Firebase user or UID is missing");
            return null;
          }

          const firestore = getFirebaseAdminFirestore();
          let userDoc = await firestore.collection("users").doc(uid).get();

          if (!userDoc.exists) {
            const accountDoc = await firestore.collection("accounts").doc(uid).get();
            if (accountDoc.exists) {
              userDoc = accountDoc;
            }
          }

          if (!userDoc.exists) {
            return {
              id: uid,
              name: firebaseUser.displayName || null,
              email: firebaseUser.email || email,
              role: "user",
              restaurantId: null,
            };
          }

          const userData = userDoc.data() || {};
          const role =
            typeof userData.role === "string" && userData.role.trim() ? userData.role : "user";
          const restaurantId =
            typeof userData.restaurantId === "string" && userData.restaurantId.trim()
              ? userData.restaurantId
              : null;

          return {
            id: uid,
            name:
              typeof userData.name === "string" && userData.name.trim()
                ? userData.name
                : firebaseUser.displayName || null,
            email:
              typeof userData.email === "string" && userData.email.trim()
                ? userData.email
                : firebaseUser.email || email,
            role,
            restaurantId,
          };
        } catch (error) {
          console.error("NextAuth Authorize Error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.restaurantId = user.restaurantId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.restaurantId = token.restaurantId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24h
  },
  secret: process.env.NEXTAUTH_SECRET || "dev-secret-change-in-production-menu-qr-v1",
};
