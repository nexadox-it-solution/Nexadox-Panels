import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  getQueue,
  getNextTokenNumber,
  checkInPatient,
  callNextPatient,
} from "@/lib/supabase/queries";

// GET /api/queue - Get current queue
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
    const doctorId = searchParams.get("doctorId");
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];

    const filters = {
      doctorId: doctorId || undefined,
      date,
    };

    const queue = await getQueue(filters);
    return NextResponse.json(queue);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/queue/checkin - Check in patient and generate token
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
    const { appointmentId, date } = body;

    if (!appointmentId) {
      return NextResponse.json(
        { error: "Appointment ID is required" },
        { status: 400 }
      );
    }

    // Get next token number
    const tokenNumber = await getNextTokenNumber(
      date || new Date().toISOString().split("T")[0]
    );

    // Check in patient
    const appointment = await checkInPatient(appointmentId, tokenNumber);

    return NextResponse.json(appointment, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
