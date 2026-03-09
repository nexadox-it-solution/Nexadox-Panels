import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * POST /api/attendant/checkin
 * Checks in a patient:
 *   1. Updates patient_dob / patient_gender on the appointment
 *   2. Uses EXISTING token number (assigned at booking time) — no new token generated
 *   3. Saves vitals
 *   4. Marks appointment as waiting / checked_in
 *
 * Token is NOW assigned at booking time, not during check-in.
 * Check-in only changes the status to "waiting" and records vitals.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      appointment_id,
      doctor_id,
      slot,
      // Patient info
      patient_dob,
      patient_gender,
      // Vitals
      height, weight, bmi, bp, spo2, temperature, pulse,
      consultation_type,
    } = body;

    if (!appointment_id) {
      return NextResponse.json({ error: "appointment_id is required." }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0];

    /* ── 1. Get existing token from appointment (assigned at booking) ── */
    const { data: existingApt } = await supabaseAdmin
      .from("appointments")
      .select("token_number")
      .eq("id", appointment_id)
      .single();

    let existingToken = existingApt?.token_number;

    // Fallback: if appointment was created before this change and has no token, generate one
    if (!existingToken) {
      let tokenQuery = supabaseAdmin
        .from("appointments")
        .select("token_number")
        .eq("appointment_date", today)
        .not("token_number", "is", "null")
        .neq("status", "cancelled");
      if (doctor_id) tokenQuery = tokenQuery.eq("doctor_id", doctor_id);
      if (slot) tokenQuery = tokenQuery.eq("slot", slot);
      const { data: maxTokenRows } = await tokenQuery
        .order("token_number", { ascending: false })
        .limit(1);
      existingToken = ((maxTokenRows?.[0]?.token_number as number) || 0) + 1;
    }

    /* ── 2. Update patient info on appointment ─────────────── */
    const updatePayload: Record<string, any> = {
      checkin_status: "checked_in",
      checkin_time: new Date().toISOString(),
      check_in_time: new Date().toISOString(),
      consultation_type: consultation_type || "First Visit",
      token_number: existingToken,
      status: "waiting",
    };
    if (patient_dob) updatePayload.patient_dob = patient_dob;
    if (patient_gender) updatePayload.patient_gender = patient_gender;

    const { error: aptErr } = await supabaseAdmin
      .from("appointments")
      .update(updatePayload)
      .eq("id", appointment_id);

    if (aptErr) {
      return NextResponse.json({ error: aptErr.message }, { status: 500 });
    }

    /* ── 3. Save vitals ────────────────────────────────────── */
    const vitalsPayload: Record<string, any> = {
      appointment_id,
      bp: bp || null,
    };
    if (height) vitalsPayload.height = height;
    if (weight) vitalsPayload.weight = weight;
    if (bmi) vitalsPayload.bmi = bmi;
    if (spo2) vitalsPayload.spo2 = spo2;
    if (temperature) vitalsPayload.temperature = temperature;
    if (pulse) vitalsPayload.pulse = pulse;

    const { error: vErr } = await supabaseAdmin
      .from("vitals")
      .insert(vitalsPayload);

    if (vErr) {
      console.error("Vitals insert error:", vErr.message);
      // Non-critical — token is already assigned
    }

    /* ── 4. Insert into queue table ────────────────────────── */
    try {
      // Get appointment details for queue entry
      const { data: aptData } = await supabaseAdmin
        .from("appointments")
        .select("patient_name, doctor_id, clinic_id")
        .eq("id", appointment_id)
        .single();

      if (aptData) {
        await supabaseAdmin.from("queue").insert({
          appointment_id,
          doctor_id: aptData.doctor_id,
          clinic_id: aptData.clinic_id,
          patient_name: aptData.patient_name,
          token_number: existingToken,
          queue_date: today,
          status: "waiting",
          checked_in_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error("Queue insert error:", e);
    }

    return NextResponse.json({
      success: true,
      token_number: existingToken,
      message: `Token #${existingToken} — Patient checked in (Doctor ${doctor_id}, ${slot || "General"})`,
    });
  } catch (err: any) {
    console.error("POST /api/attendant/checkin error:", err);
    return NextResponse.json({ error: err?.message || "Server error." }, { status: 500 });
  }
}
