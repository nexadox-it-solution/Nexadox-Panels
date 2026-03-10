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
 * GET /api/attendant/doctors
 * Returns all active doctors (id, name, specialty_ids, clinic_ids)
 */
export async function GET(_req: NextRequest) {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("doctors")
      .select("id, name, specialty_ids, clinic_ids, appointment_fee, consultation_fee, booking_fee, status")
      .eq("status", "active")
      .order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ doctors: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
