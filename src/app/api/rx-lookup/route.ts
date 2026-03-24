export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

const VALID_TABLES: Record<string, string> = {
  medicine_names: "rx_medicine_names",
  compositions: "rx_compositions",
  dosages: "rx_dosages",
  durations: "rx_durations",
  test_names: "rx_test_names",
  diagnoses: "rx_diagnoses",
  complaints: "rx_complaints",
};

/**
 * GET /api/rx-lookup?table=medicine_names&q=para
 * Returns matching rows from the lookup table (max 50).
 */
export async function GET(req: NextRequest) {
  const table = req.nextUrl.searchParams.get("table") || "";
  const q = req.nextUrl.searchParams.get("q") || "";

  const dbTable = VALID_TABLES[table];
  if (!dbTable) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  let query = getSupabaseAdmin()
    .from(dbTable)
    .select("name")
    .order("name", { ascending: true })
    .limit(50);

  if (q.trim()) {
    query = query.ilike("name", `%${q.trim()}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ items: [] });
  }

  return NextResponse.json({ items: (data || []).map((r: any) => r.name) });
}

/**
 * POST /api/rx-lookup
 * Body: { table: "medicine_names", values: ["Paracetamol", "Amoxicillin"] }
 * Inserts new values (ignores duplicates).
 */
export async function POST(req: NextRequest) {
  try {
    const { table, values } = await req.json();

    const dbTable = VALID_TABLES[table];
    if (!dbTable || !Array.isArray(values) || values.length === 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const rows = values
      .filter((v: any) => typeof v === "string" && v.trim())
      .map((v: string) => ({ name: v.trim() }));

    if (rows.length > 0) {
      await getSupabaseAdmin()
        .from(dbTable)
        .upsert(rows, { onConflict: "name", ignoreDuplicates: true });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
