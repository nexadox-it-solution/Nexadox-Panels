export const dynamic = 'force-dynamic';
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * PATCH /api/admin/update-user
 * Updates profiles (primary) + users (backward-compat) + optional role table.
 * Uses service role key — bypasses RLS.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, name, phone, status, assigned_doctors, assigned_clinic_ids, attendant_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required." }, { status: 400 });
    }

    // Determine if user_id is UUID (profile id) or integer (old users table id)
    const isUuid = typeof user_id === "string" && user_id.includes("-");

    // Build update payload
    const update: Record<string, any> = {};
    if (name !== undefined)   update.name   = name;
    if (phone !== undefined)  update.phone  = phone;
    if (status !== undefined) update.status = status;

    // Update profiles table (primary source of truth)
    if (Object.keys(update).length > 0) {
      if (isUuid) {
        const { error: profileErr } = await getSupabaseAdmin()
          .from("profiles")
          .update(update)
          .eq("id", user_id);
        if (profileErr) {
          console.warn("Profiles update warning:", profileErr.message);
        }
      }

      // Backward-compat: also update users table
      try {
        const usersUpdate = { ...update };
        const { error: userErr } = isUuid
          ? await getSupabaseAdmin().from("users").update(usersUpdate).eq("auth_user_id", user_id)
          : await getSupabaseAdmin().from("users").update(usersUpdate).eq("id", user_id);
        if (userErr) {
          console.warn("Users table update warning:", userErr.message);
        }
      } catch (_e) { /* users table may not exist */ }
    }

    // Update attendants table if attendant_id provided
    if (attendant_id !== undefined) {
      const attUpdate: Record<string, any> = {};

      if (assigned_doctors !== undefined) {
        attUpdate.assigned_doctors = (assigned_doctors || [])
          .map((id: any) => typeof id === "string" ? parseInt(id, 10) : id)
          .filter((id: number) => !isNaN(id));
      }

      if (assigned_clinic_ids !== undefined) {
        attUpdate.assigned_clinic_ids = (assigned_clinic_ids || [])
          .map((id: any) => typeof id === "string" ? parseInt(id, 10) : id)
          .filter((id: number) => !isNaN(id));
      }

      if (Object.keys(attUpdate).length > 0) {
        const { error: attErr } = await getSupabaseAdmin()
          .from("attendants")
          .update(attUpdate)
          .eq("id", attendant_id);
        if (attErr && !attErr.message?.toLowerCase().includes("column")) {
          return NextResponse.json({ error: attErr.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error." }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/update-user
 * Deletes a user by user_id. Deletes auth user which cascades to profiles via FK.
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required." }, { status: 400 });
    }

    const isUuid = typeof user_id === "string" && user_id.includes("-");

    if (isUuid) {
      // Delete auth user — cascades to profiles via FK
      try {
        await getSupabaseAdmin().auth.admin.deleteUser(user_id);
      } catch (_e) { /* ok */ }
      // Also clean up users table
      await getSupabaseAdmin().from("users").delete().eq("auth_user_id", user_id);
    } else {
      // Get auth_user_id from users table first
      const { data: userRow } = await getSupabaseAdmin()
        .from("users")
        .select("auth_user_id")
        .eq("id", user_id)
        .single();
      if (userRow?.auth_user_id) {
        try {
          await getSupabaseAdmin().auth.admin.deleteUser(userRow.auth_user_id);
        } catch (_e) { /* ok */ }
      }
      await getSupabaseAdmin().from("users").delete().eq("id", user_id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error." }, { status: 500 });
  }
}
