import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { getFirebaseAdminFirestore } from "@/lib/firebaseAdmin";
import { orderInputSchema, documentIdSchema } from "@/lib/validation";

const hash = (value: string) => createHash("sha256").update(value).digest();
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length > 30_000) return NextResponse.json({ error: "Commande trop volumineuse." }, { status: 413 });
    const parsed = orderInputSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return NextResponse.json({ error: "Informations de commande invalides." }, { status: 400 });
    const input = parsed.data;
    const db = getFirebaseAdminFirestore();
    if (!db) throw new Error("Firebase Admin indisponible");
    const restaurants = await db.collection("restaurants").where("slug", "==", input.slug).limit(1).get();
    const restaurant = restaurants.docs[0];
    if (!restaurant) return NextResponse.json({ error: "Restaurant introuvable." }, { status: 404 });
    const restaurantId = restaurant.data().id || restaurant.id;
    const ref = db.collection("orders").doc();
    const token = randomBytes(32).toString("hex");
    const order = await db.runTransaction(async tx => {
      const currentRestaurant = await tx.get(restaurant.ref);
      if (!currentRestaurant.exists || currentRestaurant.data()?.status === "suspended" || currentRestaurant.data()?.isSuspended) throw new Error("UNAVAILABLE");
      const items: { id: string; name: string; price: number; quantity: number }[] = [];
      for (const line of input.items) {
        let dish = await tx.get(db.collection("dishes").doc(line.itemId));
        if (!dish.exists) dish = await tx.get(db.collection("items").doc(line.itemId));
        const data = dish.data();
        if (!data || data.restaurantId !== restaurantId || data.isAvailable === false || data.status === "unavailable" || !Number.isFinite(data.price) || data.price < 0) throw new Error("UNAVAILABLE");
        items.push({ id: dish.id, name: data.nameFr || data.name || "Plat", price: data.price, quantity: line.quantity });
      }
      const now = new Date().toISOString();
      const value = { restaurantId, restaurantSlug: input.slug, tableNumber: input.tableNumber, customerName: input.customerName, customerPhone: input.customerPhone, notes: input.notes || null, items, totalPrice: items.reduce((sum, item) => sum + item.price * item.quantity, 0), status: "pending", createdAt: now, updatedAt: now };
      tx.create(ref, value);
      tx.create(db.collection("order_access").doc(ref.id), { tokenHash: hash(token).toString("hex"), createdAt: now });
      return value;
    });
    return NextResponse.json({ id: ref.id, token, order }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAVAILABLE") return NextResponse.json({ error: "Restaurant ou plat indisponible." }, { status: 409 });
    console.error("Commande:", error);
    return NextResponse.json({ error: "Commande non confirmée. Réessayez." }, { status: 503 });
  }
}
export async function GET(request: NextRequest) {
  const id = documentIdSchema.safeParse(request.nextUrl.searchParams.get("id"));
  const token = request.headers.get("x-order-token") || "";
  if (!id.success || !/^[a-f0-9]{64}$/.test(token)) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  try {
    const db = getFirebaseAdminFirestore();
    if (!db) throw new Error("Firebase Admin indisponible");
    const access = await db.collection("order_access").doc(id.data).get();
    const stored = access.data()?.tokenHash;
    if (typeof stored !== "string" || !/^[a-f0-9]{64}$/.test(stored) || !timingSafeEqual(hash(token), Buffer.from(stored, "hex"))) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    const order = await db.collection("orders").doc(id.data).get();
    if (!order.exists) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    return NextResponse.json({ id: order.id, order: order.data() }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Suivi indisponible." }, { status: 503 }); }
}
