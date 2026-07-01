import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { db as prismaDb } from "@/lib/db";
import * as admin from "firebase-admin";

type FirestoreDocumentReference = {
  id: string;
};

type FirestoreBatch = {
  set: (
    ref: FirestoreDocumentReference,
    data: Record<string, unknown>,
    options?: { merge?: boolean }
  ) => void;
  commit: () => Promise<void>;
};

type FirestoreCompat = {
  collection: (name: string) => {
    doc: (id?: string) => FirestoreDocumentReference;
    where: (
      field: string,
      operator: string,
      value: unknown
    ) => {
      limit: (count: number) => {
        get: () => Promise<{ empty: boolean }>;
      };
    };
  };
  batch: () => FirestoreBatch;
};

type FirebaseAuthCompat = {
  getUserByEmail: (email: string) => Promise<{ uid: string }>;
  createUser: (user: {
    email: string;
    displayName: string;
    emailVerified: boolean;
    disabled: boolean;
  }) => Promise<{ uid: string }>;
  setCustomUserClaims: (
    uid: string,
    claims: { role: string; restaurantId: string }
  ) => Promise<void>;
  generatePasswordResetLink: (
    email: string,
    options: { url: string }
  ) => Promise<string>;
};

type FirebaseAdminCompat = typeof admin & {
  apps?: unknown[];
  initializeApp?: (options: Record<string, unknown>) => unknown;
  credential?: {
    cert?: (serviceAccount: {
      projectId?: string;
      clientEmail?: string;
      privateKey?: string;
    }) => unknown;
  };
  firestore?: () => FirestoreCompat;
  auth?: () => FirebaseAuthCompat;
};

type AdminRouteAuth =
  | { error: NextResponse }
  | { error?: undefined; role: string };

const firebaseAdmin = admin as FirebaseAdminCompat;

const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : undefined;

function ensureFirebaseAdmin() {
  if (!firebaseAdmin || !firebaseAdmin.apps || firebaseAdmin.apps.length === 0) {
    if (!firebaseAdmin.initializeApp || !firebaseAdmin.credential?.cert) {
      throw new Error("Firebase Admin SDK non disponible");
    }

    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
}

function getFirestore() {
  ensureFirebaseAdmin();

  if (!firebaseAdmin.firestore) {
    throw new Error("Firestore Admin non disponible");
  }

  return firebaseAdmin.firestore();
}

function getFirebaseAuth() {
  ensureFirebaseAdmin();

  if (!firebaseAdmin.auth) {
    throw new Error("Firebase Auth Admin non disponible");
  }

  return firebaseAdmin.auth();
}

async function requireAdmin(request: NextRequest): Promise<AdminRouteAuth> {
  const token = await getToken({
    req: request,
    secret:
      process.env.NEXTAUTH_SECRET ||
      "dev-secret-change-in-production-menu-qr-v1",
  });

  if (!token) {
    return {
      error: NextResponse.json({ error: "Non autorise" }, { status: 401 }),
    };
  }

  const tokenRole = (token as { role?: unknown }).role;
  const role = typeof tokenRole === "string" ? tokenRole : "";

  if (role !== "super_admin" && role !== "admin") {
    return {
      error: NextResponse.json({ error: "Acces refuse" }, { status: 403 }),
    };
  }

  return { role };
}

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
  const adminAuth = getFirebaseAuth();
  const normalizedEmail = email.trim().toLowerCase();
  let userRecord: { uid: string };

  try {
    userRecord = await adminAuth.getUserByEmail(normalizedEmail);
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "";

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

  const passwordSetupLink = await adminAuth.generatePasswordResetLink(
    normalizedEmail,
    {
      url: `${baseUrl.replace(/\/$/, "")}/login`,
    }
  );

  return { synced: true, uid: userRecord.uid, passwordSetupLink };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const restaurants = await prismaDb.restaurant.findMany({
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

  const itemCounts = await prismaDb.item.groupBy({
    by: ["restaurantId"],
    _count: true,
  });
  const itemCountMap = Object.fromEntries(
    itemCounts.map((r) => [r.restaurantId, r._count])
  );

  const enriched = restaurants.map((restaurant) => ({
    ...restaurant,
    _count: {
      ...restaurant._count,
      items: itemCountMap[restaurant.id] ?? 0,
    },
  }));

  return NextResponse.json({ restaurants: enriched });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { name, slug, managerEmail, logoUrl, bannerUrl, categories } = body;

    if (
      !name ||
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.length > 200
    ) {
      return NextResponse.json(
        { error: "Nom invalide (2-200 caracteres)" },
        { status: 400 }
      );
    }

    if (!slug || typeof slug !== "string") {
      return NextResponse.json({ error: "Slug requis" }, { status: 400 });
    }

    if (
      !managerEmail ||
      typeof managerEmail !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(managerEmail)
    ) {
      return NextResponse.json(
        { error: "Email gerant invalide" },
        { status: 400 }
      );
    }

    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug) || slug.length < 2 || slug.length > 100) {
      return NextResponse.json(
        {
          error:
            "Slug invalide (minuscules, chiffres, tirets uniquement, ex: le-dakarois)",
        },
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
            (
              category: { nameFr: string; nameEn?: string; sortOrder?: number },
              index: number
            ) => ({
              nameFr: category.nameFr,
              nameEn: category.nameEn || category.nameFr,
              sortOrder: category.sortOrder ?? index + 1,
            })
          )
        : defaultCategories;

    const firestore = getFirestore();

    const existingSlug = await firestore
      .collection("restaurants")
      .where("slug", "==", slug)
      .limit(1)
      .get();

    if (!existingSlug.empty) {
      return NextResponse.json(
        { error: "Ce slug est deja utilise" },
        { status: 409 }
      );
    }

    const existingUser = await firestore
      .collection("users")
      .where("email", "==", normalizedManagerEmail)
      .limit(1)
      .get();

    if (!existingUser.empty) {
      return NextResponse.json(
        { error: "Cet email est deja utilise" },
        { status: 409 }
      );
    }

    const restaurantRef = firestore.collection("restaurants").doc();
    const restaurantId = restaurantRef.id;

    const firebaseResult = await provisionFirebaseManager({
      email: normalizedManagerEmail,
      name: name.trim(),
      restaurantId,
      request,
    });

    const now = new Date().toISOString();
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

    return NextResponse.json(
      {
        success: true,
        ...restaurantData,
        categories: createdCategories,
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
    console.error("Erreur création restaurant Firestore:", error);
    const message = error instanceof Error ? error.message : "Erreur Firestore";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
