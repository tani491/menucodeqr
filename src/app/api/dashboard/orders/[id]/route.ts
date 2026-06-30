import { NextRequest, NextResponse } from "next/server";
import { requireActiveRestaurateur } from "@/lib/api-auth";
import { db } from "@/lib/db";

const NEXT_STATUS: Record<string, string[]> = {
  pending: ["confirmed"],
  confirmed: ["preparing"],
  preparing: ["ready"],
  ready: [],
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveRestaurateur();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const status = typeof body.status === "string" ? body.status : "";

  if (!["pending", "confirmed", "preparing", "ready"].includes(status)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  const current = await db.order.findFirst({
    where: {
      id,
      restaurantId: auth.restaurantId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!current) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  const allowedTargets = NEXT_STATUS[current.status] ?? [];
  if (status !== current.status && !allowedTargets.includes(status)) {
    return NextResponse.json({ error: "Transition de statut non autorisee" }, { status: 400 });
  }

  const order = await db.order.update({
    where: { id },
    data: { status },
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

  return NextResponse.json({ order });
}
