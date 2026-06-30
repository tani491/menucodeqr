import { NextResponse } from "next/server";
import { requireRestaurateur } from "@/lib/api-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireRestaurateur();
  if (auth.error) return auth.error;

  const orders = await db.order.findMany({
    where: { restaurantId: auth.restaurantId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
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

  return NextResponse.json({
    orders,
    restaurantIsSuspended: auth.restaurantIsSuspended,
  });
}
