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

  // Check for Supabase auth cookies (no API calls — just cookie existence)
  const hasAuthCookie = request.cookies.getAll().some(
    (c) => c.name.startsWith("sb-") && c.name.includes("auth-token")
  );

  if (!hasAuthCookie) {
    const redirectUrl = new URL("/auth/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Role-based routing via lightweight cookie (set during login)
  const userRole = request.cookies.get("nexadox-role")?.value;

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

  // Allow through — browser client handles token refresh on its own
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.gif|.*\\.ico|.*\\.webp).*)",
  ],
};
