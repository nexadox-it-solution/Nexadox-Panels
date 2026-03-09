import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/admin/reports?type=appointments|transactions|invoices|users
 *    &date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&status=...&limit=5000
 *
 * Returns JSON data for the requested report type.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "appointments";
    const dateFrom = url.searchParams.get("date_from") || "";
    const dateTo = url.searchParams.get("date_to") || "";
    const status = url.searchParams.get("status") || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "5000"), 10000);

    switch (type) {
      case "appointments":
        return await getAppointmentsReport(dateFrom, dateTo, status, limit);
      case "transactions":
        return await getTransactionsReport(dateFrom, dateTo, status, limit);
      case "invoices":
        return await getInvoicesReport(dateFrom, dateTo, limit);
      case "users":
        return await getUsersReport(dateFrom, dateTo, status, limit);
      default:
        return NextResponse.json({ error: "Invalid report type." }, { status: 400 });
    }
  } catch (err: any) {
    console.error("Reports API error:", err);
    return NextResponse.json({ error: err?.message || "Server error." }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════════════════
   Appointments Report
   ═══════════════════════════════════════════════════════════════ */
async function getAppointmentsReport(dateFrom: string, dateTo: string, status: string, limit: number) {
  let query = supabaseAdmin
    .from("appointments")
    .select("id, appointment_id, patient_name, patient_email, patient_phone, doctor_id, clinic_id, appointment_date, appointment_time, slot, status, source_role, booking_amount, commission_amount, payable_amount, token_number, notes, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (dateFrom) query = query.gte("appointment_date", dateFrom);
  if (dateTo) query = query.lte("appointment_date", dateTo);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with doctor names and clinic names
  const doctorIds = [...new Set((data || []).map(a => a.doctor_id).filter(Boolean))];
  const clinicIds = [...new Set((data || []).map(a => a.clinic_id).filter(Boolean))];

  let doctorMap: Record<string, string> = {};
  let clinicMap: Record<string, string> = {};

  if (doctorIds.length > 0) {
    const { data: doctors } = await supabaseAdmin
      .from("doctors")
      .select("id, name")
      .in("id", doctorIds);
    if (doctors) doctorMap = Object.fromEntries(doctors.map(d => [String(d.id), d.name]));
  }

  if (clinicIds.length > 0) {
    const { data: clinics } = await supabaseAdmin
      .from("clinics")
      .select("id, name")
      .in("id", clinicIds);
    if (clinics) clinicMap = Object.fromEntries(clinics.map(c => [String(c.id), c.name]));
  }

  const enriched = (data || []).map(a => ({
    ...a,
    doctor_name: doctorMap[String(a.doctor_id)] || `Doctor #${a.doctor_id}`,
    clinic_name: clinicMap[String(a.clinic_id)] || (a.clinic_id ? `Clinic #${a.clinic_id}` : "N/A"),
  }));

  return NextResponse.json({ report: enriched, total: enriched.length });
}

/* ═══════════════════════════════════════════════════════════════
   Transactions Report (all 4 transaction tables merged)
   ═══════════════════════════════════════════════════════════════ */
async function getTransactionsReport(dateFrom: string, dateTo: string, status: string, limit: number) {
  const tables = [
    { table: "admin_transactions", role: "Admin" },
    { table: "patient_transactions", role: "Patient" },
    { table: "agent_transactions", role: "Agent" },
    { table: "attendant_transactions", role: "Attendant" },
  ];

  const allRows: any[] = [];

  for (const { table, role } of tables) {
    let query = supabaseAdmin
      .from(table)
      .select("id, txn_id, booking_id, user_name, user_email, reason, amount, balance, status, started_on")
      .order("started_on", { ascending: false })
      .limit(Math.ceil(limit / 4));

    if (dateFrom) query = query.gte("started_on", dateFrom);
    if (dateTo) query = query.lte("started_on", dateTo);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (!error && data) {
      allRows.push(...data.map(r => ({ ...r, source_role: role })));
    }
  }

  // Sort combined by started_on desc
  allRows.sort((a, b) => new Date(b.started_on).getTime() - new Date(a.started_on).getTime());

  return NextResponse.json({ report: allRows.slice(0, limit), total: allRows.length });
}

/* ═══════════════════════════════════════════════════════════════
   Invoices Report
   ═══════════════════════════════════════════════════════════════ */
async function getInvoicesReport(dateFrom: string, dateTo: string, limit: number) {
  let query = supabaseAdmin
    .from("invoices")
    .select("id, txn_id, booking_id, user_name, user_email, invoice_number, invoice_date, taxable_amount, gst, gst_percentage, total_amount, status, appointment_id, created_at")
    .order("invoice_date", { ascending: false })
    .limit(limit);

  if (dateFrom) query = query.gte("invoice_date", dateFrom);
  if (dateTo) query = query.lte("invoice_date", dateTo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ report: data || [], total: (data || []).length });
}

/* ═══════════════════════════════════════════════════════════════
   Users Report (profiles + role counts)
   ═══════════════════════════════════════════════════════════════ */
async function getUsersReport(dateFrom: string, dateTo: string, status: string, limit: number) {
  let query = supabaseAdmin
    .from("profiles")
    .select("id, name, email, phone, role, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    // Fallback: try patients table if profiles doesn't exist
    let pQuery = supabaseAdmin
      .from("patients")
      .select("id, name, email, phone, status, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (dateFrom) pQuery = pQuery.gte("created_at", dateFrom);
    if (dateTo) pQuery = pQuery.lte("created_at", dateTo + "T23:59:59");
    if (status) pQuery = pQuery.eq("status", status);

    const { data: pData, error: pErr } = await pQuery;
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    const enriched = (pData || []).map(p => ({ ...p, role: "Patient" }));
    return NextResponse.json({ report: enriched, total: enriched.length });
  }

  return NextResponse.json({ report: data || [], total: (data || []).length });
}
