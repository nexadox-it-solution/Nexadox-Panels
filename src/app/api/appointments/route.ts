import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
} from "@/lib/supabase/queries";

// GET /api/appointments - Get appointments with filters
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
    const appointmentId = searchParams.get("id");

    if (appointmentId) {
      const appointment = await getAppointmentById(appointmentId);
      return NextResponse.json(appointment);
    }

    const filters = {
      doctorId: searchParams.get("doctorId") || undefined,
      patientId: searchParams.get("patientId") || undefined,
      agentId: searchParams.get("agentId") || undefined,
      status: searchParams.get("status") || undefined,
      date: searchParams.get("date") || undefined,
    };

    const appointments = await getAppointments(filters);
    return NextResponse.json(appointments);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/appointments - Create new appointment
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
    const appointment = await createAppointment(body);

    return NextResponse.json(appointment, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/appointments - Update appointment
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Appointment ID is required" },
        { status: 400 }
      );
    }

    const appointment = await updateAppointment(id, updates);
    return NextResponse.json(appointment);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
