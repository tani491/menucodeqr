import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getFirebaseAdminFirestore } from "@/lib/firebaseAdmin";
import { upsertFirebaseRestaurateur } from "@/lib/firebaseUsers";
import bcrypt from "bcryptjs";

/**
 * POST /api/admin/create-user
 * Cree un compte restaurateur lie a un restaurant existant.
 * Reserve au super_admin.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  if (auth.role !== "super_admin") {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const body = await request.json();
  const { name, email, password, restaurantId } = body;

  if (!name || typeof name !== "string" || name.trim().length < 2 || name.length > 200) {
    return NextResponse.json({ error: "Nom invalide (2-200 caracteres)" }, { status: 400 });
  }

  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Mot de passe trop court (min. 6 caracteres)" }, { status: 400 });
  }

  if (!restaurantId || typeof restaurantId !== "string") {
    return NextResponse.json({ error: "Restaurant ID requis" }, { status: 400 });
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, slug: true },
  });

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant introuvable" }, { status: 404 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await db.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
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
      restaurantId: true,
      createdAt: true,
    },
  });

  let firebaseUserSynced = false;
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
    firebaseUserSynced = firebaseResult.synced;
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

  return NextResponse.json(
    {
      user,
      restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
      firebaseUserSynced,
      message: `Compte cree : ${user.email} -> ${restaurant.name}`,
    },
    { status: 201 }
  );
}
