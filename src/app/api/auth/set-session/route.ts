export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/auth/set-session
 *
 * Called by the login page AFTER successful Supabase auth.
 * Sets a server-side `nexadox-session` cookie that is:
 *   - Fully under our control (NOT managed by @supabase/auth-js)
 *   - Set via Set-Cookie header (reliable, not document.cookie)
 *   - HttpOnly (can't be tampered with from JS)
 *   - 7-day expiry
 *
 * The middleware uses this cookie as the auth gate.
 * Even if Supabase wipes its own auth cookies (token refresh failure),
 * this cookie persists and the user can keep navigating.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, role } = await req.json();

    if (!userId || !role) {
      return NextResponse.json(
        { error: "userId and role are required" },
        { status: 400 }
      );
    }

    // Validate that this user actually exists with this role
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("role, status")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (profile.role !== role) {
      return NextResponse.json(
        { error: "Role mismatch" },
        { status: 403 }
      );
    }

    if (profile.status === "inactive" || profile.status === "suspended") {
      return NextResponse.json(
        { error: "Account is deactivated" },
        { status: 403 }
      );
    }

    // Set the session cookie — server-side, HttpOnly, 7-day expiry
    const sessionValue = `${userId}:${role}`;
    const response = NextResponse.json({ success: true });

    response.cookies.set("nexadox-session", sessionValue, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Also set the role cookie (non-HttpOnly, for client-side use)
    response.cookies.set("nexadox-role", role, {
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
