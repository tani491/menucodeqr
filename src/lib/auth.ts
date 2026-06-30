import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { DefaultSession } from "next-auth";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getFirebaseAdminFirestore } from "@/lib/firebaseAdmin";
import { auth as firebaseAuth } from "@/lib/firebaseClient";

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

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.trim().toLowerCase();

        try {
          const userCredential = await signInWithEmailAndPassword(
            firebaseAuth,
            email,
            credentials.password
          );

          const firestore = getFirebaseAdminFirestore();
          if (!firestore) return null;

          const userDoc = await firestore.collection("users").doc(userCredential.user.uid).get();
          if (!userDoc.exists) return null;

          const userData = userDoc.data();
          const role = typeof userData?.role === "string" ? userData.role : null;
          const restaurantId =
            typeof userData?.restaurantId === "string" ? userData.restaurantId : null;

          if (!role) return null;

          return {
            id: userCredential.user.uid,
            name:
              typeof userData?.name === "string"
                ? userData.name
                : userCredential.user.displayName,
            email: userCredential.user.email || email,
            role,
            restaurantId,
          };
        } catch {
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
