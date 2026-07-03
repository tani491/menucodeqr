import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getFirebaseAdminFirestore } from "@/lib/firebaseAdmin";
import { upsertFirebaseRestaurateur } from "@/lib/firebaseUsers";
import bcrypt from "bcryptjs";

/**
 * POST /api/admin/restaurants/[id]/users
 * Cree un compte restaurateur lie a un restaurant.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  if (auth.role !== "super_admin") {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const { id: restaurantId } = await params;
  const body = await request.json();
  const { name, email, password } = body;

  if (!name || typeof name !== "string" || name.trim().length < 1) {
    return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Mot de passe : minimum 6 caracteres" }, { status: 400 });
  }

  const restaurant = await db.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant introuvable" }, { status: 404 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "Cet email est deja utilise" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await db.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "restaurateur",
      restaurantId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  let firebaseUid: string | null = null;

  try {
    const firebaseResult = await upsertFirebaseRestaurateur({
      name: user.name,
      email: user.email,
      password,
      restaurantId,
    });
    if (!firebaseResult.synced || !firebaseResult.uid) {
      throw new Error("Firebase Admin Auth n'est pas configure");
    }
    firebaseUid = firebaseResult.uid;
  } catch (error) {
    await db.user.delete({ where: { id: user.id } });
    const message = error instanceof Error ? error.message : "Erreur Firebase Auth";
    return NextResponse.json(
      { error: `Compte non cree: provisionnement Firebase impossible (${message})` },
      { status: 502 }
    );
  }

  const firestore = getFirebaseAdminFirestore();
  if (firestore && firebaseUid) {
    const now = new Date().toISOString();
    await firestore.collection("users").doc(firebaseUid).set(
      {
        id: firebaseUid,
        uid: firebaseUid,
        name: user.name,
        email: user.email,
        role: "restaurateur",
        restaurantId,
        status: "active",
        authProvider: "firebase",
        mustChangePassword: true,
        initialPasswordCreatedAt: now,
        passwordUpdatedAt: null,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  return NextResponse.json(user, { status: 201 });
}
