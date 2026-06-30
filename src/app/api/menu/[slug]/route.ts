import { NextResponse } from "next/server";
import { getMenuBySlug, invalidateMenuCache } from "@/lib/menu-data";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const data = await getMenuBySlug(slug);

  if (!data) {
    return NextResponse.json(
      { error: "Restaurant non trouvé" },
      { status: 404 }
    );
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  invalidateMenuCache(slug);
  return NextResponse.json({ ok: true });
}