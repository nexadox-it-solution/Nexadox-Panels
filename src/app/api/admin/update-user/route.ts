export const dynamic = 'force-dynamic';
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getSupabaseAdmin() {
  return createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || ""),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || ""),
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
    const {
      user_id, name, phone, status, password,
      // Attendant fields
      assigned_doctors, assigned_clinic_ids, attendant_id,
      // Agent fields
      business_name, commission_type, commission_value, approval_status,
    } = body;

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

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
        const { error: profileErr } = await admin
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
          ? await admin.from("users").update(usersUpdate).eq("auth_user_id", user_id)
          : await admin.from("users").update(usersUpdate).eq("id", user_id);
        if (userErr) {
          console.warn("Users table update warning:", userErr.message);
        }
      } catch (_e) { /* users table may not exist */ }
    }

    // ── Upsert agents table (ensures row exists) ──────────────
    if (business_name !== undefined || commission_type !== undefined ||
        commission_value !== undefined || approval_status !== undefined) {
      const agentUpdate: Record<string, any> = {};
      if (business_name !== undefined) agentUpdate.business_name = business_name;
      if (commission_type !== undefined) agentUpdate.commission_type = commission_type;
      if (commission_value !== undefined) agentUpdate.commission_value = commission_value;
      if (approval_status !== undefined) agentUpdate.approval_status = approval_status;

      if (Object.keys(agentUpdate).length > 0) {
        let saved = false;

        // Try update by profile_id first
        const { data: upd1 } = await admin
          .from("agents")
          .update(agentUpdate)
          .eq("profile_id", user_id)
          .select("id");
        if (upd1 && upd1.length > 0) saved = true;

        // Fallback: try user_id column (INT — only works for integer IDs)
        if (!saved && !isUuid) {
          const { data: upd2 } = await admin
            .from("agents")
            .update(agentUpdate)
            .eq("user_id", user_id)
            .select("id");
          if (upd2 && upd2.length > 0) saved = true;
        }

        // If no row was updated, INSERT a new agent row
        // user_id is INT — look up the integer id from users table
        if (!saved && isUuid) {
          let intUserId: number | null = null;
          try {
            const { data: userRow } = await admin
              .from("users")
              .select("id")
              .eq("auth_user_id", user_id)
              .single();
            if (userRow) intUserId = userRow.id;
          } catch {}

          const insertPayload: Record<string, any> = {
            profile_id: user_id,
            wallet_balance: 0,
            commission_type: commission_type || "percentage",
            commission_value: commission_value ?? 10,
            approval_status: approval_status || "pending",
            ...agentUpdate,
          };
          if (intUserId) insertPayload.user_id = intUserId;

          const { error: insErr } = await admin
            .from("agents")
            .insert(insertPayload);
          if (insErr) {
            console.warn("Agent insert fallback warning:", insErr.message);
          } else {
            saved = true;
          }
        }
      }
    }

    // ── Upsert attendants table (ensures row exists) ─────────
    if (attendant_id !== undefined || assigned_doctors !== undefined || assigned_clinic_ids !== undefined) {
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
        let saved = false;

        // Try update by attendant_id first (if row already exists)
        if (attendant_id) {
          const { data: upd, error: updErr } = await admin
            .from("attendants")
            .update(attUpdate)
            .eq("id", attendant_id)
            .select("id");
          if (updErr) console.warn("Attendant update by id warning:", updErr.message);
          if (upd && upd.length > 0) saved = true;
        }

        // Try update by profile_id
        if (!saved && isUuid) {
          const { data: upd2, error: upd2Err } = await admin
            .from("attendants")
            .update(attUpdate)
            .eq("profile_id", user_id)
            .select("id");
          if (upd2Err) console.warn("Attendant update by profile_id warning:", upd2Err.message);
          if (upd2 && upd2.length > 0) saved = true;
        }

        // If no row was updated, INSERT a new attendant row
        // user_id column is INT — look up the integer id from users table
        if (!saved && isUuid) {
          let intUserId: number | null = null;
          try {
            const { data: userRow } = await admin
              .from("users")
              .select("id")
              .eq("auth_user_id", user_id)
              .single();
            if (userRow) intUserId = userRow.id;
          } catch {}

          // Get profile info for the insert
          let profileName = name || "";
          let profileEmail = "";
          let profilePhone = phone || null;
          if (!profileName) {
            try {
              const { data: prof } = await admin.from("profiles").select("name, email, phone").eq("id", user_id).single();
              if (prof) {
                profileName = prof.name || "";
                profileEmail = prof.email || "";
                profilePhone = profilePhone || prof.phone || null;
              }
            } catch {}
          }

          const insertPayload: Record<string, any> = {
            profile_id: user_id,
            full_name: profileName,
            email: profileEmail,
            phone: profilePhone,
            status: status || "active",
            ...attUpdate,
          };
          if (intUserId) insertPayload.user_id = intUserId;

          const { error: insErr } = await admin
            .from("attendants")
            .insert(insertPayload);
          if (insErr) {
            console.warn("Attendant insert warning:", insErr.message);
            // If user_id NOT NULL constraint fails, try making it nullable then retry
            if (insErr.message.includes("user_id") && !intUserId) {
              // Try without user_id by using a placeholder 0
              const { error: insErr2 } = await admin
                .from("attendants")
                .insert({ ...insertPayload, user_id: 0 });
              if (insErr2) {
                console.warn("Attendant insert retry warning:", insErr2.message);
                return NextResponse.json(
                  { error: `Failed to save attendant assignments: ${insErr2.message}` },
                  { status: 500 }
                );
              } else {
                saved = true;
              }
            } else {
              return NextResponse.json(
                { error: `Failed to save attendant assignments: ${insErr.message}` },
                { status: 500 }
              );
            }
          } else {
            saved = true;
          }
        }
      }
    }

    // Update auth user password if provided
    if (password && isUuid) {
      const { error: pwErr } = await admin.auth.admin.updateUserById(user_id, { password });
      if (pwErr) {
        return NextResponse.json({ error: `Password update failed: ${pwErr.message}` }, { status: 500 });
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
