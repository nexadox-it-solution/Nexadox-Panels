export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * GET /api/debug/auth
 * Shows cookie state and auth status for debugging.
 * Call this after login to verify cookies are being sent.
 */
export async function GET(req: NextRequest) {
  const allCookies = req.cookies.getAll();

  const authCookies = allCookies.filter(
    (c) => c.name.startsWith("sb-") && c.name.includes("auth-token")
  );

  const roleCookie = req.cookies.get("nexadox-role")?.value ?? null;

  // Try to get the user via Supabase SSR
  let userResult: any = null;
  let userError: any = null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key) {
    try {
      const supabase = createServerClient(url, key, {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll() {
            /* read-only debug endpoint */
          },
        },
      });
      const { data, error } = await supabase.auth.getUser();
      userResult = data?.user
        ? { id: data.user.id, email: data.user.email, role: data.user.role }
        : null;
      userError = error ? { message: error.message, status: error.status } : null;
    } catch (e: any) {
      userError = { message: e?.message || "Unknown error", caught: true };
    }
  }

  return NextResponse.json({
    totalCookies: allCookies.length,
    cookieNames: allCookies.map((c) => c.name),
    authCookieCount: authCookies.length,
    authCookieNames: authCookies.map((c) => c.name),
    roleCookie,
    envVarsPresent: { url: !!url, key: !!key },
    user: userResult,
    error: userError,
  });
}
