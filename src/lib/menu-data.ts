import { getApp, getApps, initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore, query, where, type Firestore } from "firebase/firestore";
import { cache } from "react";

// ─── Types publics ──────────────────────────────────────────────────────────

export type Lang = "fr" | "en";

export interface MenuItem {
  id: string;
  nameFr: string;
  nameEn: string;
  descriptionFr: string | null;
  descriptionEn: string | null;
  price: number;
  imageUrl: string | null;
  videoUrl: string | null;
  isAvailable: boolean;
  categoryId: string;
}

export interface MenuCategory {
  id: string;
  nameFr: string;
  nameEn: string;
  sortOrder: number;
  itemCount: number;
}

export interface MenuRestaurant {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  isSuspended: boolean;
}

export interface MenuData {
  restaurant: MenuRestaurant;
  categories: MenuCategory[];
  items: MenuItem[];
}

// ─── In-memory cache pour les requêtes répétées (anti-crash) ────────────────

const menuCache = new Map<string, { data: MenuData; timestamp: number }>();
const CACHE_TTL_MS = 60_000; // 60 secondes de cache en mémoire

let cachedFirestoreDb: Firestore | null | undefined;

type FirestoreRecord = Record<string, unknown>;

function getMenuFirestoreDb() {
  if (cachedFirestoreDb !== undefined) {
    return cachedFirestoreDb;
  }

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    cachedFirestoreDb = null;
    return cachedFirestoreDb;
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  cachedFirestoreDb = getFirestore(app);
  return cachedFirestoreDb;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableStringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function sortableDateValue(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis: () => number }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

// ─── Data fetcher avec cache ISR-like ───────────────────────────────────────

async function _getMenuBySlug(slug: string): Promise<MenuData | null> {
  // Vérifie le cache en mémoire
  const cached = menuCache.get(slug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const db = getMenuFirestoreDb();
  if (!db) return null;

  const restaurantsSnapshot = await getDocs(
    query(collection(db, "restaurants"), where("slug", "==", slug))
  );

  const restaurantDoc = restaurantsSnapshot.docs[0];
  if (!restaurantDoc) return null;

  const restaurantData = restaurantDoc.data() as FirestoreRecord;
  const restaurantId = stringValue(restaurantData.id, restaurantDoc.id);

  const [categoriesSnapshot, itemsSnapshot] = await Promise.all([
    getDocs(
      query(collection(db, "categories"), where("restaurantId", "==", restaurantId))
    ),
    getDocs(
      query(collection(db, "items"), where("restaurantId", "==", restaurantId))
    ),
  ]);

  const items: MenuItem[] = itemsSnapshot.docs
    .map((itemDoc) => {
      const item = itemDoc.data() as FirestoreRecord;

      return {
        id: stringValue(item.id, itemDoc.id),
        nameFr: stringValue(item.nameFr),
        nameEn: stringValue(item.nameEn),
        descriptionFr: nullableStringValue(item.descriptionFr),
        descriptionEn: nullableStringValue(item.descriptionEn),
        price: numberValue(item.price),
        imageUrl: nullableStringValue(item.imageUrl),
        videoUrl: nullableStringValue(item.videoUrl),
        isAvailable: booleanValue(item.isAvailable, true),
        categoryId: stringValue(item.categoryId),
        createdAt: sortableDateValue(item.createdAt),
      };
    })
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(({ createdAt: _createdAt, ...item }) => item);

  const itemCountByCategory = items.reduce<Record<string, number>>((counts, item) => {
    counts[item.categoryId] = (counts[item.categoryId] ?? 0) + 1;
    return counts;
  }, {});

  const categories: MenuCategory[] = categoriesSnapshot.docs
    .map((categoryDoc) => {
      const category = categoryDoc.data() as FirestoreRecord;
      const categoryId = stringValue(category.id, categoryDoc.id);

      return {
        id: categoryId,
        nameFr: stringValue(category.nameFr),
        nameEn: stringValue(category.nameEn),
        sortOrder: numberValue(category.sortOrder),
        itemCount: itemCountByCategory[categoryId] ?? 0,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const data: MenuData = {
    restaurant: {
      id: restaurantId,
      slug: stringValue(restaurantData.slug, slug),
      name: stringValue(restaurantData.name),
      logoUrl: nullableStringValue(restaurantData.logoUrl),
      bannerUrl: nullableStringValue(restaurantData.bannerUrl),
      primaryColor: stringValue(restaurantData.primaryColor, "#000000"),
      isSuspended: booleanValue(restaurantData.isSuspended),
    },
    categories,
    items,
  };

  // Met en cache
  menuCache.set(slug, { data, timestamp: Date.now() });

  return data;
}

// React cache() déduplique les appels au sein d'un même rendu serveur
export const getMenuBySlug = cache(_getMenuBySlug);

/**
 * Invalide le cache pour un slug donné (utile après une mise à jour).
 */
export function invalidateMenuCache(slug: string) {
  menuCache.delete(slug);
}

/**
 * Liste tous les slugs disponibles (pour generateStaticParams).
 */
export const getAllRestaurantSlugs = cache(async (): Promise<string[]> => {
  const db = getMenuFirestoreDb();
  if (!db) return [];

  const restaurantsSnapshot = await getDocs(collection(db, "restaurants"));

  return restaurantsSnapshot.docs
    .map((restaurantDoc) => stringValue((restaurantDoc.data() as FirestoreRecord).slug))
    .filter(Boolean);
});
