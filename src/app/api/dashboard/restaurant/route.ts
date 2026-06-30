import { NextRequest, NextResponse } from "next/server";
import { requireActiveRestaurateur } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { invalidateMenuCache } from "@/lib/menu-data";

function cleanMediaUrl(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 1000) return undefined;

  const isRelativeUpload = value.startsWith("/uploads/");
  const isHttpUrl = /^https?:\/\/.+/i.test(value);
  return isRelativeUpload || isHttpUrl ? value : undefined;
}

function cleanPrimaryColor(value: unknown) {
  if (value === undefined || value === null || value === "") return "#000000";
  if (typeof value !== "string") return undefined;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : undefined;
}

export async function PATCH(request: NextRequest) {
  const auth = await requireActiveRestaurateur();
  if (auth.error) return auth.error;

  const body = await request.json();
  const logoUrl = cleanMediaUrl(body.logoUrl);
  const bannerUrl = cleanMediaUrl(body.bannerUrl);
  const primaryColor = cleanPrimaryColor(body.primaryColor);

  if (logoUrl === undefined || bannerUrl === undefined || primaryColor === undefined) {
    return NextResponse.json({ error: "Parametre restaurant invalide" }, { status: 400 });
  }

  const restaurant = await db.restaurant.update({
    where: { id: auth.restaurantId },
    data: { logoUrl, bannerUrl, primaryColor },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      bannerUrl: true,
      primaryColor: true,
    },
  });

  invalidateMenuCache(restaurant.slug);

  return NextResponse.json({ restaurant });
}
