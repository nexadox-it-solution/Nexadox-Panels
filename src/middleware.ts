import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Define protected routes by role
const roleBasedRoutes = {
  admin: ["/admin"],
  doctor: ["/doctor"],
  attendant: ["/attendant"],
  agent: ["/agent"],
  patient: ["/patient"],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and all API routes (API routes use service role key)
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

  // Skip auth checking if Supabase is not configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  // Create a response we can modify (to forward cookie changes)
  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({ name, value, ...options });
            response = NextResponse.next({
              request: { headers: request.headers },
            });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({ name, value: "", ...options });
            response = NextResponse.next({
              request: { headers: request.headers },
            });
            response.cookies.set({ name, value: "", ...options });
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    // Redirect to login if not authenticated
    if (userError || !user) {
      const redirectUrl = new URL("/auth/login", request.url);
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Get user role from profiles (with timeout protection)
    let userRole: string | null = null;
    let userStatus: string = "active";

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", user.id)
        .single();

      if (profile) {
        userRole = profile.role;
        userStatus = profile.status || "active";
      }
    } catch {
      // If profile query fails (network/RLS/timeout), allow access
      // rather than locking the user out — page-level checks will handle it
      return response;
    }

    if (!userRole) {
      // User authenticated but no profile — allow through,
      // page-level code will handle missing profile gracefully
      return response;
    }

    // Check if user is active
    if (userStatus !== "active") {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }

    // Check role-based access
    const allowedRoutes = roleBasedRoutes[userRole as keyof typeof roleBasedRoutes] || [];

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

    return response;
  } catch (error) {
    // On any unexpected error, allow the request through rather than
    // redirecting to login — this prevents transient errors from logging
    // users out. Page-level auth checks provide a second safety net.
    console.error("Middleware error:", error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.gif|.*\\.ico|.*\\.webp).*)",
  ],
};
