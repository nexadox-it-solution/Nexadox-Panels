export const dynamic = 'force-dynamic';
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/run-migration
 * Runs pending schema migrations using service role key.
 * This creates missing columns and functions that can't be done via PostgREST.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const results: string[] = [];

    // 1. Check if date_of_birth column exists in family_members
    const { error: colCheck } = await admin
      .from("family_members")
      .select("date_of_birth")
      .limit(1);

    if (colCheck && colCheck.message.includes("does not exist")) {
      results.push("date_of_birth column missing - needs ALTER TABLE via SQL Editor");
    } else {
      results.push("date_of_birth column: OK");
    }

    // 2. Check if get_next_token function exists
    const { error: fnCheck } = await admin.rpc("get_next_token", {
      p_doctor_id: 1,
      p_appointment_date: "2026-01-01",
      p_slot: "Morning",
    });

    if (fnCheck && fnCheck.message.includes("could not find")) {
      results.push("get_next_token function missing - needs CREATE FUNCTION via SQL Editor");
    } else {
      results.push("get_next_token function: OK");
    }

    return NextResponse.json({
      results,
      migration_sql: `
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/rvvdoibrrgulvfhomlnt/sql/new

ALTER TABLE public.family_members ADD COLUMN IF NOT EXISTS date_of_birth DATE;

CREATE OR REPLACE FUNCTION public.get_next_token(
  p_doctor_id INTEGER, p_appointment_date DATE, p_slot TEXT
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $fn$
DECLARE next_token INTEGER;
BEGIN
  PERFORM 1 FROM appointments WHERE doctor_id = p_doctor_id AND appointment_date = p_appointment_date AND slot = p_slot FOR UPDATE;
  SELECT COALESCE(MAX(token_number), 0) + 1 INTO next_token FROM appointments WHERE doctor_id = p_doctor_id AND appointment_date = p_appointment_date AND slot = p_slot AND token_number IS NOT NULL AND status != 'cancelled';
  RETURN next_token;
END; $fn$;

GRANT EXECUTE ON FUNCTION public.get_next_token(INTEGER, DATE, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_next_token(INTEGER, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_token(INTEGER, DATE, TEXT) TO service_role;
      `.trim(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
