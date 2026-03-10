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
 * GET /api/admin/attendants
 * Returns all attendants using profiles as single source of truth.
 * Pattern: profiles WHERE role='attendant' LEFT JOIN attendants detail table.
 */
export async function GET() {
  try {
    // 1. Get all profiles with role = 'attendant'
    const { data: profiles, error: profileErr } = await getSupabaseAdmin()
      .from("profiles")
      .select("id, role, name, email, phone, status, created_at")
      .eq("role", "attendant")
      .order("created_at", { ascending: false });

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    // 2. Get all attendant detail rows
    const { data: attRows } = await getSupabaseAdmin()
      .from("attendants")
      .select("*")
      .order("created_at", { ascending: false });

    const attendantDetails = attRows || [];

    // 3. Build lookup: profile_id | user_id -> attendant details
    const attByProfileId: Record<string, any> = {};
    attendantDetails.forEach((a: any) => {
      if (a.profile_id) attByProfileId[String(a.profile_id)] = a;
      else if (a.user_id) attByProfileId[String(a.user_id)] = a;
    });

    // 4. Merge: profiles LEFT JOIN attendants
    const merged = (profiles || []).map((p: any) => {
      const att = attByProfileId[String(p.id)];
      return {
        id: att?.id || null,
        user_id: p.id,
        profile_id: p.id,
        assigned_doctors: att?.assigned_doctors || [],
        assigned_clinic_ids: att?.assigned_clinic_ids || [],
        created_at: att?.created_at || p.created_at,
        updated_at: att?.updated_at || p.created_at,
        user: {
          id: p.id,
          name: p.name || "Unknown",
          email: p.email || "",
          phone: p.phone || null,
          mobile: p.phone || null,
          status: p.status || "active",
          created_at: p.created_at,
          auth_user_id: p.id,
        },
      };
    });

    return NextResponse.json({ attendants: merged });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/attendants
 * Deletes an attendant. Deletes auth user which cascades to profile + role tables.
 * Body: { attendant_id, user_id }
 */
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { attendant_id, user_id } = body;

    if (!attendant_id && !user_id) {
      return NextResponse.json(
        { error: "attendant_id or user_id is required." },
        { status: 400 }
      );
    }

    // Delete attendant detail row
    if (attendant_id) {
      await getSupabaseAdmin().from("attendants").delete().eq("id", attendant_id);
    }

    // Delete auth user (cascades to profiles via FK, which cascades to attendants via FK)
    if (user_id) {
      const isUuid = typeof user_id === "string" && user_id.includes("-");
      if (isUuid) {
        try {
          await getSupabaseAdmin().auth.admin.deleteUser(user_id);
        } catch (_e) {
          /* ok */
        }
        // Clean up users table (backward compat)
        await getSupabaseAdmin().from("users").delete().eq("auth_user_id", user_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error." },
      { status: 500 }
    );
  }
}

