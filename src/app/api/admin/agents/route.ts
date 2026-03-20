export const dynamic = 'force-dynamic';
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabaseAdmin() {
  return createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || ""),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || ""),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * GET /api/admin/agents
 * Fetches all agent detail rows using service role (bypasses RLS).
 */
export async function GET() {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from("agents").select("*");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch agents" }, { status: 500 });
  }
}
