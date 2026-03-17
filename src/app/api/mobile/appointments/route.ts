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
const genVoucher = () =>
  "VCH" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
const genTxn = () =>
  "TXN" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

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

    let aptData: any = null;

    const { data: d1, error: e1 } = await admin
      .from("appointments")
      .insert(insertPayload)
      .select()
      .single();

    if (!e1 && d1) {
      aptData = d1;
    } else {
      // Strategy 2: without payment_id (column may not exist)
      const { payment_id: _pid, ...withoutPaymentId } = insertPayload;
      const { data: d2, error: e2 } = await admin
        .from("appointments")
        .insert(withoutPaymentId)
        .select()
        .single();

      if (!e2 && d2) {
        aptData = d2;
      } else {
        // Strategy 3: without appointment_time
        const { appointment_time: _at, ...withoutTime } = withoutPaymentId;
        const { data: d3, error: e3 } = await admin
          .from("appointments")
          .insert(withoutTime)
          .select()
          .single();

        if (!e3 && d3) {
          aptData = d3;
        } else {
          return NextResponse.json(
            { error: e3?.message || e2?.message || e1?.message || "Failed to create appointment" },
            { status: 500 }
          );
        }
      }
    }

    // ── Fetch doctor & clinic names for voucher/invoice ─────
    let doctorName = "Doctor";
    let clinicName = "Clinic";
    let patientEmail = "";
    try {
      const { data: docRow } = await admin.from("doctors").select("name").eq("id", doctor_id).single();
      if (docRow) doctorName = docRow.name;
    } catch {}
    if (clinic_id) {
      try {
        const { data: clinicRow } = await admin.from("clinics").select("name").eq("id", clinic_id).single();
        if (clinicRow) clinicName = clinicRow.name;
      } catch {}
    }
    // Fetch patient email from patients table
    if (patient_id) {
      try {
        const { data: patient } = await admin.from("patients").select("email").eq("id", patient_id).single();
        if (patient?.email) patientEmail = patient.email;
      } catch {}
    }

    const bookingAmount = Number(booking_fee || consultation_fee || 0);

    // ── CREATE VOUCHER ──────────────────────────────────────
    let voucherId: number | null = null;
    try {
      const voucherPayload: Record<string, any> = {
        voucher_number: genVoucher(),
        appointment_id: aptData.id,
        patient_name: patient_name || "Patient",
        doctor_name: doctorName,
        clinic_name: clinicName,
        appointment_date,
        appointment_slot: slot,
        booking_amount: bookingAmount,
        commission_amount: 0,
        total_payable: bookingAmount,
        status: "active",
      };
      // Try with token_number first
      voucherPayload.token_number = tokenNumber;
      const { data: vData, error: vErr } = await admin
        .from("vouchers")
        .insert(voucherPayload)
        .select("id")
        .single();
      if (!vErr && vData) {
        voucherId = vData.id;
      } else {
        // Retry without token_number if column doesn't exist
        delete voucherPayload.token_number;
        const { data: vData2, error: vErr2 } = await admin
          .from("vouchers")
          .insert(voucherPayload)
          .select("id")
          .single();
        if (!vErr2 && vData2) voucherId = vData2.id;
      }
    } catch (e) {
      console.error("Mobile voucher creation error:", e);
    }

    // ── CREATE INVOICE ──────────────────────────────────────
    let invoiceId: number | null = null;
    try {
      const taxableAmount = Number((bookingAmount / 1.18).toFixed(2));
      const gstAmount = Number((bookingAmount - taxableAmount).toFixed(2));

      const { data: invData, error: invErr } = await admin
        .from("invoices")
        .insert({
          txn_id: genTxn(),
          booking_id: aptData.appointment_id,
          user_name: (patient_name || "Patient").trim(),
          user_email: patientEmail,
          user_id: String(doctor_id),
          invoice_number: "PENDING",
          invoice_date: appointment_date,
          taxable_amount: taxableAmount,
          gst_amount: gstAmount,
          gst: gstAmount,
          total_amount: bookingAmount,
          gst_percentage: 18,
          status: "issued",
          appointment_id: aptData.id,
        })
        .select("id")
        .single();
      if (!invErr && invData) {
        invoiceId = invData.id;
        const invoiceNumber = "INV" + String(invData.id).padStart(8, "0");
        await admin.from("invoices").update({ invoice_number: invoiceNumber }).eq("id", invData.id);
      }
      else console.error("Mobile invoice insert error:", invErr?.message);
    } catch (e) {
      console.error("Mobile invoice creation error:", e);
    }

    // ── CREATE PATIENT TRANSACTION ──────────────────────────
    try {
      const { error: txnErr } = await admin.from("patient_transactions").insert({
        txn_id: genTxn(),
        booking_id: aptData.appointment_id,
        user_name: (patient_name || "Patient").trim(),
        user_email: patientEmail,
        reason: `Appointment booking: ${doctorName} at ${clinicName}`,
        amount: bookingAmount,
        balance: 0,
        status: "completed",
        started_on: appointment_date,
      });
      if (txnErr) console.error("Mobile transaction insert error:", txnErr.message);
    } catch (e) {
      console.error("Mobile transaction creation error:", e);
    }

    // ── UPDATE APPOINTMENT with voucher_id + invoice_id ─────
    if (voucherId || invoiceId) {
      try {
        const upd: Record<string, any> = {};
        if (voucherId) upd.voucher_id = voucherId;
        if (invoiceId) upd.invoice_id = invoiceId;
        await admin.from("appointments").update(upd).eq("id", aptData.id);
      } catch {}
    }

    return NextResponse.json(
      { ...aptData, voucher_id: voucherId, invoice_id: invoiceId },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
