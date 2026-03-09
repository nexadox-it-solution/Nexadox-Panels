export const dynamic = 'force-dynamic';
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

    // Patients currently in queue (checked_in + waiting)
    const { count: queueCount } = await getSupabaseAdmin()
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("appointment_date", today)
      .in("status", ["waiting", "in_progress"])
      .eq("checkin_status", "checked_in");

    // Today's total check-ins
    const { count: checkinCount } = await getSupabaseAdmin()
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("appointment_date", today)
      .not("checkin_time", "is", "null");

    return NextResponse.json({
      currentQueueCount: queueCount || 0,
      todayCheckIns: checkinCount || 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
