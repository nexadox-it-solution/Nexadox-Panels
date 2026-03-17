export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(req: NextRequest) {
  try {
    const { amount, agent_user_id } = await req.json();

    if (!amount || amount < 10) {
      return NextResponse.json({ error: "Minimum amount is ₹10" }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Razorpay keys not configured." }, { status: 500 });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Razorpay expects paise
      currency: "INR",
      receipt: `wallet_topup_${agent_user_id || "unknown"}_${Date.now()}`,
      notes: {
        agent_user_id: String(agent_user_id || ""),
        purpose: "wallet_topup",
      },
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
    });
  } catch (err: any) {
    console.error("Razorpay create order error:", err?.error || err);
    const detail = err?.error?.description || err?.message || "Failed to create order";
    return NextResponse.json(
      { error: detail },
      { status: 500 }
    );
  }
}
