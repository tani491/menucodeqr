import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { invalidateMenuCache } from "@/lib/menu-data";

/**
 * GET /api/admin/restaurants/[id]
 * Détail d'un restaurant avec ses utilisateurs.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  if (auth.role !== "super_admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;

  const restaurant = await db.restaurant.findUnique({
    where: { id },
    include: {
      categories: { orderBy: { sortOrder: "asc" } },
      users: {
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      },
    },
  });

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant introuvable" }, { status: 404 });
  }

  return NextResponse.json(restaurant);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  if (auth.role !== "super_admin") {
    return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  if (typeof body.isSuspended !== "boolean") {
    return NextResponse.json({ error: "Statut de suspension invalide" }, { status: 400 });
  }

  const restaurant = await db.restaurant.update({
    where: { id },
    data: { isSuspended: body.isSuspended },
    select: {
      id: true,
      slug: true,
      isSuspended: true,
    },
  });

  invalidateMenuCache(restaurant.slug);

  return NextResponse.json({ restaurant });
}

/**
 * DELETE /api/admin/restaurants/[id]
 * Supprime un restaurant et toutes ses données en cascade.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  if (auth.role !== "super_admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;

  const restaurant = await db.restaurant.findUnique({ where: { id }, select: { slug: true } });
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant introuvable" }, { status: 404 });
  }

  await db.restaurant.delete({ where: { id } });
  invalidateMenuCache(restaurant.slug);

  return NextResponse.json({ ok: true });
}
