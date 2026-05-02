import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

// Routes that don't require an authenticated session.
const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/forgot-password",
  "/reset-password",
]);

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

  const { pathname } = request.nextUrl;

  const isPublicPath = PUBLIC_PATHS.has(pathname);
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".");

  if (isPublicAsset) {
    return response;
  }

  const hasSession = request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes("auth-token"));

  if (!hasSession && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
