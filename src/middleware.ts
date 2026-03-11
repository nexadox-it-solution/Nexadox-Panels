import { NextResponse, type NextRequest } from "next/server";

// Define protected routes by role
const roleBasedRoutes: Record<string, string[]> = {
  admin: ["/admin"],
  doctor: ["/doctor"],
  attendant: ["/attendant"],
  agent: ["/agent"],
  patient: ["/patient"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and all API routes
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  // Redirect root to login
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // ──────────────────────────────────────────────────────────────────
  // AUTH GATE — checks our OWN `nexadox-session` cookie.
  // This cookie is:
  //   - Set by /api/auth/set-session during login (HttpOnly, Secure)
  //   - NOT managed by @supabase/auth-js
  //   - Immune to Supabase's _removeSession() which wipes sb-* cookies
  //   - 7-day expiry
  // No Supabase API calls. No network requests.
  // ──────────────────────────────────────────────────────────────────
  const sessionCookie = request.cookies.get("nexadox-session")?.value;

  if (!sessionCookie) {
    const redirectUrl = new URL("/auth/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Extract role from session cookie (format: "userId:role")
  const userRole = sessionCookie.split(":")[1] || request.cookies.get("nexadox-role")?.value;

  if (userRole) {
    const allowedRoutes = roleBasedRoutes[userRole] || [];

    const isAccessingProtectedRoute = Object.values(roleBasedRoutes)
      .flat()
      .some((route) => pathname.startsWith(route));

    if (isAccessingProtectedRoute) {
      const hasAccess = allowedRoutes.some((route) =>
        pathname.startsWith(route)
      );
      if (!hasAccess) {
        const userDashboard = allowedRoutes[0] || "/";
        return NextResponse.redirect(new URL(userDashboard, request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.gif|.*\\.ico|.*\\.webp).*)",
  ],
};
