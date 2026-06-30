import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getFirebaseAdminAuth } from "@/lib/firebaseAdmin";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

async function provisionFirebaseManager({
  email,
  name,
  restaurantId,
  request,
}: {
  email: string;
  name: string;
  restaurantId: string;
  request: NextRequest;
}) {
  const adminAuth = getFirebaseAdminAuth();

  if (!adminAuth) {
    return { synced: false, passwordSetupLink: null as string | null };
  }

  const normalizedEmail = email.trim().toLowerCase();
  let userRecord;

  try {
    userRecord = await adminAuth.getUserByEmail(normalizedEmail);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code !== "auth/user-not-found") {
      throw error;
    }

    userRecord = await adminAuth.createUser({
      email: normalizedEmail,
      displayName: name.trim(),
      emailVerified: false,
      disabled: false,
    });
  }

  await adminAuth.setCustomUserClaims(userRecord.uid, {
    role: "restaurateur",
    restaurantId,
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.nextUrl.origin;

  const passwordSetupLink = await adminAuth.generatePasswordResetLink(normalizedEmail, {
    url: `${baseUrl.replace(/\/$/, "")}/login`,
  });

  return { synced: true, passwordSetupLink };
}

/**
 * GET /api/admin/restaurants
 * Liste tous les restaurants avec leurs statistiques.
 * Réservé au super_admin — le JWT contient le rôle.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  // Vérification rôle super_admin — sécurité côté serveur
  if (auth.role !== "super_admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const restaurants = await db.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      bannerUrl: true,
      isSuspended: true,
      createdAt: true,
      _count: {
        select: {
          categories: true,
          users: true,
        },
      },
    },
  });

  // Compte les items par restaurant (relation indirecte via Category)
  const itemCounts = await db.item.groupBy({
    by: ["restaurantId"],
    _count: true,
  });
  const itemCountMap = Object.fromEntries(
    itemCounts.map((r) => [r.restaurantId, r._count])
  );

  const enriched = restaurants.map((r) => ({
    ...r,
    _count: {
      ...r._count,
      items: itemCountMap[r.id] ?? 0,
    },
  }));

  return NextResponse.json({ restaurants: enriched });
}

/**
 * POST /api/admin/restaurants
 * Crée un nouveau restaurant avec ses catégories par défaut.
 * Réservé au super_admin.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  if (auth.role !== "super_admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const { name, slug, managerEmail, logoUrl, bannerUrl, categories } = body;

  // ─── Validation backend stricte ──────────────────────────────────────────
  if (!name || typeof name !== "string" || name.trim().length < 2 || name.length > 200) {
    return NextResponse.json({ error: "Nom invalide (2-200 caractères)" }, { status: 400 });
  }

  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Slug requis" }, { status: 400 });
  }

  if (!managerEmail || typeof managerEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(managerEmail)) {
    return NextResponse.json({ error: "Email gerant invalide" }, { status: 400 });
  }

  // Slug : lettres, chiffres, tirets uniquement
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugRegex.test(slug) || slug.length < 2 || slug.length > 100) {
    return NextResponse.json(
      { error: "Slug invalide (minuscules, chiffres, tirets uniquement, ex: le-dakarois)" },
      { status: 400 }
    );
  }

  // Vérifie l'unicité du slug
  const normalizedManagerEmail = managerEmail.trim().toLowerCase();
  const existingManager = await db.user.findUnique({ where: { email: normalizedManagerEmail } });
  if (existingManager) {
    return NextResponse.json({ error: "Cet email est deja utilise" }, { status: 409 });
  }

  const existing = await db.restaurant.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Ce slug est déjà utilisé" }, { status: 409 });
  }

  // Catégories par défaut si non spécifiées
  const defaultCategories = [
    { nameFr: "Entrées", nameEn: "Starters", sortOrder: 1 },
    { nameFr: "Plats", nameEn: "Main Courses", sortOrder: 2 },
    { nameFr: "Desserts", nameEn: "Desserts", sortOrder: 3 },
    { nameFr: "Boissons", nameEn: "Drinks", sortOrder: 4 },
  ];

  const categoriesToCreate = Array.isArray(categories) && categories.length > 0
    ? categories.map((c: { nameFr: string; nameEn?: string; sortOrder?: number }, i: number) => ({
        nameFr: c.nameFr,
        nameEn: c.nameEn || c.nameFr,
        sortOrder: c.sortOrder ?? (i + 1),
      }))
    : defaultCategories;

  const restaurant = await db.restaurant.create({
    data: {
      slug,
      name: name.trim(),
      logoUrl: logoUrl || null,
      bannerUrl: bannerUrl || null,
      categories: { create: categoriesToCreate },
    },
    include: { categories: true },
  });

  let firebaseUserSynced = false;
  let passwordSetupLink: string | null = null;

  try {
    const firebaseResult = await provisionFirebaseManager({
      email: managerEmail,
      name: name.trim(),
      restaurantId: restaurant.id,
      request,
    });
    firebaseUserSynced = firebaseResult.synced;
    passwordSetupLink = firebaseResult.passwordSetupLink;
  } catch (error) {
    await db.restaurant.delete({ where: { id: restaurant.id } });
    const message = error instanceof Error ? error.message : "Erreur Firebase Auth";
    return NextResponse.json(
      { error: `Restaurant non cree: provisionnement Firebase impossible (${message})` },
      { status: 502 }
    );
  }

  try {
    if (firebaseUserSynced) {
      const temporaryPasswordHash = await bcrypt.hash(randomUUID(), 10);
      await db.user.create({
        data: {
          name: name.trim(),
          email: normalizedManagerEmail,
          password: temporaryPasswordHash,
          role: "restaurateur",
          restaurantId: restaurant.id,
        },
      });
    }
  } catch (error) {
    await db.restaurant.delete({ where: { id: restaurant.id } });
    const message = error instanceof Error ? error.message : "Erreur utilisateur local";
    return NextResponse.json(
      { error: `Restaurant non cree: liaison utilisateur impossible (${message})` },
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      ...restaurant,
      managerEmail: normalizedManagerEmail,
      firebaseUserSynced,
      passwordSetupLink,
    },
    { status: 201 }
  );
}
