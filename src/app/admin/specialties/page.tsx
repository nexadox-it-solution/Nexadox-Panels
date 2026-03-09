"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stethoscope, Plus, ArrowLeft, Search, Edit2, Trash2, X, Upload, Loader, AlertCircle, ImageIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Specialty {
  id: number;
  name: string;
  description: string;
  doctors_count: number;
  status: "active" | "inactive";
  icon?: string;
}

export default function SpecialtiesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSpecialty, setEditingSpecialty] = useState<Specialty | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", icon: "", status: "active" as "active" | "inactive" });
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // The icon column is bytea — Supabase returns hex-encoded strings like \x68747470...
  // This helper decodes them back to the original text (URL or data-uri).
  const decodeBytea = (val: string | null | undefined): string => {
    if (!val) return "";
    if (typeof val === "string" && val.startsWith("\\x")) {
      try {
        const hex = val.slice(2);
        let str = "";
        for (let i = 0; i < hex.length; i += 2) {
          str += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
        }
        return str;
      } catch { return val; }
    }
    return val;
  };

  useEffect(() => { fetchSpecialties(); }, []);

  const fetchSpecialties = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("specialties")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Decode bytea-encoded icon values
      const decoded = (data || []).map((s: any) => ({ ...s, icon: decodeBytea(s.icon) }));
      setSpecialties(decoded);
    } catch (err: any) {
      console.error("Error fetching specialties:", err);
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  const isValidImage = (val: string) =>
    val.startsWith("data:image") || val.startsWith("http");

  const handleAddNew = () => {
    setEditingSpecialty(null);
    setFormData({ name: "", description: "", icon: "", status: "active" });
    setIconFile(null);
    setIconPreview("");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleEdit = (specialty: Specialty) => {
    setEditingSpecialty(specialty);
    const decodedIcon = decodeBytea(specialty.icon);
    setFormData({
      name: specialty.name,
      description: specialty.description || "",
      icon: decodedIcon,
      status: specialty.status,
    });
    setIconFile(null);
    setIconPreview(isValidImage(decodedIcon) ? decodedIcon : "");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      setIsSubmitting(true);
      const { error } = await supabase.from("specialties").delete().eq("id", id);
      if (error) throw error;
      setSpecialties((prev) => prev.filter((s) => s.id !== id));
      setDeleteConfirm(null);
      showSuccess("Specialty deleted.");
    } catch (err: any) {
      setFormError(err?.message || "Failed to delete.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIconUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setFormError("Please upload an image file.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setFormError("Image must be under 3 MB.");
      return;
    }
    setIconFile(file);
    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => setIconPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) { setFormError("Specialty name is required."); return; }
    try {
      setIsSubmitting(true);
      setFormError("");

      let iconUrl: string = formData.icon || ""; // Keep existing icon URL if not uploading new file

      // Upload new image via server API (bypasses storage RLS)
      if (iconFile) {
        const uploadForm = new FormData();
        uploadForm.append("file", iconFile);
        uploadForm.append("bucket", "specialties");

        const uploadRes = await fetch("/api/admin/upload-image", {
          method: "POST",
          body: uploadForm,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "Image upload failed.");
        iconUrl = uploadData.url;
      }

      if (editingSpecialty) {
        const { error } = await supabase
          .from("specialties")
          .update({ name: formData.name, description: formData.description, icon: iconUrl || null, status: formData.status })
          .eq("id", editingSpecialty.id);
        if (error) throw error;
        setSpecialties((prev) =>
          prev.map((s) => s.id === editingSpecialty.id ? { ...s, name: formData.name, description: formData.description, icon: iconUrl || undefined, status: formData.status } : s)
        );
        showSuccess(`"${formData.name}" updated.`);
      } else {
        const { data, error } = await supabase
          .from("specialties")
          .insert([{ name: formData.name, description: formData.description, icon: iconUrl || null, status: formData.status, doctors_count: 0 }])
          .select()
          .single();
        if (error) throw error;
        if (data) setSpecialties((prev) => [data, ...prev]);
        showSuccess(`"${formData.name}" added.`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err?.message || "Failed to save specialty.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSpecialties = specialties.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Stethoscope className="h-8 w-8 text-cyan-600" />
              Specialties
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage medical specialties — shown in the patient mobile app
            </p>
          </div>
        </div>
        <Button className="gap-2 bg-brand-600 hover:bg-brand-700" onClick={handleAddNew}>
          <Plus className="h-4 w-4" /> Add Specialty
        </Button>
      </div>

      {/* Toast */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          ✅ {successMsg}
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search specialties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {filteredSpecialties.length} of {specialties.length}
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader className="h-8 w-8 animate-spin text-brand-600" />
            <p className="ml-2">Loading specialties...</p>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {!loading && (
        <Card>
          <CardHeader>
            <CardTitle>All Specialties ({specialties.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {specialties.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Stethoscope className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No specialties yet</p>
                <p className="text-sm mt-1">Click &ldquo;Add Specialty&rdquo; to create the first one.</p>
              </div>
            ) : filteredSpecialties.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No results for &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSpecialties.map((specialty) => {
                  const hasImage = isValidImage(specialty.icon || "");
                  return (
                    <div
                      key={specialty.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Picture */}
                        <div className="w-14 h-14 bg-brand-50 dark:bg-brand-900/30 rounded-xl flex items-center justify-center flex-shrink-0 border border-brand-100 dark:border-brand-800 overflow-hidden">
                          {hasImage ? (
                            <img src={specialty.icon!} alt={specialty.name} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-brand-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-base">{specialty.name}</h3>
                          {specialty.description && (
                            <p className="text-sm text-muted-foreground truncate">{specialty.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">{specialty.doctors_count ?? 0} Doctors</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                          specialty.status === "active"
                            ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                            : "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                        }`}>
                          {specialty.status}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(specialty)} className="text-blue-600 hover:text-blue-800">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(specialty.id)} className="text-red-500 hover:text-red-700" disabled={isSubmitting}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirm */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg"><Trash2 className="h-5 w-5 text-red-600" /></div>
              <h2 className="text-lg font-bold">Delete Specialty?</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              This will permanently remove the specialty and it will no longer appear in the mobile app.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={isSubmitting}>Cancel</Button>
              <Button variant="destructive" onClick={() => handleDelete(deleteConfirm)} disabled={isSubmitting}>
                {isSubmitting ? <><Loader className="h-4 w-4 animate-spin mr-2" />Deleting...</> : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white dark:bg-gray-900 z-10">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-brand-600" />
                <h2 className="text-xl font-bold">
                  {editingSpecialty ? "Edit Specialty" : "Add New Specialty"}
                </h2>
              </div>
              <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {formError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" /> {formError}
                </div>
              )}

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="sp-name">Specialty Name <span className="text-red-500">*</span></Label>
                <Input
                  id="sp-name"
                  placeholder="e.g., Cardiology"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="sp-desc">Description</Label>
                <Input
                  id="sp-desc"
                  placeholder="e.g., Heart and cardiovascular system"
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  disabled={isSubmitting}
                />
              </div>

              {/* Picture Upload */}
              <div className="space-y-3">
                <Label>Specialty Picture</Label>
                <div
                  className="border-2 border-dashed border-brand-300 rounded-xl text-center cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900 transition overflow-hidden"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleIconUpload(file);
                  }}
                >
                  {iconPreview ? (
                    <div className="relative group">
                      <img src={iconPreview} alt="Preview" className="w-full h-48 object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-white text-sm font-medium">
                        <Upload className="h-5 w-5" /> Click to replace
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-10 px-6">
                      <div className="w-16 h-16 rounded-2xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-brand-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-brand-700 dark:text-brand-400">Click or drag a picture here</p>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP · max 3 MB · recommended 200×200 px</p>
                      </div>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleIconUpload(f); }}
                />
                {iconPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setIconFile(null);
                      setIconPreview("");
                    }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove picture
                  </button>
                )}
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="sp-status">Status</Label>
                <select
                  id="sp-status"
                  value={formData.status}
                  onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as "active" | "inactive" }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  disabled={isSubmitting}
                >
                  <option value="active">Active — shown in mobile app</option>
                  <option value="inactive">Inactive — hidden from patients</option>
                </select>
              </div>

            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t">
              <Button variant="outline" onClick={() => !isSubmitting && setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2 bg-brand-600 hover:bg-brand-700 min-w-[140px]">
                {isSubmitting ? <><Loader className="h-4 w-4 animate-spin" /> Saving...</> : editingSpecialty ? "Save Changes" : <><Plus className="h-4 w-4" />Add Specialty</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
