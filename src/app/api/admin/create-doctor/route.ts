export const dynamic = 'force-dynamic';
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, mobile, password, avatar, status, doctorPayload } = body;

    // ── STEP 1: Create auth user ──────────────────────────────
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { name: name.trim(), role: "doctor" },
    });
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });

    const userId = authData.user?.id;
    if (!userId) return NextResponse.json({ error: "Failed to create auth user." }, { status: 500 });

    // ── STEP 2: Upsert profiles (single source of truth) ─────
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        role: "doctor",
        name: name.trim(),
        email: email.trim(),
        phone: mobile || null,
        status: status || "active",
      }, { onConflict: "id" });

    if (profileErr) {
      console.warn("Profiles upsert warning:", profileErr.message);
    }

    // ── STEP 3: Backward-compat — insert into users table ────
    try {
      await supabaseAdmin
        .from("users")
        .insert({
          name: name.trim(),
          email: email.trim(),
          phone: mobile || null,
          role: "doctor",
          status: status || "active",
          auth_user_id: userId,
        });
    } catch (_e) { /* users table may not exist */ }

    // ── STEP 4: Insert into doctors detail table ──────────────
    const { data: docData, error: docErr } = await supabaseAdmin
      .from("doctors")
      .insert({
        auth_user_id: userId,
        profile_id: userId,
        name: name.trim(),
        email: email.trim(),
        mobile: mobile || null,
        avatar_url: avatar || null,
        status: status || "active",
        ...doctorPayload,
      })
      .select("*")
      .single();

    if (docErr) {
      // Rollback: delete auth user (cascades to profile via FK)
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: docErr.message }, { status: 400 });
    }

    return NextResponse.json({ doctor: docData }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error." }, { status: 500 });
  }
}
