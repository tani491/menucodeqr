import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRestaurateur } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireRestaurateur();
  if (auth.error) return auth.error;

  const order = await db.order.findFirst({
    where: { id, restaurantId: auth.restaurantId },
    include: {
      restaurant: {
        select: {
          slug: true,
          name: true,
          primaryColor: true,
        },
      },
      items: {
        include: {
          item: {
            select: {
              id: true,
              nameFr: true,
              nameEn: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  return NextResponse.json({ order });
}

