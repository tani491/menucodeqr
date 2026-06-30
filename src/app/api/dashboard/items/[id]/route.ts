import { NextRequest, NextResponse } from "next/server";
import { requireActiveRestaurateur } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { invalidateMenuCache } from "@/lib/menu-data";

/**
 * PUT /api/dashboard/items/[id] — Mettre à jour un plat
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveRestaurateur();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();

  const existing = await db.item.findFirst({
    where: { id, restaurantId: auth.restaurantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Plat introuvable ou non autorisé" }, { status: 404 });
  }

  if (body.categoryId && body.categoryId !== existing.categoryId) {
    const category = await db.category.findFirst({
      where: { id: body.categoryId, restaurantId: auth.restaurantId },
    });
    if (!category) {
      return NextResponse.json({ error: "Catégorie non autorisée" }, { status: 403 });
    }
  }

  const updated = await db.item.update({
    where: { id },
    data: {
      ...(body.nameFr !== undefined && { nameFr: body.nameFr.trim() }),
      ...(body.nameEn !== undefined && { nameEn: body.nameEn.trim() }),
      ...(body.descriptionFr !== undefined && { descriptionFr: body.descriptionFr?.trim() || null }),
      ...(body.descriptionEn !== undefined && { descriptionEn: body.descriptionEn?.trim() || null }),
      ...(body.price !== undefined && { price: Math.round(body.price * 100) / 100 }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl || null }),
      ...(body.videoUrl !== undefined && { videoUrl: body.videoUrl || null }),
      ...(body.isAvailable !== undefined && { isAvailable: body.isAvailable }),
    },
  });

  const restaurant = await db.restaurant.findUnique({ where: { id: auth.restaurantId }, select: { slug: true } });
  if (restaurant) invalidateMenuCache(restaurant.slug);

  return NextResponse.json(updated);
}

/**
 * DELETE /api/dashboard/items/[id] — Supprimer un plat
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveRestaurateur();
  if (auth.error) return auth.error;

  const { id } = await params;

  const existing = await db.item.findFirst({
    where: { id, restaurantId: auth.restaurantId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Plat introuvable ou non autorisé" }, { status: 404 });
  }

  await db.item.delete({ where: { id } });

  const restaurant = await db.restaurant.findUnique({ where: { id: auth.restaurantId }, select: { slug: true } });
  if (restaurant) invalidateMenuCache(restaurant.slug);

  return NextResponse.json({ ok: true });
}
