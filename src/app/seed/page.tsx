"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const SeedPage = () => {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSeed = async () => {
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setMessage("Database seeded successfully!");
      } else {
        setStatus("error");
        setMessage(data.message || "Seeding failed.");
      }
    } catch (error) {
      setStatus("error");
      setMessage("Network error. Please try again.");
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
          <Button
            onClick={handleSeed}
            disabled={status === "loading"}
            className="w-full bg-brand-600 hover:bg-brand-700"
          >
            {status === "loading" ? "Seeding..." : "Seed Database"}
          </Button>
          {message && (
            <p className={`text-sm ${status === "success" ? "text-green-600" : "text-red-600"}`}>
              {message}
            </p>
          )}
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
