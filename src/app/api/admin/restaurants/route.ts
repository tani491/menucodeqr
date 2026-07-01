import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

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
    return { synced: false, uid: null as string | null, passwordSetupLink: null as string | null };
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

  return { synced: true, uid: userRecord.uid, passwordSetupLink };
}

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  if (auth.role !== "super_admin") {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
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

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  if (auth.role !== "super_admin" && auth.role !== "admin") {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const body = await request.json();
  const { name, slug, managerEmail, logoUrl, bannerUrl, categories } = body;

  if (!name || typeof name !== "string" || name.trim().length < 2 || name.length > 200) {
    return NextResponse.json({ error: "Nom invalide (2-200 caracteres)" }, { status: 400 });
  }

  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Slug requis" }, { status: 400 });
  }

  if (
    !managerEmail ||
    typeof managerEmail !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(managerEmail)
  ) {
    return NextResponse.json({ error: "Email gerant invalide" }, { status: 400 });
  }

  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugRegex.test(slug) || slug.length < 2 || slug.length > 100) {
    return NextResponse.json(
      { error: "Slug invalide (minuscules, chiffres, tirets uniquement, ex: le-dakarois)" },
      { status: 400 }
    );
  }

  const normalizedManagerEmail = managerEmail.trim().toLowerCase();

  const defaultCategories = [
    { nameFr: "Entrees", nameEn: "Starters", sortOrder: 1 },
    { nameFr: "Plats", nameEn: "Main Courses", sortOrder: 2 },
    { nameFr: "Desserts", nameEn: "Desserts", sortOrder: 3 },
    { nameFr: "Boissons", nameEn: "Drinks", sortOrder: 4 },
  ];

  const categoriesToCreate =
    Array.isArray(categories) && categories.length > 0
      ? categories.map(
          (category: { nameFr: string; nameEn?: string; sortOrder?: number }, index: number) => ({
            nameFr: category.nameFr,
            nameEn: category.nameEn || category.nameFr,
            sortOrder: category.sortOrder ?? index + 1,
          })
        )
      : defaultCategories;

  try {
    const firestore = getFirebaseAdminFirestore();

    if (!firestore) {
      return NextResponse.json(
        { error: "Configuration Firestore indisponible" },
        { status: 500 }
      );
    }

    const existingSlug = await firestore
      .collection("restaurants")
      .where("slug", "==", slug)
      .limit(1)
      .get();

    if (!existingSlug.empty) {
      return NextResponse.json({ error: "Ce slug est deja utilise" }, { status: 409 });
    }

    const existingUser = await firestore
      .collection("users")
      .where("email", "==", normalizedManagerEmail)
      .limit(1)
      .get();

    if (!existingUser.empty) {
      return NextResponse.json({ error: "Cet email est deja utilise" }, { status: 409 });
    }

    const restaurantRef = firestore.collection("restaurants").doc();
    const restaurantId = restaurantRef.id;

    const firebaseResult = await provisionFirebaseManager({
      email: normalizedManagerEmail,
      name: name.trim(),
      restaurantId,
      request,
    });

    if (!firebaseResult.synced || !firebaseResult.uid) {
      return NextResponse.json(
        { error: "Restaurant non cree: provisionnement Firebase impossible" },
        { status: 502 }
      );
    }

    const now = FieldValue.serverTimestamp();
    const batch = firestore.batch();

    const restaurantData = {
      id: restaurantId,
      name: name.trim(),
      slug,
      userId: firebaseResult.uid,
      managerEmail: normalizedManagerEmail,
      logoUrl: logoUrl || null,
      bannerUrl: bannerUrl || null,
      primaryColor: "#000000",
      isSuspended: false,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    const createdCategories = categoriesToCreate.map((category) => {
      const categoryRef = firestore.collection("categories").doc();
      const categoryData = {
        id: categoryRef.id,
        restaurantId,
        nameFr: category.nameFr,
        nameEn: category.nameEn,
        sortOrder: category.sortOrder,
        createdAt: now,
        updatedAt: now,
      };

      batch.set(categoryRef, categoryData);
      return categoryData;
    });

    batch.set(restaurantRef, restaurantData);
    batch.set(
      firestore.collection("users").doc(firebaseResult.uid),
      {
        id: firebaseResult.uid,
        name: name.trim(),
        email: normalizedManagerEmail,
        role: "restaurateur",
        restaurantId,
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    await batch.commit();

    const timestamp = new Date().toISOString();

    return NextResponse.json(
      {
        ...restaurantData,
        createdAt: timestamp,
        updatedAt: timestamp,
        categories: createdCategories.map((category) => ({
          ...category,
          createdAt: timestamp,
          updatedAt: timestamp,
        })),
        _count: {
          categories: createdCategories.length,
          users: 1,
          items: 0,
        },
        firebaseUserSynced: firebaseResult.synced,
        passwordSetupLink: firebaseResult.passwordSetupLink,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erreur Firestore Restaurant:", error);
    const message = error instanceof Error ? error.message : "Erreur Firestore";
    return NextResponse.json(
      { error: `Restaurant non cree: ${message}` },
      { status: 500 }
    );
  }
}
