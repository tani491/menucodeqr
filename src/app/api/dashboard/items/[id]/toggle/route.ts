import { NextRequest, NextResponse } from "next/server";
import { requireActiveRestaurateur } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { invalidateMenuCache } from "@/lib/menu-data";

/**
 * PATCH /api/dashboard/items/[id]/toggle
 * Bascule instantanément is_available d'un plat.
 * Sécurité : vérifie que l'item appartient au restaurant du JWT.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveRestaurateur();
  if (auth.error) return auth.error;

  const { id } = await params;

  const item = await db.item.findFirst({
    where: { id, restaurantId: auth.restaurantId },
  });

  if (!item) {
    return NextResponse.json({ error: "Plat introuvable ou non autorisé" }, { status: 404 });
  }

  const updated = await db.item.update({
    where: { id },
    data: { isAvailable: !item.isAvailable },
  });

  const restaurant = await db.restaurant.findUnique({
    where: { id: auth.restaurantId },
    select: { slug: true },
  });
  if (restaurant) {
    invalidateMenuCache(restaurant.slug);
  }

  return NextResponse.json({ id: updated.id, isAvailable: updated.isAvailable });
}
