export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(req: NextRequest) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
      agent_user_id,
      agent_id,
    } = await req.json();

    /* ── 1. Verify Razorpay signature ────────────────────── */
    const secret = process.env.RAZORPAY_KEY_SECRET || "";
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 }
      );
    }

    /* ── 2. Get current wallet balance ───────────────────── */
    const { data: agent, error: agErr } = await supabaseAdmin
      .from("agents")
      .select("wallet_balance")
      .eq("id", agent_id)
      .single();

    if (agErr || !agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const currentBalance = Number(agent.wallet_balance) || 0;
    const newBalance = currentBalance + Number(amount);

    /* ── 3. Update wallet balance ────────────────────────── */
    const { error: updateErr } = await supabaseAdmin
      .from("agents")
      .update({ wallet_balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", agent_id);

    if (updateErr) {
      console.error("Update wallet error:", updateErr);
      return NextResponse.json(
        { error: "Failed to update wallet" },
        { status: 500 }
      );
    }

    /* ── 4. Record transaction ───────────────────────────── */
    const txnId = "TXN" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

    /* Get agent profile name/email for transaction record */
    const { data: agentProfile } = await supabaseAdmin
      .from("profiles")
      .select("name, email")
      .eq("id", String(agent_user_id))
      .single();

    await supabaseAdmin.from("agent_transactions").insert({
      txn_id: txnId,
      user_id: String(agent_user_id),
      user_name: agentProfile?.name || null,
      user_email: agentProfile?.email || null,
      reason: `Wallet Top Up via Razorpay (${razorpay_payment_id})`,
      amount: Number(amount),
      balance: newBalance,
      status: "completed",
      started_on: new Date().toISOString().split("T")[0],
    });

    return NextResponse.json({
      success: true,
      new_balance: newBalance,
      txn_id: txnId,
      payment_id: razorpay_payment_id,
    });
  } catch (err: any) {
    console.error("Razorpay verify error:", err);
    return NextResponse.json(
      { error: err?.message || "Payment verification failed" },
      { status: 500 }
    );
  }
}
