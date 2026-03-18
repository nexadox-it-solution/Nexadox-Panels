export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/razorpay/create-order
 * Creates a Razorpay order using the REST API directly (no npm package).
 * This avoids any module compatibility issues on Vercel.
 */
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

    /* Call Razorpay REST API directly — no npm package needed */
    const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Razorpay expects paise
        currency: "INR",
        receipt: `wt_${Date.now()}`.slice(0, 40),
        notes: {
          agent_user_id: String(agent_user_id || ""),
          purpose: "wallet_topup",
        },
      }),
    });

    const order = await rzpRes.json();

    if (!rzpRes.ok) {
      console.error("Razorpay API error:", rzpRes.status, order);
      const detail = order?.error?.description || order?.message || "Failed to create order";
      return NextResponse.json({ error: detail }, { status: rzpRes.status });
    }

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
    });
  } catch (err: any) {
    console.error("Razorpay create order error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create order" },
      { status: 500 }
    );
  }
}
