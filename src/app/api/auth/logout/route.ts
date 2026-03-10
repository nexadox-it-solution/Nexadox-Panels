export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/logout
 * Signs out the current user and redirects to login page.
 */
export async function GET() {
  const supabase = createClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(
    new URL("/auth/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
  );
  // Clear the role cookie
  response.cookies.set("nexadox-role", "", { path: "/", maxAge: 0 });
  return response;
}

/**
 * POST /api/auth/logout
 * Signs out the current user — for programmatic calls.
 */
export async function POST() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("nexadox-role", "", { path: "/", maxAge: 0 });
  return response;
}
