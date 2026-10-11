import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dishSchema, documentIdSchema } from "@/lib/validation";
import { requireFirestoreRestaurant } from "@/lib/firestore-tenant";

const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), data: dishSchema }).strict(),
  z.object({ action: z.literal("update"), id: documentIdSchema, collection: z.enum(["dishes", "items"]), data: dishSchema.partial() }).strict(),
  z.object({ action: z.literal("delete"), id: documentIdSchema, collection: z.enum(["dishes", "items"]) }).strict(),
]);
export async function POST(request: NextRequest) {
  try {
    const tenant = await requireFirestoreRestaurant();
    if (tenant.error) return tenant.error;
    const raw = await request.text();
    if (raw.length > 230_000) return NextResponse.json({ error: "Contenu trop volumineux." }, { status: 413 });
    const parsed = mutation.safeParse(JSON.parse(raw));
    if (!parsed.success) return NextResponse.json({ error: "Champs du plat invalides." }, { status: 400 });
    const body = parsed.data;
    const ref = body.action === "create" ? tenant.db.collection("dishes").doc() : tenant.db.collection(body.collection).doc(body.id);
    await tenant.db.runTransaction(async tx => {
      const existing = body.action === "create" ? null : await tx.get(ref);
      if (existing && (!existing.exists || existing.data()?.restaurantId !== tenant.restaurantId)) throw new Error("NOT_FOUND");
      if (body.action === "delete") { tx.delete(ref); return; }
      if (body.data.categoryId) {
        const category = await tx.get(tenant.db.collection("categories").doc(body.data.categoryId));
        if (!category.exists || category.data()?.restaurantId !== tenant.restaurantId) throw new Error("NOT_FOUND");
      }
      const now = new Date().toISOString();
      const data = {
        ...body.data,
        ...(body.data.nameFr !== undefined ? { name: body.data.nameFr } : {}),
        ...(body.data.descriptionFr !== undefined ? { description: body.data.descriptionFr } : {}),
        ...(body.data.categoryId !== undefined ? { category: body.data.categoryId } : {}),
        ...(body.data.isAvailable !== undefined ? { status: body.data.isAvailable ? "available" : "unavailable" } : {}),
        restaurantId: tenant.restaurantId, updatedAt: now,
      };
      if (body.action === "create") tx.create(ref, { ...data, createdAt: now });
      else tx.update(ref, data);
    });
    return NextResponse.json({ id: ref.id });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
    if (error instanceof Error && error.message === "NOT_FOUND") return NextResponse.json({ error: "Plat ou catégorie non autorisé." }, { status: 404 });
    console.error("Écriture plat:", error);
    return NextResponse.json({ error: "Enregistrement indisponible. Réessayez." }, { status: 503 });
  }
}
