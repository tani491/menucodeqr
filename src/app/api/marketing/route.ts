import { NextResponse } from "next/server";
import { readMarketing } from "@/lib/marketing-server";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(await readMarketing(true), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Marketing public:", error);
    return NextResponse.json({ error: "Contenu marketing indisponible." }, { status: 503 });
  }
}
