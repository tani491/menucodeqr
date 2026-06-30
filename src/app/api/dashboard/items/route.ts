import { NextRequest, NextResponse } from "next/server";
import { requireActiveRestaurateur } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { invalidateMenuCache } from "@/lib/menu-data";

/**
 * POST /api/dashboard/items — Créer un nouveau plat
 * Sécurité : le restaurantId est imposé depuis le JWT, pas le body.
 */
export async function POST(request: NextRequest) {
  const auth = await requireActiveRestaurateur();
  if (auth.error) return auth.error;

  const body = await request.json();
  const { nameFr, nameEn, descriptionFr, descriptionEn, price, categoryId, imageUrl, videoUrl, isAvailable } = body;

  if (!nameFr || typeof nameFr !== "string" || nameFr.trim().length < 1 || nameFr.length > 200) {
    return NextResponse.json({ error: "Nom (FR) invalide (1-200 caractères)" }, { status: 400 });
  }
  if (typeof price !== "number" || price < 0 || price > 99999) {
    return NextResponse.json({ error: "Prix invalide" }, { status: 400 });
  }
  if (!categoryId || typeof categoryId !== "string") {
    return NextResponse.json({ error: "Catégorie requise" }, { status: 400 });
  }

  const category = await db.category.findFirst({
    where: { id: categoryId, restaurantId: auth.restaurantId },
  });
  if (!category) {
    return NextResponse.json({ error: "Catégorie introuvable ou non autorisée" }, { status: 403 });
  }

  const item = await db.item.create({
    data: {
      restaurantId: auth.restaurantId,
      categoryId,
      nameFr: nameFr.trim(),
      nameEn: (nameEn && typeof nameEn === "string") ? nameEn.trim() : nameFr.trim(),
      descriptionFr: descriptionFr?.trim() || null,
      descriptionEn: descriptionEn?.trim() || null,
      price: Math.round(price * 100) / 100,
      imageUrl: imageUrl || null,
      videoUrl: videoUrl || null,
      isAvailable: isAvailable !== false,
    },
  });

  const restaurant = await db.restaurant.findUnique({ where: { id: auth.restaurantId }, select: { slug: true } });
  if (restaurant) invalidateMenuCache(restaurant.slug);

  return NextResponse.json(item, { status: 201 });
}
