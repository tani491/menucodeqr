import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

/**
 * Middleware de sécurité — vérifications côté SERVEUR avant le rendu.
 *
 * Stratégie de séparation des rôles :
 *   /admin/*      → exige role = "super_admin"  → sinon 302 vers /login
 *   /dashboard/*  → exige role = "restaurateur" → sinon 302 vers /login
 *   /api/admin/*  → les route handlers renvoient 401/403 eux-mêmes
 *   /api/dashboard/* → idem
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || "dev-secret-change-in-production-menu-qr-v1",
  });

  // ─── Routes pages protégées (rendu serveur) ──────────────────────────────
  if (pathname.startsWith("/admin") && !pathname.startsWith("/api/")) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }

    // Vérification stricte du rôle
    if (token.role !== "super_admin") {
      // Un restaurateur qui tente d'accéder à /admin est redirigé vers son dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (pathname.startsWith("/dashboard") && !pathname.startsWith("/api/")) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }

    if (token.role !== "restaurateur") {
      // Un super_admin qui tente d'accéder à /dashboard est redirigé vers /admin
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    if (!token.restaurantId) {
      // Restaurateur sans restaurant — ne devrait pas arriver, mais sécurité
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "no_restaurant");
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
