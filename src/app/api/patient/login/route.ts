export const dynamic = 'force-dynamic';
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

function getSupabaseAdmin() {
  return createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || ""),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || ""),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * POST /api/patient/login
 * Authenticates a patient using email + password against the patients table.
 * Returns the patient record if successful.
 *
 * Body: { email: string, password: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    // Find patient by email
    const { data: patient, error } = await getSupabaseAdmin()
      .from("patients")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Server error." }, { status: 500 });
    }

    if (!patient) {
      // Also try case-insensitive match
      const { data: patientCI } = await getSupabaseAdmin()
        .from("patients")
        .select("*")
        .ilike("email", email.trim())
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (!patientCI) {
        return NextResponse.json(
          { error: "No patient found with this email." },
          { status: 401 }
        );
      }

      // Use the case-insensitive match
      return await verifyAndRespond(patientCI, password);
    }

    return await verifyAndRespond(patient, password);
  } catch (err: any) {
    console.error("Patient login error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error." },
      { status: 500 }
    );
  }
}

async function verifyAndRespond(patient: any, password: string) {
  if (!patient.password_hash) {
    return NextResponse.json(
      { error: "Password not set for this account. Please contact admin." },
      { status: 401 }
    );
  }

  // Compare password with hash
  const isValid = await bcrypt.compare(password, patient.password_hash);

  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid password." },
      { status: 401 }
    );
  }

  // Return patient data (exclude password_hash)
  const { password_hash, ...safePatient } = patient;

  return NextResponse.json({
    success: true,
    patient: safePatient,
  });
}
