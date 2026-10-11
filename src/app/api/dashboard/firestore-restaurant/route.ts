import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireFirestoreRestaurant } from "@/lib/firestore-tenant";

const media = z.string().max(380_000).refine(value => value === "" || /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) || /^https:\/\//.test(value));
const input = z.object({ primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), logoUrl: media.optional(), bannerUrl: media.optional() }).strict();
export async function PATCH(request: NextRequest) {
  try {
    const tenant = await requireFirestoreRestaurant();
    if (tenant.error) return tenant.error;
    const raw = await request.text();
    if (raw.length > 850_000) return NextResponse.json({ error: "Images trop volumineuses." }, { status: 413 });
    const parsed = input.safeParse(JSON.parse(raw));
    if (!parsed.success) return NextResponse.json({ error: "Identité du restaurant invalide." }, { status: 400 });
    await tenant.db.runTransaction(async tx => {
      const current = await tx.get(tenant.restaurant.ref);
      if (current.data()?.userId !== tenant.restaurant.data().userId || current.data()?.status === "suspended" || current.data()?.isSuspended) throw new Error("Accès refusé");
      tx.update(tenant.restaurant.ref, { ...parsed.data, couleur: parsed.data.primaryColor, ...(parsed.data.bannerUrl !== undefined ? { banniereUrl: parsed.data.bannerUrl } : {}), updatedAt: new Date().toISOString() });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
    return NextResponse.json({ error: "Enregistrement indisponible." }, { status: 503 });
  }
}
