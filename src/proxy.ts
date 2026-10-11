import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protectedPath = /^\/(admin|dashboard)(\/|$)/.test(pathname) || /^\/api\/(admin|dashboard)(\/|$)/.test(pathname);
  if (protectedPath && !process.env.NEXTAUTH_SECRET) return new NextResponse("Authentification indisponible.", { status: 503 });
  if (pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");
    const expectedOrigin = new URL(request.url).origin;
    const mutation = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    if (Number(request.headers.get("content-length")) > 1_000_000) return NextResponse.json({ error: "Contenu trop volumineux." }, { status: 413 });
    if ((origin && origin !== expectedOrigin) || site === "cross-site" ||
        (mutation && !origin && site !== "same-origin")) {
      return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
    }
    const response = request.method === "OPTIONS" ? new NextResponse(null, { status: 204 }) : NextResponse.next();
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Cache-Control", "no-store");
    if (pathname.startsWith("/api/admin") || pathname.startsWith("/api/dashboard")) {
      const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
      const role = pathname.startsWith("/api/admin") ? "super_admin" : "restaurateur";
      if (!token) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
      if (token.role !== role) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    return response;
  }
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (
    (pathname.startsWith("/admin") || pathname.startsWith("/dashboard")) &&
    !pathname.startsWith("/api/") &&
    !token
  ) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (token && pathname.startsWith("/admin") && token.role !== "super_admin") {
    return new NextResponse("Accès réservé au super administrateur.", { status: 403 });
  }
  if (token && pathname.startsWith("/dashboard") && (token.role !== "restaurateur" || !token.restaurantId)) {
    return new NextResponse("Accès réservé au restaurateur.", { status: 403 });
  }

  const response = NextResponse.next();
  if (protectedPath) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/api/:path*"],
};
