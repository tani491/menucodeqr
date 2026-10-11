import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { marketingDatabase, readMarketing } from "@/lib/marketing-server";
import { settingsSchema, testimonialSchema } from "@/lib/marketing";

const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settings"), data: settingsSchema }),
  z.object({ action: z.literal("create"), data: testimonialSchema }),
  z.object({ action: z.literal("update"), id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), data: testimonialSchema }),
  z.object({ action: z.literal("toggle"), id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), isActive: z.boolean() }),
  z.object({ action: z.literal("delete"), id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) }),
]);
async function authorize() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (auth.role !== "super_admin") return NextResponse.json({ error: "Accès réservé au super administrateur." }, { status: 403 });
}
export async function GET() {
  const denied = await authorize();
  if (denied) return denied;
  try { return NextResponse.json(await readMarketing(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { console.error("Marketing admin:", error); return NextResponse.json({ error: "Firestore indisponible. Vérifiez Firebase Admin." }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  const denied = await authorize();
  if (denied) return denied;
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 750_000) return NextResponse.json({ error: "Contenu trop volumineux." }, { status: 413 });
    body = mutation.parse(JSON.parse(raw));
  } catch { return NextResponse.json({ error: "Champs invalides. Vérifiez les textes, la note, les statistiques et les images (500 Ko maximum)." }, { status: 400 }); }
  try {
    const db = marketingDatabase();
    if (body.action === "settings") await db.collection("site_settings").doc("marketing").set(body.data);
    else if (body.action === "create") {
      const ref = db.collection("testimonials").doc();
      await ref.set({ ...body.data, id: ref.id, createdAt: FieldValue.serverTimestamp() });
    } else {
      const ref = db.collection("testimonials").doc(body.id);
      if (body.action === "delete") await ref.delete();
      else await ref.update(body.action === "toggle" ? { isActive: body.isActive } : body.data);
    }
    return NextResponse.json({ ok: true });
  } catch (error) { console.error("Marketing écriture:", error); return NextResponse.json({ error: "Enregistrement impossible. Réessayez." }, { status: 503 }); }
}
