export const dynamic = 'force-dynamic';
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getSupabaseAdmin() {
  return createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || ""),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || ""),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/* ─── Helpers ───────────────────────────────────────────────── */
const genId = () =>
  "APT" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
const genVoucher = () =>
  "VCH" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
const genTxn = () =>
  "TXN" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

const SESSION_TIME_MAP: Record<string, string> = {
  Morning: "09:00",
  Afternoon: "13:00",
  Evening: "17:00",
  Night: "20:00",
};

/**
 * GET /api/admin/appointments
 * Fetches all appointments using service role key (bypasses RLS).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "500");

    const { data, error } = await getSupabaseAdmin()
      .from("appointments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ appointments: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error." }, { status: 500 });
  }
}

/**
 * POST /api/admin/appointments
 * Creates an appointment + voucher + invoice + transaction.
 * Uses service role key — bypasses RLS and handles appointment_time NOT NULL.
 *
 * Body: {
 *   patient_name, patient_email?, patient_phone?,
 *   doctor_id, clinic_id, appointment_date, slot,
 *   source_role: "Admin"|"Agent"|"Attendant"|"App",
 *   booking_amount, commission_amount, payable_amount,
 *   doctor_name, clinic_name,
 *   notes?, token_number?, agent_user_id? (required if source_role="Agent")
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      patient_name, patient_email, patient_phone,
      doctor_id, clinic_id, appointment_date, slot,
      source_role = "Admin",
      booking_amount = 0, commission_amount = 0, payable_amount = 0,
      doctor_name = "", clinic_name = "",
      notes, token_number, agent_user_id, agent_id,
    } = body;

    if (!patient_name || !doctor_id || !appointment_date || !slot) {
      return NextResponse.json(
        { error: "patient_name, doctor_id, appointment_date, and slot are required." },
        { status: 400 }
      );
    }

    /* ──────────────────────────────────────────────────────────
       WALLET BALANCE CHECK (Agent bookings only)
       Agent must have sufficient wallet balance to cover payableAmount.
    ────────────────────────────────────────────────────────── */
    let agentRecord: any = null;
    if (source_role === "Agent" && agent_id) {
      const { data: agData, error: agErr } = await getSupabaseAdmin()
        .from("agents")
        .select("*")
        .eq("id", agent_id)
        .single();

      if (agErr || !agData) {
        return NextResponse.json(
          { error: "Agent not found. Cannot process booking." },
          { status: 404 }
        );
      }

      agentRecord = agData;
      const currentBalance = Number(agData.wallet_balance) || 0;
      if (currentBalance < payable_amount) {
        return NextResponse.json(
          { error: `Insufficient wallet balance. Required: ₹${payable_amount}, Available: ₹${currentBalance}. Please top up your wallet.` },
          { status: 400 }
        );
      }
    }

    const appointmentId = genId();
    // appointment_time: use a default time from session, or "00:00" — prevents NOT NULL violation
    const appointmentTime = SESSION_TIME_MAP[slot] || "09:00";

    /* ──────────────────────────────────────────────────────────
       0a. FETCH DOCTOR'S APPOINTMENT FEE (consultation fee at clinic)
    ────────────────────────────────────────────────────────── */
    let doctorAppointmentFee = 0;
    try {
      const { data: docData } = await getSupabaseAdmin().from("doctors").select("appointment_fee").eq("id", doctor_id).single();
      if (docData?.appointment_fee) doctorAppointmentFee = Number(docData.appointment_fee);
    } catch {}

    /* ──────────────────────────────────────────────────────────
       0. UPSERT PATIENT RECORD
       Ensures every booked patient exists in the patients table.
    ────────────────────────────────────────────────────────── */
    let linkedPatientId: number | null = null;
    try {
      // Check if patient already exists by phone or email
      let existingPatient: any = null;
      if (patient_phone) {
        const { data } = await getSupabaseAdmin().from("patients").select("id").eq("phone", patient_phone).limit(1).single();
        if (data) existingPatient = data;
      }
      if (!existingPatient && patient_email) {
        const { data } = await getSupabaseAdmin().from("patients").select("id").eq("email", patient_email).limit(1).single();
        if (data) existingPatient = data;
      }

      if (existingPatient) {
        linkedPatientId = existingPatient.id;
      } else {
        // Create new patient record
        const { data: newPatient } = await getSupabaseAdmin()
          .from("patients")
          .insert({
            name: patient_name.trim(),
            email: patient_email || null,
            phone: patient_phone || null,
            status: "active",
          })
          .select("id")
          .single();
        if (newPatient) linkedPatientId = newPatient.id;
      }
    } catch (e) {
      console.error("Patient upsert warning:", e);
    }

    /* ──────────────────────────────────────────────────────────
       1. GENERATE TOKEN NUMBER (per doctor + date + slot)
       Token is now assigned at booking time, not at check-in.
    ────────────────────────────────────────────────────────── */
    let assignedToken: number | null = token_number || null;
    if (!assignedToken) {
      try {
        // Try atomic DB function first (prevents duplicate tokens)
        const { data: rpcToken, error: rpcErr } = await getSupabaseAdmin().rpc("get_next_token", {
          p_doctor_id: doctor_id,
          p_appointment_date: appointment_date,
          p_slot: slot || "Morning",
        });
        if (!rpcErr && rpcToken != null) {
          assignedToken = rpcToken;
        } else {
          // Fallback: query max + 1
          let tokenQuery = getSupabaseAdmin()
            .from("appointments")
            .select("token_number")
            .eq("doctor_id", doctor_id)
            .eq("appointment_date", appointment_date)
            .not("token_number", "is", "null")
            .neq("status", "cancelled");
          if (slot) tokenQuery = tokenQuery.eq("slot", slot);
          const { data: maxTokenRows } = await tokenQuery
            .order("token_number", { ascending: false })
            .limit(1);
          assignedToken = ((maxTokenRows?.[0]?.token_number as number) || 0) + 1;
        }
      } catch (e) {
        console.error("Token generation warning:", e);
        assignedToken = 1;
      }
    }

    /* ──────────────────────────────────────────────────────────
       2. CREATE APPOINTMENT
    ────────────────────────────────────────────────────────── */
    const insertPayload: Record<string, any> = {
      appointment_id: appointmentId,
      patient_name: patient_name.trim(),
      patient_email: patient_email || null,
      patient_phone: patient_phone || null,
      patient_id: linkedPatientId,
      doctor_id,
      clinic_id: clinic_id || null,
      appointment_date,
      appointment_time: appointmentTime,
      slot,
      status: "scheduled",
      source_role,
      booking_amount,
      commission_amount,
      payable_amount,
      consultation_fee: doctorAppointmentFee,
      notes: notes || null,
      token_number: assignedToken,
    };
    if (source_role === "Agent" && agent_id) {
      // created_by_agent_id references users(id) INT — only set if user_id is a valid integer
      const agentUserId = agentRecord?.user_id;
      if (agentUserId != null && Number.isInteger(Number(agentUserId))) {
        insertPayload.created_by_agent_id = Number(agentUserId);
      }
    }

    // Strategy 1: full insert
    let aptData: any = null;
    let aptError: any = null;

    const { data: d1, error: e1 } = await getSupabaseAdmin()
      .from("appointments")
      .insert(insertPayload)
      .select("*")
      .single();

    if (!e1) {
      aptData = d1;
    } else {
      // Strategy 2: without appointment_time (maybe column was removed)
      const { appointment_time, ...withoutTime } = insertPayload;
      const { data: d2, error: e2 } = await getSupabaseAdmin()
        .from("appointments")
        .insert(withoutTime)
        .select("*")
        .single();
      if (!e2) {
        aptData = d2;
      } else {
        aptError = e2;
      }
    }

    if (aptError || !aptData) {
      return NextResponse.json(
        { error: aptError?.message || "Failed to create appointment." },
        { status: 500 }
      );
    }

    /* ──────────────────────────────────────────────────────────
       3. CREATE VOUCHER (includes token_number)
    ────────────────────────────────────────────────────────── */
    const voucherNumber = genVoucher();
    let voucherId: number | null = null;

    try {
      const voucherPayload: Record<string, any> = {
        voucher_number: voucherNumber,
        appointment_id: aptData.id,
        patient_name: patient_name.trim(),
        doctor_name,
        clinic_name,
        appointment_date,
        appointment_slot: slot,
        booking_amount,
        commission_amount,
        total_payable: payable_amount,
        status: "active",
      };
      // Include token_number in voucher (column may not exist yet — graceful fallback)
      try {
        voucherPayload.token_number = assignedToken;
        const { data: vData, error: vErr } = await getSupabaseAdmin()
          .from("vouchers")
          .insert(voucherPayload)
          .select("id")
          .single();
        if (!vErr && vData) voucherId = vData.id;
        else {
          // Retry without token_number if column doesn't exist
          delete voucherPayload.token_number;
          const { data: vData2, error: vErr2 } = await getSupabaseAdmin()
            .from("vouchers")
            .insert(voucherPayload)
            .select("id")
            .single();
          if (!vErr2 && vData2) voucherId = vData2.id;
          else console.error("Voucher insert error:", vErr2?.message);
        }
      } catch (ve) {
        delete voucherPayload.token_number;
        const { data: vData3, error: vErr3 } = await getSupabaseAdmin()
          .from("vouchers")
          .insert(voucherPayload)
          .select("id")
          .single();
        if (!vErr3 && vData3) voucherId = vData3.id;
      }
    } catch (e) {
      console.error("Voucher error:", e);
    }

    /* ──────────────────────────────────────────────────────────
       4. CREATE INVOICE
    ────────────────────────────────────────────────────────── */
    let invoiceId: number | null = null;
    let invoiceNumber = "";
    const taxableAmount = Number((payable_amount / 1.18).toFixed(2));
    const gstAmount = Number((payable_amount - taxableAmount).toFixed(2));

    try {
      const txnId = genTxn();
      const { data: invData, error: invErr } = await getSupabaseAdmin()
        .from("invoices")
        .insert({
          txn_id: txnId,
          booking_id: appointmentId,
          user_name: patient_name.trim(),
          user_email: patient_email || "",
          user_id: String(doctor_id),
          invoice_number: "PENDING",
          invoice_date: appointment_date,
          taxable_amount: taxableAmount,
          gst_amount: gstAmount,
          gst: gstAmount,
          total_amount: payable_amount,
          gst_percentage: 18,
          status: "issued",
          appointment_id: aptData.id,
        })
        .select("id")
        .single();
      if (!invErr && invData) {
        invoiceId = invData.id;
        invoiceNumber = "INV" + String(invData.id).padStart(8, "0");
        await getSupabaseAdmin().from("invoices").update({ invoice_number: invoiceNumber }).eq("id", invData.id);
      }
      else console.error("Invoice insert error:", invErr?.message);
    } catch (e) {
      console.error("Invoice error:", e);
    }

    /* ──────────────────────────────────────────────────────────
       5. CREATE TRANSACTION (based on source_role)
       - Admin    → admin_transactions
       - Agent    → agent_transactions
       - Attendant→ attendant_transactions
       - App      → patient_transactions
    ────────────────────────────────────────────────────────── */
    const txnTableMap: Record<string, string> = {
      Admin: "admin_transactions",
      Agent: "agent_transactions",
      Attendant: "attendant_transactions",
      App: "patient_transactions",
    };
    const txnTable = txnTableMap[source_role] || "admin_transactions";

    try {
      const newBalance = source_role === "Agent" && agentRecord
        ? Math.max(0, (Number(agentRecord.wallet_balance) || 0) - payable_amount)
        : 0;

      const { error: txnErr } = await getSupabaseAdmin().from(txnTable).insert({
        txn_id: genTxn(),
        booking_id: appointmentId,
        user_id: source_role === "Agent" && agent_user_id ? String(agent_user_id) : undefined,
        user_name: patient_name.trim(),
        user_email: patient_email || "",
        reason: `Appointment booking: ${doctor_name} at ${clinic_name}`,
        amount: payable_amount,
        balance: newBalance,
        status: "completed",
        started_on: appointment_date,
      });
      if (txnErr) {
        console.error(`Transaction insert to ${txnTable} error:`, txnErr.message);
        // Fallback: if table doesn't exist, try patient_transactions
        if (txnTable !== "patient_transactions") {
          await getSupabaseAdmin().from("patient_transactions").insert({
            txn_id: genTxn(),
            booking_id: appointmentId,
            user_name: patient_name.trim(),
            user_email: patient_email || "",
            reason: `Appointment booking: ${doctor_name} at ${clinic_name}`,
            amount: payable_amount,
            balance: 0,
            status: "completed",
            started_on: appointment_date,
          });
        }
      }
    } catch (e) {
      console.error("Transaction error:", e);
    }

    /* ──────────────────────────────────────────────────────────
       5b. DEDUCT FROM AGENT WALLET (Agent bookings only)
    ────────────────────────────────────────────────────────── */
    if (source_role === "Agent" && agentRecord && payable_amount > 0) {
      try {
        const currentBalance = Number(agentRecord.wallet_balance) || 0;
        const newBalance = Math.max(0, currentBalance - payable_amount);

        // Try with updated_at first, fall back without it if column doesn't exist
        const { error: walletErr } = await getSupabaseAdmin()
          .from("agents")
          .update({ wallet_balance: newBalance, updated_at: new Date().toISOString() })
          .eq("id", agentRecord.id);

        if (walletErr) {
          console.error("Wallet deduction attempt 1 error:", walletErr.message);
          // Retry without updated_at in case column doesn't exist
          const { error: walletErr2 } = await getSupabaseAdmin()
            .from("agents")
            .update({ wallet_balance: newBalance })
            .eq("id", agentRecord.id);
          if (walletErr2) {
            console.error("Wallet deduction attempt 2 error:", walletErr2.message);
          }
        }
      } catch (e) {
        console.error("Agent wallet deduction error:", e);
      }
    }

    /* ──────────────────────────────────────────────────────────
       6. UPDATE APPOINTMENT with voucher_id + invoice_id
    ────────────────────────────────────────────────────────── */
    if (voucherId || invoiceId) {
      try {
        await getSupabaseAdmin()
          .from("appointments")
          .update({
            voucher_id: voucherId,
            invoice_id: invoiceId,
          })
          .eq("id", aptData.id);
      } catch (_e) { /* non-critical */ }
    }

    return NextResponse.json({
      appointment: { ...aptData, voucher_id: voucherId, invoice_id: invoiceId, token_number: assignedToken },
      voucher_number: voucherNumber,
      invoice_number: invoiceNumber,
      appointment_id: appointmentId,
      token_number: assignedToken,
    }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/admin/appointments error:", err);
    return NextResponse.json({ error: err?.message || "Server error." }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/appointments
 * Updates appointment status OR generates missing voucher/invoice/transaction.
 * Body: { id, status } — update status
 * Body: { id, action: "generate-records" } — create missing voucher/invoice/transaction
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, action } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    /* ── Generate missing voucher/invoice/transaction ───────── */
    if (action === "generate-records") {
      const { data: apt, error: aptErr } = await admin
        .from("appointments")
        .select("*")
        .eq("id", id)
        .single();

      if (aptErr || !apt) {
        return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
      }

      let doctorName = "Doctor";
      let clinicName = "Clinic";
      try {
        const { data: d } = await admin.from("doctors").select("name").eq("id", apt.doctor_id).single();
        if (d) doctorName = d.name;
      } catch {}
      if (apt.clinic_id) {
        try {
          const { data: c } = await admin.from("clinics").select("name").eq("id", apt.clinic_id).single();
          if (c) clinicName = c.name;
        } catch {}
      }
      // Resolve patient email from patients/profiles if not on appointment
      let patientEmail = apt.patient_email || "";
      if (!patientEmail && apt.patient_id) {
        try {
          const { data: p } = await admin.from("patients").select("email").eq("id", apt.patient_id).single();
          if (p?.email) patientEmail = p.email;
        } catch {}
      }

      const bookingAmount = Number(apt.booking_amount) || 0;
      let voucherId = apt.voucher_id;
      let invoiceId = apt.invoice_id;

      // Create voucher if missing
      if (!voucherId) {
        try {
          const vPayload: Record<string, any> = {
            voucher_number: genVoucher(),
            appointment_id: apt.id,
            patient_name: apt.patient_name || "Patient",
            doctor_name: doctorName,
            clinic_name: clinicName,
            appointment_date: apt.appointment_date,
            appointment_slot: apt.slot,
            booking_amount: bookingAmount,
            commission_amount: Number(apt.commission_amount) || 0,
            total_payable: Number(apt.payable_amount) || bookingAmount,
            status: "active",
            token_number: apt.token_number || 1,
          };
          const { data: vD, error: vE } = await admin.from("vouchers").insert(vPayload).select("id").single();
          if (!vE && vD) voucherId = vD.id;
          else {
            delete vPayload.token_number;
            const { data: vD2 } = await admin.from("vouchers").insert(vPayload).select("id").single();
            if (vD2) voucherId = vD2.id;
          }
        } catch {}
      }

      // Create invoice if missing
      if (!invoiceId) {
        try {
          const taxable = Number((bookingAmount / 1.18).toFixed(2));
          const gst = Number((bookingAmount - taxable).toFixed(2));
          const { data: iD } = await admin.from("invoices").insert({
            txn_id: genTxn(),
            booking_id: apt.appointment_id,
            user_name: (apt.patient_name || "Patient").trim(),
            user_email: patientEmail,
            user_id: String(apt.doctor_id),
            invoice_number: "PENDING",
            invoice_date: apt.appointment_date,
            taxable_amount: taxable,
            gst_amount: gst,
            gst: gst,
            total_amount: bookingAmount,
            gst_percentage: 18,
            status: "issued",
            appointment_id: apt.id,
          }).select("id").single();
          if (iD) {
            invoiceId = iD.id;
            await admin.from("invoices").update({ invoice_number: "INV" + String(iD.id).padStart(8, "0") }).eq("id", iD.id);
          }
        } catch {}
      }

      // Create patient_transaction if missing
      try {
        const { data: existTxn } = await admin
          .from("patient_transactions")
          .select("id")
          .eq("booking_id", apt.appointment_id)
          .limit(1);
        if (!existTxn || existTxn.length === 0) {
          await admin.from("patient_transactions").insert({
            txn_id: genTxn(),
            booking_id: apt.appointment_id,
            user_name: (apt.patient_name || "Patient").trim(),
            user_email: patientEmail,
            reason: `Appointment booking: ${doctorName} at ${clinicName}`,
            amount: bookingAmount,
            balance: 0,
            status: "completed",
            started_on: apt.appointment_date,
          });
        }
      } catch {}

      // Update appointment with voucher_id + invoice_id
      if (voucherId || invoiceId) {
        const upd: Record<string, any> = { updated_at: new Date().toISOString() };
        if (voucherId) upd.voucher_id = voucherId;
        if (invoiceId) upd.invoice_id = invoiceId;
        await admin.from("appointments").update(upd).eq("id", id);
      }

      return NextResponse.json({ success: true, voucher_id: voucherId, invoice_id: invoiceId });
    }

    /* ── Status update (original logic) ────────────────────── */
    if (!status) {
      return NextResponse.json({ error: "status or action required." }, { status: 400 });
    }

    const { error } = await admin
      .from("appointments")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If cancelled, also cancel the voucher
    if (status === "cancelled") {
      const { data: apt } = await admin
        .from("appointments")
        .select("voucher_id")
        .eq("id", id)
        .single();
      if (apt?.voucher_id) {
        await admin
          .from("vouchers")
          .update({ status: "cancelled" })
          .eq("id", apt.voucher_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error." }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/appointments
 * Bulk delete appointments only by date range or specific IDs.
 * Does NOT delete related vitals, prescriptions, queue records.
 * Body: { ids?: number[], dateFrom?: string, dateTo?: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids, dateFrom, dateTo } = body as {
      ids?: number[];
      dateFrom?: string;
      dateTo?: string;
    };

    let deletedCount = 0;

    if (ids && ids.length > 0) {
      const { data, error } = await getSupabaseAdmin()
        .from("appointments")
        .delete()
        .in("id", ids)
        .select("id");

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      deletedCount = data?.length || 0;

    } else if (dateFrom && dateTo) {
      const { data, error } = await getSupabaseAdmin()
        .from("appointments")
        .delete()
        .gte("appointment_date", dateFrom)
        .lte("appointment_date", dateTo)
        .select("id");

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      deletedCount = data?.length || 0;
    } else {
      return NextResponse.json({ error: "Provide 'ids' array or 'dateFrom'+'dateTo' range." }, { status: 400 });
    }

    return NextResponse.json({ success: true, deletedCount });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error." }, { status: 500 });
  }
}
