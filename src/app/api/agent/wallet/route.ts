export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

export async function GET(req: NextRequest) {
  try {
    /* ── Resolve user ID from query param OR auth cookies ── */
    let authUserId = req.nextUrl.searchParams.get("userId");

    if (!authUserId) {
      // Try to get user from auth cookies (SSR)
      const response = NextResponse.next();
      const supabaseSSR = createServerClient(
        (process.env.NEXT_PUBLIC_SUPABASE_URL || ""),
        (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""),
        {
          cookies: {
            get(name: string) { return req.cookies.get(name)?.value; },
            set(name: string, value: string, options: CookieOptions) { response.cookies.set({ name, value, ...options }); },
            remove(name: string, options: CookieOptions) { response.cookies.set({ name, value: "", ...options }); },
          },
        }
      );
      const { data: { user } } = await supabaseSSR.auth.getUser();
      authUserId = user?.id || null;
    }

    if (!authUserId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    /* ── 1. Get profile ──────────────────────────────────── */
    const { data: profile } = await getSupabaseAdmin()
      .from("profiles")
      .select("id, name, email, phone, role")
      .eq("id", authUserId)
      .single();

    if (!profile || profile.role !== "agent") {
      return NextResponse.json({ error: "Agent profile not found" }, { status: 404 });
    }

    /* ── 2. Get agent record ─────────────────────────────── */
    let agent: any = null;

    const { data: byProfile } = await getSupabaseAdmin()
      .from("agents")
      .select("id, wallet_balance, commission_value, commission_type, wallet_earnings, total_bookings")
      .eq("profile_id", authUserId)
      .single();

    if (byProfile) {
      agent = byProfile;
    } else {
      const { data: byUser } = await getSupabaseAdmin()
        .from("agents")
        .select("id, wallet_balance, commission_value, commission_type, wallet_earnings, total_bookings")
        .eq("user_id", authUserId)
        .single();
      agent = byUser;
    }

    if (!agent) {
      return NextResponse.json({ error: "Agent record not found" }, { status: 404 });
    }

    /* ── 3. Get transactions ─────────────────────────────── */
    const { data: txns } = await getSupabaseAdmin()
      .from("agent_transactions")
      .select("*")
      .eq("user_id", String(authUserId))
      .order("created_at", { ascending: false })
      .limit(100);

    return NextResponse.json({
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
      },
      agent: {
        id: agent.id,
        wallet_balance: Number(agent.wallet_balance) || 0,
        commission_value: Number(agent.commission_value) || 10,
        commission_type: agent.commission_type || "percentage",
        wallet_earnings: Number(agent.wallet_earnings) || 0,
        total_bookings: Number(agent.total_bookings) || 0,
      },
      transactions: txns || [],
    });
  } catch (err: any) {
    console.error("Agent wallet API error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
