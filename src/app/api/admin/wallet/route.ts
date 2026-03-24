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
 */
export async function GET() {
  try {
    const admin = getSupabaseAdmin();
    const { data: agents, error } = await admin
      .from("agents")
      .select("id, user_id, wallet_balance, wallet_earnings, business_name, approval_status");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Enrich with profile name/email
    const userIds = (agents || []).map((a) => a.user_id).filter(Boolean);
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, name, email, phone")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const enriched = (agents || []).map((a) => {
      const p = profileMap.get(a.user_id);
      return {
        ...a,
        name: p?.name || a.business_name || "—",
        email: p?.email || "—",
        phone: p?.phone || "—",
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

    if (!agent_id || !user_id || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "agent_id, user_id, and a positive amount are required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const numAmount = Number(amount);

    // 1. Get current wallet balance
    const { data: agent, error: agErr } = await admin
      .from("agents")
      .select("wallet_balance")
      .eq("id", agent_id)
      .single();

    if (agErr || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const currentBalance = Number(agent.wallet_balance) || 0;
    const newBalance = currentBalance + numAmount;

    // 2. Update wallet balance
    const { error: updateErr } = await admin
      .from("agents")
      .update({ wallet_balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", agent_id);

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
