import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * POST /api/admin/upload-image
 * Uploads an image to Supabase Storage using service role key (bypasses RLS).
 * Accepts multipart form data with fields: file, bucket, folder (optional).
 * Returns: { url: string }
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const bucket = (formData.get("bucket") as string) || "specialties";

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    // Validate image type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image." }, { status: 400 });
    }

    // Max 3MB
    if (file.size > 3 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be under 3 MB." }, { status: 400 });
    }

    // Generate unique filename
    const ext = file.name.split(".").pop() || "png";
    const fileName = `${bucket}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload using service role key (bypasses RLS)
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      return NextResponse.json(
        { error: `Upload failed: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(fileName);
    const url = data?.publicUrl || "";

    if (!url) {
      return NextResponse.json({ error: "Failed to get public URL." }, { status: 500 });
    }

    return NextResponse.json({ url });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error during upload." },
      { status: 500 }
    );
  }
}
