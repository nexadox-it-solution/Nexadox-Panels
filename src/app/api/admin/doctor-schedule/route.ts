export const dynamic = 'force-dynamic';
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
// v4 — session-based scheduling with max_seats support

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/* ─── helper: delete matching rows then insert ──────────────── */
type Row = Record<string, unknown>;

async function deleteAndInsert(rows: Row[]): Promise<{ data: unknown[] | null; error: string | null }> {
  for (const r of rows) {
    await supabaseAdmin
      .from("doctor_schedules")
      .delete()
      .eq("doctor_id", r.doctor_id as string)
      .eq("date", r.date as string)
      .eq("slot", r.slot as string);
  }
  const { data, error } = await supabaseAdmin.from("doctor_schedules").insert(rows).select();
  return { data: data ?? null, error: error?.message ?? null };
}

/* ─── main save function ────────────────────────────────────── */
async function saveRows(rows: Row[]): Promise<{
  data: unknown[] | null;
  error: string | null;
  warning?: string;
}> {
  const stripClinic   = (r: Row) => { const { clinic_id: _c, ...rest } = r; return rest; };
  const stripSeats    = (r: Row) => { const { max_seats: _m, ...rest } = r; return rest; };
  const stripBoth     = (r: Row) => { const { clinic_id: _c, max_seats: _m, ...rest } = r; return rest; };

  // Strategy 1: plain insert with all columns
  const { data: d1, error: e1 } = await supabaseAdmin.from("doctor_schedules").insert(rows).select();
  if (!e1 && d1) return { data: d1, error: null };

  const errMsg = e1?.message ?? "";
  const isDup = (e1 as any)?.code === "23505" || errMsg.includes("duplicate") || errMsg.includes("unique");

  // Strategy 2: duplicate — delete + reinsert with all cols
  if (isDup) {
    const r2 = await deleteAndInsert(rows);
    if (!r2.error) return { data: r2.data, error: null };
  }

  // Strategy 3: strip clinic_id only
  const rowsNoCli = rows.map(stripClinic);
  const { data: d3, error: e3 } = await supabaseAdmin.from("doctor_schedules").insert(rowsNoCli).select();
  if (!e3 && d3) return { data: d3, error: null, warning: "clinic_id column may not exist — run migration SQL." };

  // Strategy 4: strip max_seats only
  const rowsNoSeats = rows.map(stripSeats);
  const { data: d4, error: e4 } = await supabaseAdmin.from("doctor_schedules").insert(rowsNoSeats).select();
  if (!e4 && d4) return { data: d4, error: null, warning: "max_seats column may not exist — run migration SQL." };

  // Strategy 5: strip both clinic_id + max_seats
  const rowsBare = rows.map(stripBoth);
  const { data: d5, error: e5 } = await supabaseAdmin.from("doctor_schedules").insert(rowsBare).select();
  if (!e5 && d5) return { data: d5, error: null, warning: "clinic_id & max_seats columns missing — run migration SQL." };

  // Strategy 6: duplicate on any stripped variant — delete+reinsert bare
  const r6 = await deleteAndInsert(rowsBare);
  if (!r6.error) return { data: r6.data, error: null, warning: "Replaced existing rows (bare mode)." };

  return { data: null, error: r6.error || e5?.message || "All save strategies failed." };
}

/* ─── POST — save schedule sessions ────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { doctor_id, date, slots, clinic_id, max_seats } = body as {
      doctor_id: string;
      date: string;
      slots: string[];
      clinic_id?: number | null;
      max_seats?: number | null;
    };

    if (!doctor_id || !date || !Array.isArray(slots) || slots.length === 0)
      return NextResponse.json({ error: "doctor_id, date and slots[] are required." }, { status: 400 });

    const clinicIdVal = clinic_id != null ? parseInt(String(clinic_id), 10) : null;
    const seatsVal = max_seats != null ? parseInt(String(max_seats), 10) : 30;

    const rows: Row[] = slots.map((slot) => ({
      doctor_id,
      date,
      slot,
      max_seats: seatsVal,
      ...(clinicIdVal !== null ? { clinic_id: clinicIdVal } : {}),
      status: "available",
    }));

    const { data, error, warning } = await saveRows(rows);
    if (error)
      return NextResponse.json({ error, debug: { doctor_id, date, slots, clinic_id } }, { status: 400 });

    return NextResponse.json({ data, ...(warning ? { warning } : {}) }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error." }, { status: 500 });
  }
}

/* ─── DELETE ────────────────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id: string };
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const { error } = await supabaseAdmin.from("doctor_schedules").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error." }, { status: 500 });
  }
}

/* ─── PATCH — update status or max_seats ────────────────────── */
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as { id: string; status?: string; max_seats?: number };
    const { id, status, max_seats } = body;
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (max_seats != null) updates.max_seats = max_seats;
    if (Object.keys(updates).length === 0)
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("doctor_schedules")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error." }, { status: 500 });
  }
}

/* ─── GET — fetch schedules for a doctor (with seat counts) ── */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const doctorId   = searchParams.get("doctor_id");
    const dateFrom   = searchParams.get("date_from");
    const slotFilter = searchParams.get("slot");

    if (!doctorId)
      return NextResponse.json({ error: "doctor_id is required." }, { status: 400 });

    let query = supabaseAdmin
      .from("doctor_schedules")
      .select("*")
      .eq("doctor_id", doctorId)
      .order("date", { ascending: true })
      .order("slot",  { ascending: true });

    if (dateFrom)                          query = query.gte("date", dateFrom);
    if (slotFilter && slotFilter !== "all") query = query.eq("slot", slotFilter);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    /* Enrich each schedule row with booked_count for the session */
    const enriched = [];
    for (const row of (data || [])) {
      const { count } = await supabaseAdmin
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("doctor_id", doctorId)
        .eq("appointment_date", row.date)
        .eq("slot", row.slot)
        .neq("status", "cancelled");
      enriched.push({ ...row, booked_count: count || 0 });
    }

    return NextResponse.json({ data: enriched });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error." }, { status: 500 });
  }
}
