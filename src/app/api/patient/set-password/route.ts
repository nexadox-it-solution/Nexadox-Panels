import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * POST /api/patient/set-password
 * Admin sets or resets a patient's password.
 * Hashes the password and stores in patients.password_hash.
 *
 * Body: { patient_id: number, password: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patient_id, password } = body;

    if (!patient_id || !password) {
      return NextResponse.json(
        { error: "patient_id and password are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Update the patient record
    const { error } = await supabaseAdmin
      .from("patients")
      .update({ password_hash: hash, updated_at: new Date().toISOString() })
      .eq("id", patient_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Password set successfully." });
  } catch (err: any) {
    console.error("Set password error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error." },
      { status: 500 }
    );
  }
}
