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
 * POST /api/admin/create-user
 * Creates an auth user + profiles row + role-specific table row.
 * Uses service role key — no session side effects.
 *
 * ARCHITECTURE:
 *   1. Create auth.users entry → triggers handle_new_user() → auto-creates profiles row
 *   2. Upsert profiles with correct role/name/email/phone/status
 *   3. Insert into role-specific extension table (optional detail data)
 *   4. Backward-compat: also upsert into users table
 *
 * Body: { name, email, mobile, password, role, status, rolePayload? }
 *   role: "admin" | "patient" | "agent" | "attendant"
 *   rolePayload: extra fields for the role-specific table
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, mobile, password, role, status, rolePayload } = body;

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: "name, email, password, and role are required." },
        { status: 400 }
      );
    }

    const validRoles = ["admin", "patient", "agent", "attendant"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    // ── STEP 1: Create auth user ──────────────────────────────
    let authUserId: string;

    const { data: authData, error: authErr } =
      await getSupabaseAdmin().auth.admin.createUser({
        email: email.trim(),
        password,
        email_confirm: true,
        user_metadata: { name: name.trim(), role },
      });

    if (authErr) {
      // If user already exists in auth, recover the orphan
      if (
        authErr.message?.toLowerCase().includes("already") ||
        authErr.message?.toLowerCase().includes("registered") ||
        authErr.message?.toLowerCase().includes("exists")
      ) {
        const { data: listData } = await getSupabaseAdmin().auth.admin.listUsers();
        const existingAuth = listData?.users?.find(
          (u: any) => u.email?.toLowerCase() === email.trim().toLowerCase()
        );
        if (!existingAuth) {
          return NextResponse.json(
            { error: "Auth user exists but could not be found. Try a different email." },
            { status: 400 }
          );
        }
        authUserId = existingAuth.id;
        await getSupabaseAdmin().auth.admin.updateUserById(authUserId, {
          password,
          user_metadata: { name: name.trim(), role },
        });
      } else {
        return NextResponse.json({ error: authErr.message }, { status: 400 });
      }
    } else {
      authUserId = authData.user?.id || "";
      if (!authUserId) {
        return NextResponse.json({ error: "Failed to create auth user." }, { status: 500 });
      }
    }

    // ── STEP 2: Upsert into profiles (single source of truth) ─
    const { error: profileErr } = await getSupabaseAdmin()
      .from("profiles")
      .upsert(
        {
          id: authUserId,
          role,
          name: name.trim(),
          email: email.trim(),
          phone: mobile || null,
          status: status || "active",
        },
        { onConflict: "id" }
      );

    if (profileErr) {
      console.warn("Profiles upsert warning:", profileErr.message);
      // Non-fatal: trigger may have already created it
    }

    // ── STEP 3: Backward-compat — upsert into users table ────
    let userId: number | null = null;
    try {
      const { data: existingUser } = await getSupabaseAdmin()
        .from("users")
        .select("id")
        .eq("auth_user_id", authUserId)
        .single();

      if (existingUser) {
        userId = existingUser.id;
        await getSupabaseAdmin()
          .from("users")
          .update({
            name: name.trim(),
            phone: mobile || null,
            role,
            status: status || "active",
          })
          .eq("id", userId);
      } else {
        const { data: byEmail } = await getSupabaseAdmin()
          .from("users")
          .select("id")
          .eq("email", email.trim())
          .single();

        if (byEmail) {
          userId = byEmail.id;
          await getSupabaseAdmin()
            .from("users")
            .update({
              name: name.trim(),
              phone: mobile || null,
              role,
              status: status || "active",
              auth_user_id: authUserId,
            })
            .eq("id", userId);
        } else {
          const { data: userData } = await getSupabaseAdmin()
            .from("users")
            .insert({
              name: name.trim(),
              email: email.trim(),
              phone: mobile || null,
              role,
              status: status || "active",
              auth_user_id: authUserId,
            })
            .select("id")
            .single();
          userId = userData?.id ?? null;
        }
      }
    } catch (_e) {
      // users table may not exist — non-fatal
    }

    // ── STEP 4: Insert into role-specific extension table ─────
    let roleData = null;
    let roleError = null;

    if (role === "admin") {
      // Insert into admin_details
      const { data, error } = await getSupabaseAdmin()
        .from("admin_details")
        .upsert({ user_id: authUserId }, { onConflict: "user_id" })
        .select("*")
        .single();
      roleData = data;
      if (error) console.warn("admin_details upsert:", error.message);
    } else if (role === "patient") {
      const pi: Record<string, any> = {
        user_id: userId,
        profile_id: authUserId,
      };
      if (rolePayload?.date_of_birth) pi.date_of_birth = rolePayload.date_of_birth;
      if (rolePayload?.gender) pi.gender = rolePayload.gender;
      if (rolePayload?.blood_group) pi.blood_group = rolePayload.blood_group;
      if (rolePayload?.city) pi.city = rolePayload.city;

      const { data, error } = await getSupabaseAdmin()
        .from("patients")
        .insert(pi)
        .select("id")
        .single();
      roleData = data;
      roleError = error;
    } else if (role === "agent") {
      // Check if already exists
      const { data: existing } = await getSupabaseAdmin()
        .from("agents")
        .select("id")
        .eq("profile_id", authUserId)
        .single();

      if (existing) {
        roleData = existing;
      } else {
        const { data, error } = await getSupabaseAdmin()
          .from("agents")
          .insert({
            user_id: authUserId,
            profile_id: authUserId,
            business_name: rolePayload?.business_name || null,
            commission_type: rolePayload?.commission_type || "percentage",
            commission_value: rolePayload?.commission_value ?? 10,
            approval_status: rolePayload?.approval_status || "pending",
            wallet_balance: 0,
          })
          .select("*")
          .single();
        roleData = data;
        roleError = error;
      }
    } else if (role === "attendant") {
      const doctorIds = (rolePayload?.assigned_doctors || [])
        .map((id: any) => (typeof id === "string" ? parseInt(id, 10) : id))
        .filter((id: number) => !isNaN(id));

      const clinicIds = (rolePayload?.assigned_clinic_ids || [])
        .map((id: any) => (typeof id === "string" ? parseInt(id, 10) : id))
        .filter((id: number) => !isNaN(id));

      // Check if attendant already exists
      const { data: existingAtt } = await getSupabaseAdmin()
        .from("attendants")
        .select("id")
        .eq("profile_id", authUserId)
        .single();

      if (existingAtt) {
        await getSupabaseAdmin()
          .from("attendants")
          .update({
            assigned_doctors: doctorIds,
            assigned_clinic_ids: clinicIds,
          })
          .eq("id", existingAtt.id);
        roleData = existingAtt;
      } else {
        const { data, error } = await getSupabaseAdmin()
          .from("attendants")
          .insert({
            user_id: authUserId,
            profile_id: authUserId,
            full_name: name.trim(),
            email: email.trim(),
            phone: mobile || null,
            status: status || "active",
            assigned_doctors: doctorIds,
            assigned_clinic_ids: clinicIds,
          })
          .select("*")
          .single();
        roleData = data;
        roleError = error;
      }
    }

    if (roleError) {
      console.error(`Role table insert error for ${role}:`, roleError);
    }

    return NextResponse.json(
      {
        user: {
          id: authUserId,
          auth_user_id: authUserId,
          name,
          email,
          role,
          status: status || "active",
        },
        roleData,
        roleError: roleError?.message || null,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server error." },
      { status: 500 }
    );
  }
}
