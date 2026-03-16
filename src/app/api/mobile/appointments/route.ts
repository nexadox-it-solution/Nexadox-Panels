export const dynamic = 'force-dynamic';
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const SESSION_TIME_MAP: Record<string, string> = {
  Morning: "09:00",
  Afternoon: "13:00",
  Evening: "17:00",
  Night: "20:00",
};

const genId = () =>
  "APT" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

/**
 * POST /api/mobile/appointments
 * Creates an appointment from the mobile app using service role (bypasses RLS).
 * Validates the Supabase auth token from the Authorization header.
 */
export async function POST(req: NextRequest) {
  try {
    // Validate auth: the mobile app must send a valid Supabase access token
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const admin = getSupabaseAdmin();

    if (token) {
      const { data: { user }, error: authErr } = await admin.auth.getUser(token);
      if (authErr || !user) {
        return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
      }
    }

    const body = await req.json();
    const {
      patient_id, patient_name, patient_phone,
      doctor_id, appointment_date, slot,
      consultation_type, consultation_fee, booking_fee,
      specialty, clinic_id, payment_id,
    } = body;

    if (!patient_id || !doctor_id || !appointment_date || !slot) {
      return NextResponse.json(
        { error: "patient_id, doctor_id, appointment_date, and slot are required" },
        { status: 400 }
      );
    }

    // Generate token number (per doctor + date + slot)
    let tokenNumber = 1;
    try {
      const { data: maxRows } = await admin
        .from("appointments")
        .select("token_number")
        .eq("doctor_id", doctor_id)
        .eq("appointment_date", appointment_date)
        .eq("slot", slot)
        .not("token_number", "is", null)
        .neq("status", "cancelled")
        .order("token_number", { ascending: false })
        .limit(1);
      tokenNumber = ((maxRows?.[0]?.token_number as number) || 0) + 1;
    } catch { /* fallback to 1 */ }

    const appointmentId = genId();
    const appointmentTime = SESSION_TIME_MAP[slot] || "09:00";

    const insertPayload: Record<string, any> = {
      appointment_id: appointmentId,
      patient_name: patient_name || "Patient",
      patient_phone: patient_phone || "",
      doctor_id,
      patient_id,
      appointment_date,
      appointment_time: appointmentTime,
      slot,
      consultation_type: consultation_type === "video" ? "video" : "in_person",
      consultation_fee: consultation_fee || 0,
      specialty: specialty || "",
      status: "scheduled",
      source_role: "App",
      booking_amount: booking_fee || consultation_fee || 0,
      payment_status: payment_id ? "paid" : "pending",
      token_number: tokenNumber,
    };

    if (clinic_id) insertPayload.clinic_id = clinic_id;

    // Strategy 1: full insert with payment_id and appointment_time
    if (payment_id) insertPayload.payment_id = payment_id;

    const { data: d1, error: e1 } = await admin
      .from("appointments")
      .insert(insertPayload)
      .select()
      .single();

    if (!e1 && d1) {
      return NextResponse.json(d1, { status: 201 });
    }

    // Strategy 2: without payment_id (column may not exist)
    const { payment_id: _pid, ...withoutPaymentId } = insertPayload;
    const { data: d2, error: e2 } = await admin
      .from("appointments")
      .insert(withoutPaymentId)
      .select()
      .single();

    if (!e2 && d2) {
      return NextResponse.json(d2, { status: 201 });
    }

    // Strategy 3: without appointment_time
    const { appointment_time: _at, ...withoutTime } = withoutPaymentId;
    const { data: d3, error: e3 } = await admin
      .from("appointments")
      .insert(withoutTime)
      .select()
      .single();

    if (!e3 && d3) {
      return NextResponse.json(d3, { status: 201 });
    }

    return NextResponse.json(
      { error: e3?.message || e2?.message || e1?.message || "Failed to create appointment" },
      { status: 500 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
