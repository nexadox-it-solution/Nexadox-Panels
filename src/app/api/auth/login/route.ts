export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/login
 * Authenticates a user server-side (bypasses browser CORS restrictions).
 * Returns { userId, role } on success.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || !body.email || !body.password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const { email, password } = body as { email: string; password: string };

    const supabase = createClient();

    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authErr) {
      // Normalise Supabase error messages for the client
      const message =
        authErr.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : authErr.message;
      return NextResponse.json({ error: message }, { status: 401 });
    }

    const authId = authData.user.id;

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", authId)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json(
        { error: "User profile not found. Please contact support." },
        { status: 404 }
      );
    }

    if (profile.status === "inactive" || profile.status === "suspended") {
      return NextResponse.json(
        { error: "Your account has been deactivated. Please contact admin." },
        { status: 403 }
      );
    }

    return NextResponse.json({ userId: authId, role: profile.role });
  } catch {
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
