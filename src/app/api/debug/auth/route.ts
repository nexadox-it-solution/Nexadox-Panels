export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * GET /api/debug/auth
 * Shows cookie state and auth status for debugging.
 */
export async function GET(req: NextRequest) {
  const allCookies = req.cookies.getAll();

  const authCookies = allCookies.filter(
    (c) => c.name.startsWith("sb-") && c.name.includes("auth-token")
  );

  const roleCookie = req.cookies.get("nexadox-role")?.value ?? null;
  const sessionCookie = req.cookies.get("nexadox-session")?.value ?? null;

  // Show all cookie names with value lengths (never expose values)
  const cookieDetails = allCookies.map((c) => ({
    name: c.name,
    valueLength: c.value?.length ?? 0,
    preview: c.value ? c.value.substring(0, 20) + "..." : "(empty)",
  }));

  // Try to get the user via Supabase SSR
  let userResult: any = null;
  let userError: any = null;
  let sessionResult: any = null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key && authCookies.length > 0) {
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

      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        const s = sessionData.session;
        sessionResult = {
          expiresAt: s.expires_at ? new Date(s.expires_at * 1000).toISOString() : null,
          expiresIn: s.expires_at ? Math.round(s.expires_at - Date.now() / 1000) + "s" : null,
          tokenType: s.token_type,
          hasRefreshToken: !!s.refresh_token,
        };
      }

      const { data, error } = await supabase.auth.getUser();
      userResult = data?.user
        ? { id: data.user.id, email: data.user.email }
        : null;
      userError = error ? { message: error.message, status: error.status } : null;
    } catch (e: any) {
      userError = { message: e?.message || "Unknown error", caught: true };
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    totalCookies: allCookies.length,
    cookieDetails,
    authCookieCount: authCookies.length,
    authCookieNames: authCookies.map((c) => c.name),
    roleCookie,
    sessionCookie: sessionCookie ? `${sessionCookie.substring(0, 8)}...` : null,
    envVarsPresent: { url: !!url, key: !!key },
    session: sessionResult,
    user: userResult,
    error: userError,
  });
}
