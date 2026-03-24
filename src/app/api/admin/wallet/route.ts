export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * GET /api/admin/wallet
 * Returns all agents with wallet info + profile name/email.
 * Actual DB: agents.id = SERIAL INT, agents.user_id = INT, agents.profile_id = UUID
 * profiles.id = UUID (auth user id)
 */
export async function GET() {
  try {
    const admin = getSupabaseAdmin();

    // 1. Get all agent profiles (source of truth for name/email/phone)
    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("id, name, email, phone, status, created_at")
      .eq("role", "agent")
      .order("created_at", { ascending: false });

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    // 2. Get all agent detail rows
    const { data: agentRows } = await admin
      .from("agents")
      .select("id, user_id, profile_id, wallet_balance, wallet_earnings, total_bookings, business_name, approval_status");

    // 3. Build lookup by profile_id (UUID) and user_id (INT, stringified)
    const byProfileId: Record<string, any> = {};
    const byUserId: Record<string, any> = {};
    (agentRows || []).forEach((a: any) => {
      if (a.profile_id) byProfileId[String(a.profile_id)] = a;
      if (a.user_id) byUserId[String(a.user_id)] = a;
    });

    // 4. Merge: profile is primary, agent detail adds wallet/business info
    const enriched = (profiles || []).map((p: any) => {
      const ag = byProfileId[String(p.id)] || byUserId[String(p.id)];
      return {
        agent_id: ag?.id || null,       // agents table INT id (for wallet update)
        user_id: p.id,                   // profile UUID (for transaction record)
        has_agent_row: !!ag,
        name: p.name || "—",
        email: p.email || "—",
        phone: p.phone || "—",
        business_name: ag?.business_name || null,
        status: p.status || "active",
        approval_status: ag?.approval_status || "pending",
        wallet_balance: ag ? (Number(ag.wallet_balance) || 0) : 0,
        wallet_earnings: ag ? (Number(ag.wallet_earnings) || 0) : 0,
      };
    });

    return NextResponse.json({ data: enriched });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch agents" }, { status: 500 });
  }
}

/**
 * POST /api/admin/wallet
 * Add money to an agent's wallet.
 * Body: { agent_id (INT from agents table), user_id (profile UUID), amount, reason? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agent_id, user_id, amount, reason } = body;

    if (!agent_id || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "agent_id and a positive amount are required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const numAmount = Number(amount);

    // 1. Find agent by integer id
    const { data: agentRow, error: agErr } = await admin
      .from("agents")
      .select("id, wallet_balance, profile_id, user_id")
      .eq("id", Number(agent_id))
      .maybeSingle();

    if (agErr || !agentRow) {
      return NextResponse.json({ error: `Agent row not found for id ${agent_id}` }, { status: 404 });
    }

    const currentBalance = Number(agentRow.wallet_balance) || 0;
    const newBalance = currentBalance + numAmount;

    // 2. Update wallet balance
    const { error: updateErr } = await admin
      .from("agents")
      .update({ wallet_balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", Number(agent_id));

    if (updateErr) {
      return NextResponse.json({ error: `Failed to update wallet: ${updateErr.message}` }, { status: 500 });
    }

    // 3. Get profile name/email for transaction record
    const profileId = user_id || agentRow.profile_id;
    let profileName: string | null = null;
    let profileEmail: string | null = null;

    if (profileId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("name, email")
        .eq("id", String(profileId))
        .maybeSingle();
      profileName = profile?.name || null;
      profileEmail = profile?.email || null;
    }

    // 4. Insert transaction record
    const txnId =
      "TXN" +
      Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).slice(2, 6).toUpperCase();

    const { error: txnErr } = await admin.from("agent_transactions").insert({
      txn_id: txnId,
      user_id: profileId ? String(profileId) : String(agent_id),
      user_name: profileName,
      user_email: profileEmail,
      reason: reason || "Admin Wallet Top-up",
      amount: numAmount,
      balance: newBalance,
      status: "completed",
      started_on: new Date().toISOString().split("T")[0],
    });

    if (txnErr) {
      console.error("Transaction insert error:", txnErr);
    }

    return NextResponse.json({
      success: true,
      new_balance: newBalance,
      txn_id: txnId,
    });
  } catch (err: any) {
    console.error("Admin wallet top-up error:", err);
    return NextResponse.json({ error: err?.message || "Failed to add money" }, { status: 500 });
  }
}
