export const dynamic = 'force-dynamic';
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * GET /api/attendant/dashboard
 * Returns real-time dashboard data: stats, queue overview, recent check-ins
 */
export async function GET(_req: NextRequest) {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Parallel queries
    const [queueRes, checkinRes, completedRes, allCheckedIn] = await Promise.all([
      // Current queue (waiting)
      supabaseAdmin
        .from("appointments")
        .select("id, token_number, patient_name, doctor_id, checkin_time, status, checkin_status")
        .eq("appointment_date", today)
        .in("status", ["waiting", "in_progress"])
        .eq("checkin_status", "checked_in")
        .order("token_number", { ascending: true }),

      // Today's total check-ins count
      supabaseAdmin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("appointment_date", today)
        .not("checkin_time", "is", "null"),

      // Completed today count
      supabaseAdmin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("appointment_date", today)
        .eq("status", "completed"),

      // Recent check-ins (last 10)
      supabaseAdmin
        .from("appointments")
        .select("id, token_number, patient_name, doctor_id, checkin_time, status, checkin_status")
        .eq("appointment_date", today)
        .not("checkin_time", "is", "null")
        .order("checkin_time", { ascending: false })
        .limit(10),
    ]);

    const queueItems = queueRes.data || [];
    const recentItems = allCheckedIn.data || [];

    // Fetch doctor names for all referenced doctors
    const doctorIds = [...new Set([...queueItems, ...recentItems].filter(a => a.doctor_id).map(a => a.doctor_id))];
    let doctorMap: Record<number, string> = {};
    if (doctorIds.length > 0) {
      const { data: docs } = await supabaseAdmin
        .from("doctors")
        .select("id, name")
        .in("id", doctorIds);
      if (docs) {
        docs.forEach(d => { doctorMap[d.id] = d.name; });
      }
    }

    // Calculate avg wait time
    const waitTimes = queueItems.map(q => {
      if (!q.checkin_time) return 0;
      return Math.max(0, Math.round((Date.now() - new Date(q.checkin_time).getTime()) / 60000));
    });
    const avgWaitTime = waitTimes.length > 0
      ? Math.round(waitTimes.reduce((s, w) => s + w, 0) / waitTimes.length)
      : 0;

    // Queue overview
    const queueOverview = queueItems.slice(0, 8).map(q => ({
      token: q.token_number || 0,
      patient: q.patient_name || "Unknown",
      status: q.status === "in_progress" ? "In Progress" : "Waiting",
      waitTime: q.checkin_time
        ? `${Math.max(0, Math.round((Date.now() - new Date(q.checkin_time).getTime()) / 60000))}m`
        : "0m",
    }));

    // Recent check-ins
    const recentCheckIns = recentItems.map(c => ({
      token: c.token_number || 0,
      patient: c.patient_name || "Unknown",
      doctor: c.doctor_id ? (doctorMap[c.doctor_id] || "Doctor") : "—",
      time: c.checkin_time
        ? new Date(c.checkin_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
        : "—",
      status: c.status || "waiting",
    }));

    return NextResponse.json({
      todayCheckIns: checkinRes.count || 0,
      currentQueue: queueItems.length,
      completedToday: completedRes.count || 0,
      avgWaitTime,
      queueOverview,
      recentCheckIns,
    });
  } catch (err: any) {
    console.error("Dashboard API error:", err);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
