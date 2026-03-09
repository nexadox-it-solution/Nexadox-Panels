export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  getWalletBalance,
  getWalletTransactions,
  createWalletTransaction,
} from "@/lib/supabase/queries";

// GET /api/wallet - Get wallet balance and transactions
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");
    const limit = searchParams.get("limit");

    if (action === "balance") {
      const balance = await getWalletBalance(user.id);
      return NextResponse.json({ balance });
    }

    if (action === "transactions") {
      const transactions = await getWalletTransactions(
        user.id,
        limit ? parseInt(limit) : undefined
      );
      return NextResponse.json(transactions);
    }

    // Default: return both
    const balance = await getWalletBalance(user.id);
    const transactions = await getWalletTransactions(user.id, 10);

    return NextResponse.json({ balance, transactions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/wallet - Create wallet transaction (top-up, deduct, etc.)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, type, description, reference_type, reference_id } = body;

    if (!amount || !type || !description) {
      return NextResponse.json(
        { error: "Amount, type, and description are required" },
        { status: 400 }
      );
    }

    if (type !== "credit" && type !== "debit") {
      return NextResponse.json(
        { error: "Type must be 'credit' or 'debit'" },
        { status: 400 }
      );
    }

    // For debit transactions, check if user has sufficient balance
    if (type === "debit") {
      const balance = await getWalletBalance(user.id);
      if (balance < amount) {
        return NextResponse.json(
          { error: "Insufficient wallet balance" },
          { status: 400 }
        );
      }
    }

    const transaction = await createWalletTransaction({
      user_id: user.id,
      amount,
      type,
      description,
      reference_type,
      reference_id,
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
