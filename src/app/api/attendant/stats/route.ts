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

/**
 * GET /api/attendant/stats
 * Returns queue count + today's check-ins for sidebar
 */
export async function GET(req: NextRequest) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const url = new URL(req.url);
    const doctorIdsParam = url.searchParams.get("doctor_ids");
    const doctorIds = doctorIdsParam
      ? doctorIdsParam.split(",").map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
      : null;

    // Patients currently in queue (checked_in + waiting)
    let queueQuery = getSupabaseAdmin()
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("appointment_date", today)
      .in("status", ["waiting", "in_progress"])
      .eq("checkin_status", "checked_in");
    if (doctorIds?.length) queueQuery = queueQuery.in("doctor_id", doctorIds);
    const { count: queueCount } = await queueQuery;

    // Today's total check-ins (patients already checked in)
    let checkinQuery = getSupabaseAdmin()
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("appointment_date", today)
      .not("checkin_time", "is", "null");
    if (doctorIds?.length) checkinQuery = checkinQuery.in("doctor_id", doctorIds);
    const { count: checkinCount } = await checkinQuery;

    // Today's total appointments (pending + checked-in)
    let totalQuery = getSupabaseAdmin()
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("appointment_date", today)
      .neq("status", "cancelled");
    if (doctorIds?.length) totalQuery = totalQuery.in("doctor_id", doctorIds);
    const { count: todayTotal } = await totalQuery;

    return NextResponse.json({
      currentQueueCount: queueCount || 0,
      todayCheckIns: checkinCount || 0,
      todayAppointments: todayTotal || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
