import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * POST /api/admin/delete-user
 * Deletes an auth user by UUID. Uses service role key.
 */
export async function POST(req: NextRequest) {
  try {
    const { auth_user_id } = await req.json();
    if (!auth_user_id) {
      return NextResponse.json({ error: "auth_user_id is required." }, { status: 400 });
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(auth_user_id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error." }, { status: 500 });
  }
}
