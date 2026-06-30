import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireActiveRestaurateur } from "@/lib/api-auth";
import { db } from "@/lib/db";

/**
 * GET /api/dashboard/qrcode?format=png|svg&table=1
 * Génère un QR Code haute définition pointant vers l'URL publique du menu.
 *
 * L'URL de base est dynamique via NEXT_PUBLIC_BASE_URL :
 *   - Local smartphone: http://IP_LOCALE_DE_L_ORDINATEUR:3000
 *   - Prod: https://votredomaine.com
 *
 * Sécurité : seul le propriétaire du restaurant peut générer son QR.
 */
// Local phone testing: set NEXT_PUBLIC_BASE_URL in .env.local to the computer's
// LAN URL, for example http://192.168.1.50:3000. A smartphone cannot open localhost.
export async function GET(request: NextRequest) {
  const auth = await requireActiveRestaurateur();
  if (auth.error) return auth.error;

  const { searchParams } = request.nextUrl;
  const format = searchParams.get("format") || "png";
  const tableNumber = (searchParams.get("table") || "1").trim();

  if (!/^[a-zA-Z0-9_-]{1,20}$/.test(tableNumber)) {
    return NextResponse.json({ error: "Numero de table invalide" }, { status: 400 });
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: auth.restaurantId },
    select: { slug: true, name: true },
  });

  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant introuvable" }, { status: 404 });
  }

  // URL dynamique — s'adapte à l'environnement (local / Vercel / custom domain)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const menuUrl = `${baseUrl.replace(/\/$/, "")}/menu/${restaurant.slug}?table=${encodeURIComponent(tableNumber)}`;

  try {
    if (format === "svg") {
      const svgString = await QRCode.toString(menuUrl, {
        type: "svg",
        width: 1024,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });

      return new NextResponse(svgString, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Content-Disposition": `attachment; filename="qr-${restaurant.slug}-table-${tableNumber}.svg"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const pngBuffer = await QRCode.toBuffer(menuUrl, {
      width: 1024,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "H",
    });

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="qr-${restaurant.slug}-table-${tableNumber}.png"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Erreur de génération du QR Code" }, { status: 500 });
  }
}
