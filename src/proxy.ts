import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

/**
 * Server gate for protected app areas.
 *
 * The browser only has one NextAuth cookie, so two tabs using different roles can
 * overwrite that cookie. We only require a valid token here; each client page then
 * verifies the expected role against its per-tab sessionStorage workspace.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || "dev-secret-change-in-production-menu-qr-v1",
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
