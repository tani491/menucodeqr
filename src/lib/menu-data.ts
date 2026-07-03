import { getApp, getApps, initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore, query, where, type Firestore } from "firebase/firestore";
import { getFirebasePublicConfig } from "./firebaseConfig";
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
const CACHE_TTL_MS = 0; // Le statut de suspension doit etre relu a chaque requete publique.

let cachedFirestoreDb: Firestore | null | undefined;

type FirestoreRecord = Record<string, unknown>;

function getMenuFirestoreDb() {
  if (cachedFirestoreDb !== undefined) {
    return cachedFirestoreDb;
  }

  const app = getApps().length ? getApp() : initializeApp(getFirebasePublicConfig());
  cachedFirestoreDb = getFirestore(app);
  return cachedFirestoreDb;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableStringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function firstStringValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function restaurantColorValue(restaurant: FirestoreRecord) {
  return (
    firstStringValue(
      restaurant.primaryColor,
      restaurant.couleur,
      restaurant.color,
      "#000000"
    ) || "#000000"
  );
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
  const restaurantIsSuspended =
    stringValue(restaurantData.status) === "suspended" ||
    booleanValue(restaurantData.isSuspended);

  if (restaurantIsSuspended) {
    return {
      restaurant: {
        id: restaurantId,
        slug: stringValue(restaurantData.slug, slug),
        name: stringValue(restaurantData.name),
        logoUrl: nullableStringValue(restaurantData.logoUrl),
        bannerUrl: nullableStringValue(restaurantData.bannerUrl),
        primaryColor: restaurantColorValue(restaurantData),
        isSuspended: true,
      },
      categories: [],
      items: [],
    };
  }

  const [categoriesSnapshot, dishesSnapshot, itemsSnapshot] = await Promise.all([
    getDocs(
      query(collection(db, "categories"), where("restaurantId", "==", restaurantId))
    ),
    getDocs(
      query(collection(db, "dishes"), where("restaurantId", "==", restaurantId))
    ),
    getDocs(
      query(collection(db, "items"), where("restaurantId", "==", restaurantId))
    ),
  ]);

  const dishIds = new Set(dishesSnapshot.docs.map((dishDoc) => dishDoc.id));
  const itemDocs = [
    ...dishesSnapshot.docs,
    ...itemsSnapshot.docs.filter((itemDoc) => !dishIds.has(itemDoc.id)),
  ];

  const items: MenuItem[] = itemDocs
    .map((itemDoc) => {
      const item = itemDoc.data() as FirestoreRecord;
      const status = typeof item.status === "string" ? item.status : "";

      return {
        id: stringValue(item.id, itemDoc.id),
        nameFr: stringValue(item.nameFr, stringValue(item.name)),
        nameEn: stringValue(item.nameEn, stringValue(item.name)),
        descriptionFr: nullableStringValue(item.descriptionFr) || nullableStringValue(item.description),
        descriptionEn: nullableStringValue(item.descriptionEn),
        price: numberValue(item.price),
        imageUrl: nullableStringValue(item.imageUrl),
        videoUrl: nullableStringValue(item.videoUrl),
        isAvailable: status ? status === "available" : booleanValue(item.isAvailable, true),
        categoryId: stringValue(item.categoryId, stringValue(item.category)),
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
      primaryColor: restaurantColorValue(restaurantData),
      isSuspended: restaurantIsSuspended,
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
