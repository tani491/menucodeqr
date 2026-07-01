import type { DefaultSession, NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import * as admin from "firebase-admin";
import {
  cert,
  getApps as getAdminApps,
  initializeApp as initializeAdminApp,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

type SafeFirestoreDoc = {
  exists?: boolean;
  data?: () => Record<string, unknown> | undefined;
};

type SafeFirestore = {
  collection: (name: string) => {
    doc: (id: string) => {
      get: () => Promise<SafeFirestoreDoc>;
    };
  };
};

type AdminCompat = {
  apps?: unknown[];
  initializeApp?: (options: unknown) => unknown;
  credential?: {
    cert?: (serviceAccount: unknown) => unknown;
  };
  firestore?: () => unknown;
};

const adminCompat = admin as unknown as AdminCompat;

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: string;
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

function getStringEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getFirebaseClientAuth() {
  try {
    const firebaseConfig: FirebaseOptions = {
      apiKey: getStringEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
      authDomain: getStringEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
      projectId: getStringEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
      storageBucket: getStringEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
      messagingSenderId: getStringEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
      appId: getStringEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
    };

    const firebaseApps = typeof getApps === "function" ? getApps() : [];
    const app = Array.isArray(firebaseApps) && firebaseApps[0]
      ? firebaseApps[0]
      : initializeApp(firebaseConfig);

    return getAuth(app);
  } catch (error) {
    console.error("NextAuth Firebase Client Init Error:", error);
    return null;
  }
}

function getFirebaseAdminFirestore(): SafeFirestore | null {
  try {
    const projectId = getStringEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
    const clientEmail = getStringEnv("FIREBASE_CLIENT_EMAIL");
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
      : undefined;

    if (!projectId || !clientEmail || !privateKey) {
      console.error("NextAuth Firebase Admin Error: missing Firebase Admin environment variables");
      return null;
    }

    try {
      const adminApps =
        adminCompat && adminCompat.apps && Array.isArray(adminCompat.apps)
          ? adminCompat.apps
          : getAdminApps();

      if (!adminApps.length) {
        initializeAdminApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      }
    } catch (error) {
      console.error("NextAuth Firebase Admin App Init Error:", error);
      return null;
    }

    try {
      return getFirestore() as unknown as SafeFirestore;
    } catch (error) {
      console.error("NextAuth Firebase Admin Firestore Error:", error);
      return null;
    }
  } catch (error) {
    console.error("NextAuth Firebase Admin Init Error:", error);
    return null;
  }
}

function normalizeRole(role: unknown) {
  if (typeof role !== "string") return "user";

  const normalizedRole = role.trim();
  if (!normalizedRole) return "user";
  if (normalizedRole === "admin") return "super_admin";

  return normalizedRole;
}

function getAdminCompatFirestore(): SafeFirestore | null {
  try {
    const projectId = getStringEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
    const clientEmail = getStringEnv("FIREBASE_CLIENT_EMAIL");
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
      : undefined;

    if (!projectId || !clientEmail || !privateKey) {
      return null;
    }

    if (
      adminCompat &&
      adminCompat.apps &&
      adminCompat.apps.length === 0 &&
      adminCompat.initializeApp &&
      adminCompat.credential?.cert
    ) {
      adminCompat.initializeApp({
        credential: adminCompat.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    return adminCompat?.firestore ? (adminCompat.firestore() as SafeFirestore) : null;
  } catch (error) {
    console.error("NextAuth Firebase Admin Compat Error:", error);
    return null;
  }
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
          let email = "";
          let password = "";

          try {
            email =
              typeof credentials?.email === "string"
                ? credentials.email.trim().toLowerCase()
                : "";
            password = typeof credentials?.password === "string" ? credentials.password : "";
          } catch (error) {
            console.error("NextAuth Authorize Credentials Error:", error);
            return null;
          }

          if (!email || !password) return null;

          const firebaseAuth = getFirebaseClientAuth();
          if (!firebaseAuth) return null;

          let firebaseUser:
            | Awaited<ReturnType<typeof signInWithEmailAndPassword>>["user"]
            | null = null;

          try {
            const userCredential = await signInWithEmailAndPassword(
              firebaseAuth,
              email,
              password
            );
            firebaseUser = userCredential?.user || null;
          } catch (error) {
            console.error("NextAuth Firebase SignIn Error:", error);
            return null;
          }

          const uid = typeof firebaseUser?.uid === "string" ? firebaseUser.uid : "";
          if (!uid) {
            console.error("NextAuth Authorize Error: Firebase user UID is missing");
            return null;
          }

          const fallbackUser = {
            id: uid,
            name:
              typeof firebaseUser?.displayName === "string" && firebaseUser.displayName.trim()
                ? firebaseUser.displayName
                : null,
            email:
              typeof firebaseUser?.email === "string" && firebaseUser.email.trim()
                ? firebaseUser.email
                : email,
            role: "user",
            restaurantId: null,
          };

          const firestore = getFirebaseAdminFirestore() || getAdminCompatFirestore();
          if (!firestore) return fallbackUser;

          let userDoc: SafeFirestoreDoc | null = null;

          try {
            userDoc = await firestore.collection("users").doc(uid).get();
          } catch (error) {
            console.error("NextAuth Firestore Users Read Error:", error);
            return fallbackUser;
          }

          try {
            if (!userDoc?.exists) {
              const accountDoc = await firestore.collection("accounts").doc(uid).get();
              if (accountDoc?.exists) {
                userDoc = accountDoc;
              }
            }
          } catch (error) {
            console.error("NextAuth Firestore Accounts Read Error:", error);
            return fallbackUser;
          }

          if (!userDoc?.exists) return fallbackUser;

          let userData: Record<string, unknown> = {};

          try {
            userData = userDoc.data() || {};
          } catch (error) {
            console.error("NextAuth Firestore Data Error:", error);
            return fallbackUser;
          }

          const role = normalizeRole(userData.role);
          const restaurantId =
            typeof userData.restaurantId === "string" && userData.restaurantId.trim()
              ? userData.restaurantId
              : null;
          const name =
            typeof userData.name === "string" && userData.name.trim()
              ? userData.name
              : fallbackUser.name;
          const userEmail =
            typeof userData.email === "string" && userData.email.trim()
              ? userData.email
              : fallbackUser.email;

          return {
            id: uid,
            name,
            email: userEmail,
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
      try {
        if (user) {
          token.id = typeof user.id === "string" ? user.id : "";
          token.role = typeof user.role === "string" ? user.role : "user";
          token.restaurantId =
            typeof user.restaurantId === "string" && user.restaurantId.trim()
              ? user.restaurantId
              : null;
        }
      } catch (error) {
        console.error("NextAuth JWT Callback Error:", error);
      }

      return token;
    },
    async session({ session, token }) {
      try {
        if (session.user) {
          session.user.id = typeof token.id === "string" ? token.id : "";
          session.user.role = typeof token.role === "string" ? token.role : "user";
          session.user.restaurantId =
            typeof token.restaurantId === "string" && token.restaurantId.trim()
              ? token.restaurantId
              : null;
        }
      } catch (error) {
        console.error("NextAuth Session Callback Error:", error);
      }

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET || "dev-secret-change-in-production-menu-qr-v1",
};
