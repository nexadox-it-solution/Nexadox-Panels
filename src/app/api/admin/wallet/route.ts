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
 * Returns all agents with their wallet info + profile name/email.
 * Uses the same merge pattern as the working agents page:
 * 1. Fetch profiles where role='agent'
 * 2. Fetch agent detail rows
 * 3. Merge them together
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

    // 2. Get all agent detail rows (wallet, commission, business info)
    const { data: agentRows } = await admin
      .from("agents")
      .select("id, user_id, wallet_balance, business_name, approval_status, commission_type, commission_value");

    // 3. Build lookups: profile_id → agent detail, user_id → agent detail
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
        id: ag?.id || p.id,          // agent row id (needed for wallet update)
        user_id: p.id,                // profile id (needed for transaction record)
        name: p.name || "—",
        email: p.email || "—",
        phone: p.phone || "—",
        business_name: ag?.business_name || null,
        approval_status: ag?.approval_status || "pending",
        wallet_balance: ag?.wallet_balance || 0,
        wallet_earnings: 0,
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
 * Body: { agent_id, user_id, amount, reason? }
 */
export async function POST(req: NextRequest) {
  try {
    const { agent_id, user_id, amount, reason } = await req.json();

    if (!user_id || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "user_id and a positive amount are required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const numAmount = Number(amount);

    // 1. Find agent row — try by id first, then by user_id
    let agent: any = null;
    let agentRowId: string | null = null;

    if (agent_id) {
      const { data } = await admin
        .from("agents")
        .select("id, wallet_balance")
        .eq("id", agent_id)
        .single();
      if (data) { agent = data; agentRowId = data.id; }
    }

    if (!agent) {
      const { data } = await admin
        .from("agents")
        .select("id, wallet_balance")
        .eq("user_id", user_id)
        .single();
      if (data) { agent = data; agentRowId = data.id; }
    }

    if (!agent || !agentRowId) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const currentBalance = Number(agent.wallet_balance) || 0;
    const newBalance = currentBalance + numAmount;

    // 2. Update wallet balance
    const { error: updateErr } = await admin
      .from("agents")
      .update({ wallet_balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", agentRowId);

    if (updateErr) {
      return NextResponse.json({ error: "Failed to update wallet balance" }, { status: 500 });
    }

    // 3. Get agent profile for transaction record
    const { data: profile } = await admin
      .from("profiles")
      .select("name, email")
      .eq("id", String(user_id))
      .single();

    // 4. Insert transaction
    const txnId =
      "TXN" +
      Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).slice(2, 6).toUpperCase();

    const { error: txnErr } = await admin.from("agent_transactions").insert({
      txn_id: txnId,
      user_id: String(user_id),
      user_name: profile?.name || null,
      user_email: profile?.email || null,
      reason: reason || "Admin Wallet Top-up",
      amount: numAmount,
      balance: newBalance,
      status: "completed",
      started_on: new Date().toISOString().split("T")[0],
    });

    if (txnErr) {
      console.error("Transaction insert error:", txnErr);
      // Balance already updated — log but don't fail
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
