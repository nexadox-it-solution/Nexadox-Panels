export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * POST /api/prescriptions
 * Save (insert or update) a prescription using service role (bypasses RLS).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { existingRxId, ...payload } = body;

    if (!payload.appointment_id || !payload.diagnosis) {
      return NextResponse.json({ error: "appointment_id and diagnosis are required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Build column-safe payload: try all columns first, fallback if column missing
    const trySave = async (data: Record<string, any>): Promise<{ id?: number; error?: any }> => {
      if (existingRxId) {
        const { prescription_number, ...updateData } = data;
        const { error } = await admin.from("prescriptions").update(updateData).eq("id", existingRxId);
        return { id: existingRxId, error };
      } else {
        const { data: row, error } = await admin.from("prescriptions").insert(data).select("id").single();
        return { id: row?.id, error };
      }
    };

    // Try with all columns
    let result = await trySave(payload);

    // If column doesn't exist (42703), strip optional new columns and retry
    if (result.error?.code === "42703") {
      const { complaint, patient_id, prescription_number, ...safePayload } = payload;
      result = await trySave(safePayload);
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message || "Save failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: result.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
