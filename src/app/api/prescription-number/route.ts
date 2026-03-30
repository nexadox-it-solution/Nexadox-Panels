export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * GET /api/prescription-number
 * Returns the next prescription number in NDP/000000001 format
 */
export async function GET() {
  try {
    const admin = getSupabaseAdmin();

    // Get the max existing prescription number
    const { data, error } = await admin
      .from("prescriptions")
      .select("prescription_number")
      .not("prescription_number", "is", null)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextNum = 1;
    if (data?.prescription_number) {
      const match = data.prescription_number.match(/NDP\/(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }

    const prescriptionNumber = `NDP/${String(nextNum).padStart(9, "0")}`;
    return NextResponse.json({ prescription_number: prescriptionNumber, sequence: nextNum });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to generate prescription number" }, { status: 500 });
  }
}
