import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import type { DefaultSession } from "next-auth";
import { verifyFirebaseEmailPassword } from "@/lib/firebaseAuth";

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

        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            password: true,
            role: true,
            restaurantId: true,
          },
        });

        if (!user) return null;

        const firebasePasswordValid = await verifyFirebaseEmailPassword(email, credentials.password);
        const isValid =
          firebasePasswordValid ?? (await bcrypt.compare(credentials.password, user.password));

        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          restaurantId: user.restaurantId,
        };
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
