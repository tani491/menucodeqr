import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getFirebaseAdminAuth } from "@/lib/firebaseAdmin";
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

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, password: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const firebasePasswordValid = await verifyFirebaseEmailPassword(user.email, currentPassword);
  const isCurrentPasswordValid =
    firebasePasswordValid ?? (await bcrypt.compare(currentPassword, user.password));
  if (!isCurrentPasswordValid) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });
  }

  try {
    await updateFirebaseAuthPassword(user.email, newPassword);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur Firebase Auth";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  return NextResponse.json({ ok: true });
}
