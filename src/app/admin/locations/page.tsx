"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Plus, ArrowLeft, Search, Loader, X, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Location {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  status: "active" | "inactive";
}

const EMPTY_FORM: Omit<Location, "id"> = {
  name: "",
  address: "",
  city: "",
  state: "",
  country: "India",
  status: "active",
};

export default function LocationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [form, setForm] = useState<Omit<Location, "id">>(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error("❌ Error fetching locations:", error);
      alert("Failed to load locations");
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingLocation(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  };

  const openEditModal = (location: Location) => {
    setEditingLocation(location);
    setForm({
      name: location.name,
      address: location.address,
      city: location.city,
      state: location.state,
      country: location.country,
      status: location.status,
    });
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingLocation(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const handleFormChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError("Location name is required."); return; }
    if (!form.city.trim()) { setFormError("City is required."); return; }
    if (!form.state.trim()) { setFormError("State is required."); return; }

    try {
      setSaving(true);
      setFormError("");

      if (editingLocation) {
        // UPDATE
        const { error } = await supabase
          .from("locations")
          .update({ ...form })
          .eq("id", editingLocation.id);
        if (error) throw error;
        setLocations((prev) =>
          prev.map((l) => (l.id === editingLocation.id ? { ...l, ...form } : l))
        );
      } else {
        // INSERT
        const { data, error } = await supabase
          .from("locations")
          .insert([{ ...form }])
          .select()
          .single();
        if (error) throw error;
        if (data) setLocations((prev) => [data, ...prev]);
      }

      closeModal();
    } catch (err: any) {
      setFormError(err?.message || "Failed to save location. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (location: Location) => {
    const newStatus = location.status === "active" ? "inactive" : "active";
    try {
      const { error } = await supabase
        .from("locations")
        .update({ status: newStatus })
        .eq("id", location.id);
      if (error) throw error;
      setLocations((prev) =>
        prev.map((l) => (l.id === location.id ? { ...l, status: newStatus } : l))
      );
    } catch (err) {
      console.error("Failed to toggle status:", err);
      alert("Failed to update status");
    }
  };

  const filteredLocations = locations.filter(
    (location) =>
      location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      location.city.toLowerCase().includes(searchQuery.toLowerCase())
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
              <MapPin className="h-8 w-8 text-emerald-600" />
              Locations
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage clinic locations — these appear in the mobile app&apos;s location picker
            </p>
          </div>
        </div>
        <Button onClick={openAddModal} className="gap-2 bg-brand-600 hover:bg-brand-700">
          <Plus className="h-4 w-4" />
          Add Location
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {filteredLocations.length} of {locations.length} locations
        </p>
      </div>

      {/* Locations List */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader className="h-8 w-8 animate-spin text-brand-600" />
            <p className="ml-2">Loading locations...</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Locations ({locations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {locations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No locations yet</p>
                <p className="text-sm mt-1">Click &ldquo;Add Location&rdquo; to create the first one.</p>
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No locations match &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLocations.map((location) => (
                  <div
                    key={location.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                        <MapPin className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{location.name}</h3>
                        {location.address && (
                          <p className="text-sm text-muted-foreground">{location.address}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {location.city}, {location.state}
                          {location.country && ` · ${location.country}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleStatus(location)}
                        title="Click to toggle status"
                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer border ${
                          location.status === "active"
                            ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                            : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                        }`}
                      >
                        {location.status}
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(location)}
                        className="gap-1"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-emerald-600" />
                <h2 className="text-xl font-bold">
                  {editingLocation ? "Edit Location" : "Add New Location"}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {formError && (
                <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                  {formError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="loc-name">Location Name <span className="text-red-500">*</span></Label>
                <Input
                  id="loc-name"
                  placeholder="e.g. Nexadox Mumbai Central"
                  value={form.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="loc-address">Address</Label>
                <Input
                  id="loc-address"
                  placeholder="e.g. 123 Main Street, Andheri West"
                  value={form.address}
                  onChange={(e) => handleFormChange("address", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="loc-city">City <span className="text-red-500">*</span></Label>
                  <Input
                    id="loc-city"
                    placeholder="e.g. Mumbai"
                    value={form.city}
                    onChange={(e) => handleFormChange("city", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loc-state">State <span className="text-red-500">*</span></Label>
                  <Input
                    id="loc-state"
                    placeholder="e.g. Maharashtra"
                    value={form.state}
                    onChange={(e) => handleFormChange("state", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="loc-country">Country</Label>
                  <Input
                    id="loc-country"
                    placeholder="e.g. India"
                    value={form.country}
                    onChange={(e) => handleFormChange("country", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loc-status">Status</Label>
                  <select
                    id="loc-status"
                    value={form.status}
                    onChange={(e) => handleFormChange("status", e.target.value as "active" | "inactive")}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <p className="text-xs text-muted-foreground pt-1">
                ✅ <strong>Active</strong> locations are shown in the mobile app&apos;s location picker.
                Set to <strong>Inactive</strong> to hide from patients without deleting.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t">
              <Button variant="outline" onClick={closeModal} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="gap-2 bg-brand-600 hover:bg-brand-700 min-w-[120px]"
              >
                {saving ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingLocation ? (
                  "Save Changes"
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Location
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
