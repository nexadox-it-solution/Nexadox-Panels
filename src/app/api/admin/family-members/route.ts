export const dynamic = 'force-dynamic';
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
 * GET /api/admin/family-members?patient_id=123
 * Fetches family members for a patient using service role (bypasses RLS).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const patientId = url.searchParams.get("patient_id");
    if (!patientId) {
      return NextResponse.json({ error: "patient_id is required" }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from("family_members")
      .select("*")
      .eq("patient_id", parseInt(patientId))
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/family-members
 * Adds a family member for a patient using service role (bypasses RLS).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patient_id, name, age, gender, relationship, date_of_birth } = body;

    if (!patient_id || !name) {
      return NextResponse.json({ error: "patient_id and name are required" }, { status: 400 });
    }

    // Check count limit
    const { data: existing } = await getSupabaseAdmin()
      .from("family_members")
      .select("id")
      .eq("patient_id", patient_id);
    if ((existing?.length || 0) >= 5) {
      return NextResponse.json({ error: "Maximum 5 family members allowed." }, { status: 400 });
    }

    const insertData: Record<string, any> = {
      patient_id,
      name: name.trim(),
      age: age || 0,
      gender: gender || "Male",
      relationship: relationship || "Other",
    };
    if (date_of_birth) insertData.date_of_birth = date_of_birth;

    // Try with date_of_birth, fallback without
    let data: any = null;
    const { data: d1, error: e1 } = await getSupabaseAdmin()
      .from("family_members")
      .insert(insertData)
      .select("*")
      .single();

    if (e1 && e1.message?.includes("date_of_birth")) {
      const { date_of_birth: _, ...withoutDob } = insertData;
      const { data: d2, error: e2 } = await getSupabaseAdmin()
        .from("family_members")
        .insert(withoutDob)
        .select("*")
        .single();
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
      data = d2;
    } else if (e1) {
      return NextResponse.json({ error: e1.message }, { status: 500 });
    } else {
      data = d1;
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
