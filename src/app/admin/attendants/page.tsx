"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Search, Plus, Edit2, Trash2, X, Loader, AlertCircle,
  UserCog, Users, UserCheck, UserX, Eye, EyeOff, Stethoscope, Building2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/* ─── Types ────────────────────────────────────────────────── */
interface AttendantUser {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  phone: string | null;
  status: "active" | "inactive" | "suspended";
  created_at: string;
}

interface Attendant {
  id: string | null;
  user_id: string;
  profile_id: string;
  assigned_doctors: string[];
  assigned_clinic_ids: number[];
  created_at: string;
  user: AttendantUser;
}

interface Doctor {
  id: string;
  name: string;
  email: string;
  clinic_ids: number[];
}

interface Clinic {
  id: number;
  name: string;
  city: string | null;
}

type FormMode = "add" | "edit";

const EMPTY_FORM = {
  name: "",
  email: "",
  mobile: "",
  password: "",
  status: "active" as "active" | "inactive",
};

/* ─── Page ──────────────────────────────────────────────────── */
export default function AttendantsPage() {
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<FormMode>("add");
  const [editingAttendant, setEditingAttendant] = useState<Attendant | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [assignedDoctorIds, setAssignedDoctorIds] = useState<string[]>([]);
  const [assignedClinicIds, setAssignedClinicIds] = useState<number[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Attendant | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const [doctorSearch, setDoctorSearch] = useState("");
  const [clinicSearch, setClinicSearch] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  /* ─── Fetch ───────────────────────────────────────────────── */
  const fetchAll = async () => {
    setLoading(true);
    try {
      // Fetch attendants via server API (uses service role key - bypasses RLS)
      const attApiRes = await fetch("/api/admin/attendants");
      const attApiData = await attApiRes.json();
      if (attApiRes.ok && attApiData.attendants) {
        setAttendants(attApiData.attendants);
      }

      // Fetch doctors for assignment (from doctors table to get clinic_ids)
      const { data: docRows } = await supabase
        .from("doctors")
        .select("id, name, email, clinic_ids")
        .order("name");
      setDoctors((docRows || []).map((d: any) => ({
        id: String(d.id),
        name: d.name || "",
        email: d.email || "",
        clinic_ids: d.clinic_ids || [],
      })));

      // Fetch clinics for assignment
      const { data: clinicRows } = await supabase
        .from("clinics")
        .select("id, name, city")
        .order("name");
      setClinics(clinicRows || []);
    } catch (err) {
      console.error("Failed to fetch attendants:", err);
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  /* ─── Filtering ──────────────────────────────────────────── */
  const filtered = attendants.filter((a) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      a.user.name.toLowerCase().includes(q) ||
      a.user.email.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "all" || a.user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = attendants.filter((a) => a.user.status === "active").length;
  const inactiveCount = attendants.filter((a) => a.user.status === "inactive").length;

  /* ─── Open Add / Edit ─────────────────────────────────────── */
  const openAdd = () => {
    setDrawerMode("add");
    setEditingAttendant(null);
    setFormData(EMPTY_FORM);
    setAssignedDoctorIds([]);
    setAssignedClinicIds([]);
    setFormError("");
    setShowPassword(false);
    setDoctorSearch("");
    setClinicSearch("");
    setIsDrawerOpen(true);
  };

  const openEdit = (att: Attendant) => {
    setDrawerMode("edit");
    setEditingAttendant(att);
    setFormData({
      name: att.user.name,
      email: att.user.email,
      mobile: att.user.mobile || att.user.phone || "",
      password: "",
      status: att.user.status === "active" ? "active" : "inactive",
    });
    // Convert to strings — DB stores numbers but UI uses string IDs
    setAssignedDoctorIds((att.assigned_doctors || []).map(String));
    setAssignedClinicIds((att.assigned_clinic_ids || []).map(Number));
    setFormError("");
    setDoctorSearch("");
    setClinicSearch("");
    setIsDrawerOpen(true);
  };

  /* ─── Submit ─────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (!formData.email.trim()) {
      setFormError("Email is required.");
      return;
    }
    if (drawerMode === "add" && !formData.password) {
      setFormError("Password is required.");
      return;
    }
    if (drawerMode === "add" && formData.password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    try {
      if (drawerMode === "add") {
        // Use server-side API to create user (no session hijack)
        const res = await fetch("/api/admin/create-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name.trim(),
            email: formData.email.trim(),
            mobile: formData.mobile || null,
            password: formData.password,
            role: "attendant",
            status: formData.status,
            rolePayload: {
              assigned_doctors: assignedDoctorIds,
              assigned_clinic_ids: assignedClinicIds,
            },
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to create attendant.");

        // Add to local state
        const newAttendant: Attendant = {
          id: result.roleData?.id || null,
          user_id: result.user.id,
          profile_id: result.user.id,
          assigned_doctors: assignedDoctorIds,
          assigned_clinic_ids: assignedClinicIds,
          created_at: new Date().toISOString(),
          user: {
            id: result.user.id,
            name: formData.name.trim(),
            email: formData.email.trim(),
            mobile: formData.mobile || null,
            phone: formData.mobile || null,
            status: formData.status,
            created_at: new Date().toISOString(),
          },
        };
        setAttendants((prev) => [newAttendant, ...prev]);
        showSuccess(`Attendant "${formData.name}" added successfully.`);
      } else if (editingAttendant) {
        // Update profile via API
        const res = await fetch("/api/admin/update-user", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: editingAttendant.user_id,
            name: formData.name.trim(),
            phone: formData.mobile || null,
            status: formData.status,
            attendant_id: editingAttendant.id || null,
            assigned_doctors: assignedDoctorIds,
            assigned_clinic_ids: assignedClinicIds,
          }),
        });
        if (!res.ok) {
          const result = await res.json();
          throw new Error(result.error || "Failed to update attendant.");
        }

        // Update local state
        setAttendants((prev) =>
          prev.map((a) =>
            a.user_id === editingAttendant.user_id
              ? {
                  ...a,
                  assigned_doctors: assignedDoctorIds,
                  assigned_clinic_ids: assignedClinicIds,
                  user: {
                    ...a.user,
                    name: formData.name.trim(),
                    mobile: formData.mobile || null,
                    phone: formData.mobile || null,
                    status: formData.status as "active" | "inactive",
                  },
                }
              : a
          )
        );
        showSuccess(`"${formData.name}" updated successfully.`);
      }
      setIsDrawerOpen(false);
    } catch (err: any) {
      setFormError(err?.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── Delete ─────────────────────────────────────────────── */
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/attendants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendant_id: deleteConfirm.id,
          user_id: deleteConfirm.user_id,
        }),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Failed to delete attendant.");
      }
      setAttendants((prev) => prev.filter((a) => a.user_id !== deleteConfirm.user_id));
      setDeleteConfirm(null);
      showSuccess("Attendant deleted.");
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── Doctor/Clinic toggle helpers ──────────────────────── */
  const toggleDoctor = (docId: string) => {
    setAssignedDoctorIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const toggleClinic = (clinicId: number) => {
    setAssignedClinicIds((prev) => {
      const next = prev.includes(clinicId)
        ? prev.filter((id) => id !== clinicId)
        : [...prev, clinicId];

      // Auto-remove doctors that no longer belong to any selected clinic
      if (next.length === 0) {
        setAssignedDoctorIds([]);
      } else {
        setAssignedDoctorIds((prevDocs) =>
          prevDocs.filter((docId) => {
            const doc = doctors.find((d) => d.id === docId);
            return doc && doc.clinic_ids.some((cid) => next.includes(cid));
          })
        );
      }
      return next;
    });
  };

  const getDoctorName = (docId: string | number) => {
    const doc = doctors.find((d) => d.id === String(docId));
    return doc ? doc.name : String(docId);
  };

  const getClinicName = (clinicId: number) => {
    const clinic = clinics.find((c) => c.id === clinicId);
    return clinic ? clinic.name : `Clinic #${clinicId}`;
  };

  // Only show doctors whose clinic_ids overlap with selected clinics
  const clinicScopedDoctors = assignedClinicIds.length > 0
    ? doctors.filter((d) => d.clinic_ids.some((cid) => assignedClinicIds.includes(cid)))
    : [];

  const filteredDoctors = clinicScopedDoctors.filter(
    (d) =>
      d.name.toLowerCase().includes(doctorSearch.toLowerCase()) ||
      d.email.toLowerCase().includes(doctorSearch.toLowerCase())
  );

  const filteredClinics = clinics.filter(
    (c) =>
      c.name.toLowerCase().includes(clinicSearch.toLowerCase()) ||
      (c.city || "").toLowerCase().includes(clinicSearch.toLowerCase())
  );

  const statusBadge = (s: string) => {
    if (s === "active") return "bg-green-100 text-green-700 border-green-200";
    if (s === "inactive") return "bg-gray-100 text-gray-600 border-gray-200";
    return "bg-red-100 text-red-700 border-red-200";
  };

  /* ─── Render ─────────────────────────────────────────────── */
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
              <UserCog className="h-8 w-8 text-purple-500" /> Attendants
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage attendants and their doctor/clinic assignments
            </p>
          </div>
        </div>
        <Button className="gap-2 bg-brand-600 hover:bg-brand-700" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add Attendant
        </Button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          <UserCheck className="h-4 w-4" /> {successMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Total Attendants",
            val: attendants.length,
            icon: <Users className="h-8 w-8 text-purple-400" />,
            color: "",
          },
          {
            label: "Active",
            val: activeCount,
            icon: <UserCheck className="h-8 w-8 text-green-500" />,
            color: "text-green-600",
          },
          {
            label: "Inactive",
            val: inactiveCount,
            icon: <UserX className="h-8 w-8 text-gray-400" />,
            color: "text-gray-500",
          },
        ].map(({ label, val, icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-2xl font-bold ${color}`}>{val}</div>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </div>
                {icon}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "active", "inactive"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
              className={statusFilter === s ? "bg-brand-600 hover:bg-brand-700" : ""}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground ml-auto">
          {filtered.length} of {attendants.length}
        </p>
      </div>

      {/* Table */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <Loader className="h-8 w-8 animate-spin text-brand-600" />
            <p className="ml-3 text-muted-foreground">Loading attendants...</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Attendants ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <UserCog className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No attendants found</p>
                {!searchQuery && (
                  <p className="text-sm mt-1">
                    Click &quot;Add Attendant&quot; to add the first one.
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-800/50">
                      {["Attendant", "Status", "Assigned Doctors", "Assigned Clinics", "Joined", ""].map(
                        (h) => (
                          <th
                            key={h}
                            className={`py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${
                              h === "" ? "text-right" : "text-left"
                            }`}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((att) => (
                      <tr
                        key={att.user_id}
                        className="border-b hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        {/* Attendant info */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 font-semibold text-sm">
                              {att.user.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{att.user.name}</p>
                              <p className="text-xs text-muted-foreground">{att.user.email}</p>
                              {(att.user.mobile || att.user.phone) && (
                                <p className="text-xs text-muted-foreground">
                                  {att.user.mobile || att.user.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadge(
                              att.user.status
                            )}`}
                          >
                            {att.user.status.charAt(0).toUpperCase() + att.user.status.slice(1)}
                          </span>
                        </td>

                        {/* Assigned Doctors */}
                        <td className="py-3 px-4">
                          {att.assigned_doctors && att.assigned_doctors.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {att.assigned_doctors.slice(0, 2).map((docId) => (
                                <span
                                  key={docId}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200"
                                >
                                  <Stethoscope className="h-3 w-3" />
                                  {getDoctorName(docId)}
                                </span>
                              ))}
                              {att.assigned_doctors.length > 2 && (
                                <span className="text-xs text-muted-foreground">
                                  +{att.assigned_doctors.length - 2} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </td>

                        {/* Assigned Clinics */}
                        <td className="py-3 px-4">
                          {att.assigned_clinic_ids && att.assigned_clinic_ids.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {att.assigned_clinic_ids.slice(0, 2).map((cId) => (
                                <span
                                  key={cId}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200"
                                >
                                  <Building2 className="h-3 w-3" />
                                  {getClinicName(cId)}
                                </span>
                              ))}
                              {att.assigned_clinic_ids.length > 2 && (
                                <span className="text-xs text-muted-foreground">
                                  +{att.assigned_clinic_ids.length - 2} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </td>

                        {/* Joined */}
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {new Date(att.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:text-blue-800"
                              onClick={() => openEdit(att)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-700"
                              onClick={() => setDeleteConfirm(att)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              <div className="p-2 bg-red-100 rounded-lg">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <h2 className="text-lg font-bold">Delete Attendant?</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>{deleteConfirm.user.name}</strong> will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Drawer */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => !isSubmitting && setIsDrawerOpen(false)}
        />
      )}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl flex flex-col transition-transform duration-300 ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-purple-500" />
            <h2 className="text-xl font-bold">
              {drawerMode === "add" ? "Add New Attendant" : "Edit Attendant"}
            </h2>
          </div>
          <button
            onClick={() => !isSubmitting && setIsDrawerOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {formError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {formError}
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label>
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="e.g. Priya Sharma"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              disabled={isSubmitting}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label>
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              type="email"
              placeholder="attendant@example.com"
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              disabled={isSubmitting || drawerMode === "edit"}
            />
            {drawerMode === "edit" && (
              <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
            )}
          </div>

          {/* Mobile */}
          <div className="space-y-2">
            <Label>Mobile</Label>
            <Input
              placeholder="+91 9876543210"
              value={formData.mobile}
              onChange={(e) => setFormData((p) => ({ ...p, mobile: e.target.value }))}
              disabled={isSubmitting}
            />
          </div>

          {/* Password (add only) */}
          {drawerMode === "add" && (
            <div className="space-y-2">
              <Label>
                Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 6 characters"
                  value={formData.password}
                  onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                  disabled={isSubmitting}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  status: e.target.value as "active" | "inactive",
                }))
              }
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              disabled={isSubmitting}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Assign Clinics (select clinics FIRST) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Building2 className="h-4 w-4 text-emerald-500" /> Assign Clinics
              <span className="text-xs text-muted-foreground font-normal ml-1">(select first)</span>
            </Label>
            {assignedClinicIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {assignedClinicIds.map((cId) => (
                  <span
                    key={cId}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                  >
                    {getClinicName(cId)}
                    <button
                      onClick={() => toggleClinic(cId)}
                      className="hover:text-emerald-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Input
              placeholder="Search clinics..."
              value={clinicSearch}
              onChange={(e) => setClinicSearch(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-32 overflow-y-auto border rounded-md">
              {filteredClinics.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 text-center">
                  No clinics found
                </p>
              ) : (
                filteredClinics.map((clinic) => {
                  const isSelected = assignedClinicIds.includes(clinic.id);
                  return (
                    <button
                      key={clinic.id}
                      type="button"
                      onClick={() => toggleClinic(clinic.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 border-b last:border-b-0 transition-colors ${
                        isSelected ? "bg-emerald-50 dark:bg-emerald-950/20" : ""
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          isSelected
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      <span className="truncate">{clinic.name}</span>
                      {clinic.city && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {clinic.city}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Assign Doctors (filtered by selected clinics) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Stethoscope className="h-4 w-4 text-blue-500" /> Assign Doctors
              {assignedClinicIds.length > 0 && (
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  ({clinicScopedDoctors.length} doctor{clinicScopedDoctors.length !== 1 ? "s" : ""} in selected clinic{assignedClinicIds.length !== 1 ? "s" : ""})
                </span>
              )}
            </Label>
            {assignedDoctorIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {assignedDoctorIds.map((docId) => (
                  <span
                    key={docId}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                  >
                    {getDoctorName(docId)}
                    <button
                      onClick={() => toggleDoctor(docId)}
                      className="hover:text-blue-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {assignedClinicIds.length === 0 ? (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 px-4 py-3">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Select at least one clinic above to see available doctors.
                </p>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Search doctors..."
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  className="mb-2"
                />
                <div className="max-h-32 overflow-y-auto border rounded-md">
                  {filteredDoctors.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3 text-center">
                      No doctors found in selected clinics
                    </p>
                  ) : (
                    filteredDoctors.map((doc) => {
                      const isSelected = assignedDoctorIds.includes(doc.id);
                      const docClinics = doc.clinic_ids
                        .filter((cid) => assignedClinicIds.includes(cid))
                        .map((cid) => getClinicName(cid));
                      return (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => toggleDoctor(doc.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 border-b last:border-b-0 transition-colors ${
                            isSelected ? "bg-blue-50 dark:bg-blue-950/20" : ""
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                              isSelected
                                ? "bg-blue-600 border-blue-600 text-white"
                                : "border-gray-300"
                            }`}
                          >
                            {isSelected && (
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                          <div className="flex flex-col items-start min-w-0">
                            <span className="truncate text-sm">{doc.name}</span>
                            <span className="text-[10px] text-muted-foreground truncate">
                              {docClinics.join(", ")}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground ml-auto truncate flex-shrink-0">
                            {doc.email}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0 bg-white dark:bg-gray-900">
          <Button
            variant="outline"
            onClick={() => !isSubmitting && setIsDrawerOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="gap-2 bg-brand-600 hover:bg-brand-700 min-w-[150px]"
          >
            {isSubmitting ? (
              <>
                <Loader className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : drawerMode === "add" ? (
              <>
                <Plus className="h-4 w-4" /> Add Attendant
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
