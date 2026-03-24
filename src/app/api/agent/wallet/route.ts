export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

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
      // Try to get user from auth cookies (SSR) using getAll/setAll
      const supabaseSSR = createServerClient(
        (process.env.NEXT_PUBLIC_SUPABASE_URL || ""),
        (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""),
        {
          cookies: {
            getAll() { return req.cookies.getAll(); },
            setAll() { /* API route — cookie writing handled by middleware */ },
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

    // Use select("*") to avoid silent failure when a column name doesn't exist
    const { data: byProfile } = await getSupabaseAdmin()
      .from("agents")
      .select("*")
      .eq("profile_id", authUserId)
      .single();

    if (byProfile) {
      agent = byProfile;
    } else {
      const { data: byUser } = await getSupabaseAdmin()
        .from("agents")
        .select("*")
        .eq("user_id", authUserId)
        .single();
      agent = byUser;
    }

    if (!agent) {
      return NextResponse.json({ error: "Agent record not found" }, { status: 404 });
    }

    /* ── 3. Get transactions (match by profile UUID OR numeric user_id) ── */
    const possibleIds = [String(authUserId)];
    if (agent.user_id) possibleIds.push(String(agent.user_id));
    const { data: txns } = await getSupabaseAdmin()
      .from("agent_transactions")
      .select("*")
      .in("user_id", possibleIds)
      .order("created_at", { ascending: false })
      .limit(100);

    return NextResponse.json({
      profile: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone || "",
      },
      agent: {
        id: agent.id,
        wallet_balance: Number(agent.wallet_balance) || 0,
        commission_value: Number(agent.commission_value) || 30,
        commission_type: agent.commission_type || "percentage",
        wallet_earnings: Number(agent.wallet_earnings) || 0,
        total_bookings: Number(agent.total_bookings) || 0,
        approval_status: (agent.approval_status || "pending").toLowerCase(),
        business_name: agent.business_name || "",
        business_address: agent.business_address || "",
        pan_number: agent.pan_number || "",
        gst_number: agent.gst_number || "",
      },
      transactions: txns || [],
    });
  } catch (err: any) {
    console.error("Agent wallet API error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
