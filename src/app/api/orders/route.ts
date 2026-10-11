import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orderInputSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const parsed = orderInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Commande invalide" }, { status: 400 });
  const { slug: restaurantSlug, tableNumber, customerName, customerPhone, notes, items: normalizedItems } = parsed.data;
  const restaurant = await db.restaurant.findUnique({
    where: { slug: restaurantSlug },
    select: { id: true, slug: true, isSuspended: true },
  });

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant introuvable" }, { status: 404 });
  }

  if (restaurant.isSuspended) {
    return NextResponse.json(
      { error: "Ce menu est temporairement indisponible. Veuillez contacter l'etablissement." },
      { status: 403 }
    );
  }

  const itemIds = normalizedItems.map((item) => item.itemId);
  const menuItems = await db.item.findMany({
    where: {
      id: { in: itemIds },
      restaurantId: restaurant.id,
      isAvailable: true,
    },
    select: {
      id: true,
      price: true,
    },
  });

  const itemMap = new Map(menuItems.map((item) => [item.id, item]));
  if (itemMap.size !== new Set(itemIds).size) {
    return NextResponse.json({ error: "Un ou plusieurs plats ne sont plus disponibles" }, { status: 400 });
  }

  const totalPrice = normalizedItems.reduce((total, item) => {
    const menuItem = itemMap.get(item.itemId)!;
    return total + menuItem.price * item.quantity;
  }, 0);

  const order = await db.order.create({
    data: {
      restaurantId: restaurant.id,
      tableNumber,
      customerName,
      customerPhone,
      notes: notes || null,
      status: "pending",
      totalPrice,
      items: {
        create: normalizedItems.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          priceAtPurchase: itemMap.get(item.itemId)!.price,
        })),
      },
    },
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

  return NextResponse.json({ order }, { status: 201 });
}
