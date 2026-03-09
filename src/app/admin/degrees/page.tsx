"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GraduationCap, Plus, ArrowLeft, Search, Loader } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Degree {
  id: number;
  name: string;
  description: string;
  doctors_count: number;
  status: "active" | "inactive";
}

export default function DegreesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [degrees, setDegrees] = useState<Degree[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDegrees();
  }, []);

  const fetchDegrees = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("degrees")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDegrees(data || []);
    } catch (error) {
      console.error("❌ Error fetching degrees:", error);
      alert("Failed to load degrees");
    } finally {
      setLoading(false);
    }
  };

  const filteredDegrees = degrees.filter(degree =>
    degree.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <GraduationCap className="h-8 w-8 text-orange-600" />
              Degrees
            </h1>
            <p className="text-muted-foreground mt-1">Manage medical degrees</p>
          </div>
        </div>
        <Button className="gap-2 bg-brand-600 hover:bg-brand-700">
          <Plus className="h-4 w-4" />
          Add Degree
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search degrees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Degrees List */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader className="h-8 w-8 animate-spin text-brand-600" />
            <p className="ml-2">Loading degrees...</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Degrees ({degrees.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {degrees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No degrees found.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDegrees.map((degree) => (
                  <div
                    key={degree.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div>
                      <h3 className="font-semibold">{degree.name}</h3>
                      <p className="text-sm text-muted-foreground">{degree.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{degree.doctors_count} Doctors</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        {degree.status}
                      </span>
                      <Button variant="ghost" size="sm">Edit</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
