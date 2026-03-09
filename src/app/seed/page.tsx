import { seedDatabase } from "@/lib/seedDatabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const SeedPage = async () => {
  const handleSeed = async () => {
    "use server";
    try {
      const result = await seedDatabase();
      console.log("Seeding result:", result);
    } catch (error) {
      console.error("Seeding error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-brand-50 to-cyan-50 p-6">
      <Card className="max-w-md mx-auto mt-20">
        <CardHeader>
          <CardTitle>Initialize Supabase Database</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Click the button below to populate the Supabase database with mock data.
          </p>
          <form action={handleSeed}>
            <Button type="submit" className="w-full bg-brand-600 hover:bg-brand-700">
              Seed Database
            </Button>
          </form>
          <Link href="/admin">
            <Button variant="outline" className="w-full">
              Go to Admin Panel
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default SeedPage;
