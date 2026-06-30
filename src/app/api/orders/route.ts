import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type CartPayloadItem = {
  itemId: string;
  quantity: number;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const restaurantSlug = cleanText(body.restaurantSlug, 100);
  const tableNumber = cleanText(body.tableNumber, 20);
  const customerName = cleanText(body.customerName, 120);
  const customerPhone = cleanText(body.customerPhone, 40);
  const notes = cleanText(body.notes, 500);
  const items = Array.isArray(body.items) ? (body.items as CartPayloadItem[]) : [];

  if (!restaurantSlug || !tableNumber || !customerName || !customerPhone) {
    return NextResponse.json({ error: "Informations client incompletes" }, { status: 400 });
  }

  const normalizedItems = items
    .map((item) => ({
      itemId: typeof item.itemId === "string" ? item.itemId : "",
      quantity: Number.isInteger(item.quantity) ? item.quantity : 0,
    }))
    .filter((item) => item.itemId && item.quantity > 0 && item.quantity <= 50);

  if (normalizedItems.length === 0) {
    return NextResponse.json({ error: "Panier vide" }, { status: 400 });
  }

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
