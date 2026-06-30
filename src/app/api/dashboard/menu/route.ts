import { NextResponse } from "next/server";
import { requireRestaurateur } from "@/lib/api-auth";
import { db } from "@/lib/db";

/**
 * GET /api/dashboard/menu
 * Retourne toutes les catégories et items du restaurant de l'utilisateur connecté.
 * Sécurité : pas de restaurantId en paramètre — il vient du JWT.
 */
export async function GET() {
  const auth = await requireRestaurateur();
  if (auth.error) return auth.error;

  // Invalide le cache public pour que les changements soient visibles immédiatement
  const { invalidateMenuCache } = await import("@/lib/menu-data");
  const restaurant = await db.restaurant.findUnique({
    where: { id: auth.restaurantId },
    select: { slug: true, name: true, logoUrl: true, bannerUrl: true, primaryColor: true, isSuspended: true },
  });
  if (restaurant) {
    invalidateMenuCache(restaurant.slug);
  }

  const [categories, items] = await Promise.all([
    db.category.findMany({
      where: { restaurantId: auth.restaurantId },
      orderBy: { sortOrder: "asc" },
    }),
    db.item.findMany({
      where: { restaurantId: auth.restaurantId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return NextResponse.json({
    categories,
    items,
    restaurantId: auth.restaurantId,
    restaurantName: restaurant?.name ?? null,
    restaurantSlug: restaurant?.slug ?? null,
    restaurantLogoUrl: restaurant?.logoUrl ?? null,
    restaurantBannerUrl: restaurant?.bannerUrl ?? null,
    restaurantPrimaryColor: restaurant?.primaryColor ?? "#000000",
    restaurantIsSuspended: restaurant?.isSuspended ?? false,
  });
}
