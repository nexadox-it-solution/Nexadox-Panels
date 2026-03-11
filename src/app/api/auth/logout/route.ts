export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/logout
 * Signs out the current user and redirects to login page.
 * Passes ?logout=1 so the login page can clear localStorage.
 */
export async function GET() {
  const supabase = createClient();
  await supabase.auth.signOut();

  const loginUrl = new URL("/auth/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
  loginUrl.searchParams.set("logout", "1");
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
