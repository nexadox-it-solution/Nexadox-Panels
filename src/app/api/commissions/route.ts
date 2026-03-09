import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  getAgentCommissions,
  calculateCommission,
} from "@/lib/supabase/queries";

// GET /api/commissions - Get agent commissions
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get agent ID for the user
    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const filters = {
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
    };

    const commissions = await getAgentCommissions(agent.id, filters);
    return NextResponse.json(commissions);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/commissions - Calculate and log commission
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
    const { appointmentId, agentId, consultationFee } = body;

    if (!appointmentId || !agentId || !consultationFee) {
      return NextResponse.json(
        { error: "Appointment ID, agent ID, and consultation fee are required" },
        { status: 400 }
      );
    }

    const commission = await calculateCommission(
      appointmentId,
      agentId,
      consultationFee
    );

    return NextResponse.json(commission, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
