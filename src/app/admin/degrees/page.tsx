"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GraduationCap, Plus, ArrowLeft, Search, Loader,
  Edit2, Trash2, X, AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Degree {
  id: number;
  name: string;
  description: string;
  doctors_count: number;
  status: "active" | "inactive";
}

type FormMode = "add" | "edit";

const EMPTY_FORM = { name: "", description: "", status: "active" as "active" | "inactive" };

export default function DegreesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [degrees, setDegrees] = useState<Degree[]>([]);
  const [loading, setLoading] = useState(true);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<FormMode>("add");
  const [editingDegree, setEditingDegree] = useState<Degree | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Degree | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

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
      console.error("Error fetching degrees:", error);
      alert("Failed to load degrees");
    } finally {
      setLoading(false);
    }
  };

  const filteredDegrees = degrees.filter(degree =>
    degree.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 3500); };

  const openAdd = () => {
    setDrawerMode("add"); setEditingDegree(null);
    setFormData(EMPTY_FORM); setFormError(""); setIsDrawerOpen(true);
  };

  const openEdit = (deg: Degree) => {
    setDrawerMode("edit"); setEditingDegree(deg);
    setFormData({ name: deg.name, description: deg.description || "", status: deg.status });
    setFormError(""); setIsDrawerOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) { setFormError("Degree name is required."); return; }

    setIsSubmitting(true); setFormError("");
    try {
      if (drawerMode === "add") {
        const { data, error } = await supabase
          .from("degrees")
          .insert({ name: formData.name.trim(), description: formData.description.trim(), status: formData.status })
          .select("*")
          .single();

        if (error) throw error;
        setDegrees((prev) => [data, ...prev]);
        showSuccess(`Degree "${formData.name}" added.`);
      } else if (editingDegree) {
        const { data, error } = await supabase
          .from("degrees")
          .update({ name: formData.name.trim(), description: formData.description.trim(), status: formData.status })
          .eq("id", editingDegree.id)
          .select("*")
          .single();

        if (error) throw error;
        setDegrees((prev) => prev.map((d) => d.id === editingDegree.id ? data : d));
        showSuccess(`Degree "${formData.name}" updated.`);
      }
      setIsDrawerOpen(false);
    } catch (err: any) { setFormError(err?.message || "Something went wrong."); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("degrees").delete().eq("id", deleteConfirm.id);
      if (error) throw error;
      setDegrees((prev) => prev.filter((d) => d.id !== deleteConfirm.id));
      setDeleteConfirm(null);
      showSuccess("Degree deleted.");
    } catch (err: any) { console.error(err); setFormError(err?.message || "Failed to delete."); }
    finally { setIsSubmitting(false); }
  };

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
        <Button className="gap-2 bg-brand-600 hover:bg-brand-700" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Degree
        </Button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          &#10003; {successMsg}
        </div>
      )}

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
                No degrees found. Click &quot;Add Degree&quot; to create one.
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
                      {degree.description && (
                        <p className="text-sm text-muted-foreground">{degree.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{degree.doctors_count || 0} Doctors</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        degree.status === "active"
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                      }`}>
                        {degree.status}
                      </span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-800" onClick={() => openEdit(degree)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => setDeleteConfirm(degree)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg"><Trash2 className="h-5 w-5 text-red-600" /></div>
              <h2 className="text-lg font-bold">Delete Degree?</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>{deleteConfirm.name}</strong> will be permanently removed. Doctors with this degree will need to be updated.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={isSubmitting}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                {isSubmitting ? <><Loader className="h-4 w-4 animate-spin mr-2" />Deleting...</> : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Drawer */}
      {isDrawerOpen && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => !isSubmitting && setIsDrawerOpen(false)} />}
      <div className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl flex flex-col transition-transform duration-300 ${isDrawerOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-orange-600" />
            <h2 className="text-xl font-bold">{drawerMode === "add" ? "Add New Degree" : "Edit Degree"}</h2>
          </div>
          <button onClick={() => !isSubmitting && setIsDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {formError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {formError}
            </div>
          )}

          <div className="space-y-2">
            <Label>Degree Name <span className="text-red-500">*</span></Label>
            <Input placeholder="e.g. MBBS, MD, BDS" value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} disabled={isSubmitting} />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input placeholder="e.g. Bachelor of Medicine" value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} disabled={isSubmitting} />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <select value={formData.status}
              onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as "active" | "inactive" }))}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" disabled={isSubmitting}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {drawerMode === "add" && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 px-4 py-3">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                New degrees will appear in the doctor add/edit form under <strong>Degrees / Qualifications</strong>.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0 bg-white dark:bg-gray-900">
          <Button variant="outline" onClick={() => !isSubmitting && setIsDrawerOpen(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2 bg-brand-600 hover:bg-brand-700 min-w-[150px]">
            {isSubmitting ? <><Loader className="h-4 w-4 animate-spin" /> Saving...</> : drawerMode === "add" ? <><Plus className="h-4 w-4" /> Add Degree</> : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
