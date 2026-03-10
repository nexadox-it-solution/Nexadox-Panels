import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/seedDatabase";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await seedDatabase();
    if (result) {
      return NextResponse.json({ success: true, message: "Database seeded successfully" });
    } else {
      return NextResponse.json({ success: false, message: "Seeding encountered errors" }, { status: 500 });
    }
  } catch (error) {
    console.error("Seed API error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to seed database" },
      { status: 500 }
    );
  }
}
