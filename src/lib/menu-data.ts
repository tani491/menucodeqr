import { db } from "@/lib/db";
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

// ─── Data fetcher avec cache ISR-like ───────────────────────────────────────

async function _getMenuBySlug(slug: string): Promise<MenuData | null> {
  // Vérifie le cache en mémoire
  const cached = menuCache.get(slug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
  });

  if (!restaurant) return null;

  // Requêtes parallélisées : catégories + items en même temps
  const [categories, items] = await Promise.all([
    db.category.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        nameFr: true,
        nameEn: true,
        sortOrder: true,
        _count: { select: { items: true } },
      },
    }),
    db.item.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        nameFr: true,
        nameEn: true,
        descriptionFr: true,
        descriptionEn: true,
        price: true,
        imageUrl: true,
        videoUrl: true,
        isAvailable: true,
        categoryId: true,
      },
    }),
  ]);

  const data: MenuData = {
    restaurant: {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      logoUrl: restaurant.logoUrl,
      bannerUrl: restaurant.bannerUrl,
      primaryColor: restaurant.primaryColor,
      isSuspended: restaurant.isSuspended,
    },
    categories: categories.map((c) => ({
      id: c.id,
      nameFr: c.nameFr,
      nameEn: c.nameEn,
      sortOrder: c.sortOrder,
      itemCount: c._count.items,
    })),
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
  const restaurants = await db.restaurant.findMany({
    select: { slug: true },
  });
  return restaurants.map((r) => r.slug);
});
