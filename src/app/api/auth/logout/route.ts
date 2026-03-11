export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/logout
 * Signs out the current user and redirects to login page.
 * Passes ?logout=1 so the login page can clear localStorage.
 * Uses the request's own origin so the custom domain is preserved.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  await supabase.auth.signOut();

  const loginUrl = new URL("/auth/login?logout=1", req.url);
  return NextResponse.redirect(loginUrl);
}

/**
 * POST /api/auth/logout
 * Signs out the current user — for programmatic calls.
 */
export async function POST() {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
