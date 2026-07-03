import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getFirebasePublicConfig } from "@/lib/firebaseConfig";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebaseAdmin";
import { verifyFirebaseEmailPassword } from "@/lib/firebaseAuth";

async function updateFirebaseAuthPassword(email: string, newPassword: string) {
  const adminAuth = getFirebaseAdminAuth();

  if (!adminAuth) {
    return { skipped: true };
  }

  try {
    const user = await adminAuth.getUserByEmail(email);
    await adminAuth.updateUser(user.uid, { password: newPassword });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "auth/user-not-found") {
      throw new Error("Utilisateur Firebase Auth introuvable");
    }
    throw new Error("Impossible de modifier le mot de passe Firebase Auth");
  }

  return { skipped: false };
}

async function updateFirebaseAuthPasswordWithCurrentPassword(
  email: string,
  currentPassword: string,
  newPassword: string
) {
  const apiKey = getFirebasePublicConfig().apiKey;

  if (!apiKey) {
    throw new Error("Configuration Firebase publique incomplete");
  }

  const signInResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: currentPassword,
        returnSecureToken: true,
      }),
      cache: "no-store",
    }
  );

  if (!signInResponse.ok) {
    throw new Error("Mot de passe actuel incorrect");
  }

  const signInData = (await signInResponse.json()) as { idToken?: string };
  if (!signInData.idToken) {
    throw new Error("Session Firebase invalide");
  }

  const updateResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken: signInData.idToken,
        password: newPassword,
        returnSecureToken: false,
      }),
      cache: "no-store",
    }
  );

  if (!updateResponse.ok) {
    throw new Error("Impossible de modifier le mot de passe Firebase Auth");
  }
}

async function updateFirestorePasswordState(userId: string) {
  const firestore = getFirebaseAdminFirestore();
  if (!firestore) return;

  const now = new Date().toISOString();
  await firestore.collection("users").doc(userId).set(
    {
      mustChangePassword: false,
      passwordUpdatedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await request.json();
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Mot de passe requis" }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "Le nouveau mot de passe doit contenir au moins 8 caracteres" },
      { status: 400 }
    );
  }

  const user = await db.user
    .findUnique({
      where: { id: auth.userId },
      select: { id: true, email: true, password: true },
    })
    .catch(() => null);

  const sessionEmail =
    typeof auth.session.user?.email === "string" && auth.session.user.email.trim()
      ? auth.session.user.email.trim().toLowerCase()
      : "";
  const accountEmail = user?.email || sessionEmail;

  if (!accountEmail) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const firebasePasswordValid = await verifyFirebaseEmailPassword(accountEmail, currentPassword);
  const prismaPasswordValid = user?.password
    ? await bcrypt.compare(currentPassword, user.password)
    : false;
  const isCurrentPasswordValid =
    firebasePasswordValid === true || (firebasePasswordValid === null && prismaPasswordValid);

  if (!isCurrentPasswordValid) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });
  }

  try {
    const adminUpdate = await updateFirebaseAuthPassword(accountEmail, newPassword);
    if (adminUpdate.skipped) {
      await updateFirebaseAuthPasswordWithCurrentPassword(accountEmail, currentPassword, newPassword);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur Firebase Auth";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  if (user) {
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });
  }

  await updateFirestorePasswordState(auth.userId);

  return NextResponse.json({ ok: true });
}
