"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Search, Plus, Edit2, Trash2, X, Loader,
  AlertCircle, Users, UserCheck, UserX, Eye, EyeOff, Heart,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/* ─── Types ─────────────────────────────────────────────────── */
interface Patient {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  status: "active" | "inactive" | "suspended";
  created_at: string;
  patient_id: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  city: string | null;
}

type FormMode = "add" | "edit";

const EMPTY_FORM = {
  name: "", email: "", mobile: "", password: "",
  date_of_birth: "", gender: "", blood_group: "", city: "",
  status: "active" as "active" | "inactive",
};

// TODO: Replace with actual data fetching
const EMPTY_FORM2 = {}; // placeholder deleted below

export default function PatientsPage() {
  const [patients,     setPatients]     = useState<Patient[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [isDrawerOpen,   setIsDrawerOpen]   = useState(false);
  const [drawerMode,     setDrawerMode]     = useState<FormMode>("add");
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [formData,       setFormData]       = useState(EMPTY_FORM);
  const [showPassword,   setShowPassword]   = useState(false);
  const [formError,      setFormError]      = useState("");
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState<Patient | null>(null);
  const [successMsg,     setSuccessMsg]     = useState("");

  useEffect(() => { fetchPatients(); }, []);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      // 1. Get patients from profiles table (primary source of identity)
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, name, email, phone, status, created_at")
        .eq("role", "patient")
        .order("created_at", { ascending: false });
      
      // 2. Get all patient detail records
      const { data: patientsOnlyData, error: patientsError } = await supabase
        .from("patients")
        .select("id, name, email, phone, gender, blood_group, city, status, created_at, user_id, date_of_birth")
        .order("created_at", { ascending: false });

      // 3. Get unique patients from appointments table (fallback for patients created via booking)
      const { data: aptPatientsData } = await supabase
        .from("appointments")
        .select("patient_name, patient_email, patient_phone, created_at")
        .order("created_at", { ascending: false });
      
      if (profileError) throw profileError;

      // Build patient details lookup by user_id (profile UUID)
      const patientByUserId: Record<string, any> = {};
      (patientsOnlyData || []).forEach((p: any) => {
        if (p.user_id) patientByUserId[String(p.user_id)] = p;
      });

      // Use a map keyed by phone or email to deduplicate
      const seen = new Map<string, boolean>();
      const combined: Patient[] = [];

      // Map profile-linked patients
      (profileData || []).forEach((u: any) => {
        const key = u.email || u.phone || u.name;
        if (key && !seen.has(key)) {
          seen.set(key, true);
          if (u.phone) seen.set(u.phone, true);
          const pd = patientByUserId[String(u.id)];
          combined.push({
            id: u.id, name: u.name, email: u.email, mobile: u.phone,
            status: u.status, created_at: u.created_at,
            patient_id: pd?.id ?? null,
            date_of_birth: pd?.date_of_birth ?? null,
            gender: pd?.gender ?? null,
            blood_group: pd?.blood_group ?? null,
            city: pd?.city ?? null,
          });
        }
      });

      // Map standalone patients from patients table (not linked to a profile)
      (patientsOnlyData || []).forEach((p: any) => {
        const keyEmail = p.email;
        const keyPhone = p.phone;
        if ((keyEmail && seen.has(keyEmail)) || (keyPhone && seen.has(keyPhone))) return;
        if (keyEmail) seen.set(keyEmail, true);
        if (keyPhone) seen.set(keyPhone, true);
        combined.push({
          id: `patient_${p.id}`, name: p.name || "Unknown", email: p.email || "", mobile: p.phone,
          status: p.status || "active", created_at: p.created_at,
          patient_id: p.id,
          date_of_birth: p.date_of_birth ?? null,
          gender: p.gender ?? null,
          blood_group: p.blood_group ?? null,
          city: p.city ?? null,
        });
      });

      // Map unique patients from appointments table (those not yet in patients table)
      (aptPatientsData || []).forEach((a: any) => {
        const keyEmail = a.patient_email;
        const keyPhone = a.patient_phone;
        const keyName = a.patient_name;
        if (!keyName) return;
        if ((keyEmail && seen.has(keyEmail)) || (keyPhone && seen.has(keyPhone))) return;
        if (keyEmail) seen.set(keyEmail, true);
        if (keyPhone) seen.set(keyPhone, true);
        combined.push({
          id: `apt_${keyPhone || keyEmail || keyName}`,
          name: keyName, email: keyEmail || "", mobile: keyPhone || null,
          status: "active", created_at: a.created_at,
          patient_id: null,
          date_of_birth: null, gender: null, blood_group: null, city: null,
        });
      });

      setPatients(combined);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 3500); };

  const filtered = patients.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || (p.mobile || "").includes(q)) &&
      (statusFilter === "all" || p.status === statusFilter);
  });

  const activeCount = patients.filter((p) => p.status === "active").length;
  const inactiveCount = patients.filter((p) => p.status !== "active").length;

  const openAdd = () => {
    setDrawerMode("add"); setEditingPatient(null); setFormData(EMPTY_FORM);
    setFormError(""); setShowPassword(false); setIsDrawerOpen(true);
  };

  const openEdit = (p: Patient) => {
    setDrawerMode("edit"); setEditingPatient(p);
    setFormData({ name: p.name, email: p.email, mobile: p.mobile || "", password: "",
      date_of_birth: p.date_of_birth || "", gender: p.gender || "",
      blood_group: p.blood_group || "", city: p.city || "",
      status: p.status === "active" ? "active" : "inactive" });
    setFormError(""); setIsDrawerOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) { setFormError("Name is required."); return; }
    if (!formData.email.trim()) { setFormError("Email is required."); return; }
    if (drawerMode === "add" && !formData.password) { setFormError("Password is required."); return; }
    if (drawerMode === "add" && formData.password.length < 6) { setFormError("Password min 6 chars."); return; }
    setIsSubmitting(true); setFormError("");
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
            role: "patient",
            status: formData.status,
            rolePayload: {
              date_of_birth: formData.date_of_birth || null,
              gender: formData.gender || null,
              blood_group: formData.blood_group || null,
              city: formData.city || null,
            },
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to create patient.");
        setPatients((prev) => [{ id: result.user.id, name: formData.name.trim(), email: formData.email.trim(),
          mobile: formData.mobile || null, status: formData.status, created_at: new Date().toISOString(),
          patient_id: result.roleData?.id || null, date_of_birth: formData.date_of_birth || null, gender: formData.gender || null,
          blood_group: formData.blood_group || null, city: formData.city || null }, ...prev]);
        showSuccess(`Patient "${formData.name}" added.`);
      } else if (editingPatient) {
        // Update profiles (primary identity) via API
        const isProfileId = typeof editingPatient.id === "string" && editingPatient.id.includes("-");
        if (isProfileId) {
          const res = await fetch("/api/admin/update-user", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: editingPatient.id,
              name: formData.name.trim(),
              mobile: formData.mobile || null,
              status: formData.status,
            }),
          });
          if (!res.ok) {
            const result = await res.json();
            throw new Error(result.error || "Failed to update patient.");
          }
        }
        // Update patient details if they exist
        if (editingPatient.patient_id) {
          await supabase.from("patients").update({
            date_of_birth: formData.date_of_birth || null, gender: formData.gender || null,
            blood_group: formData.blood_group || null, city: formData.city || null,
          }).eq("id", editingPatient.patient_id);
        }
        // Set/Reset password if provided
        if (formData.password && formData.password.trim().length > 0) {
          if (formData.password.length < 6) throw new Error("Password must be at least 6 characters.");
          if (editingPatient.patient_id) {
            const pwRes = await fetch("/api/patient/set-password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ patient_id: editingPatient.patient_id, password: formData.password }),
            });
            if (!pwRes.ok) {
              const pwResult = await pwRes.json();
              throw new Error(pwResult.error || "Failed to set password.");
            }
          }
        }
        setPatients((prev) => prev.map((p) => p.id === editingPatient.id ? {
          ...p, name: formData.name.trim(), mobile: formData.mobile || null, status: formData.status,
          date_of_birth: formData.date_of_birth || null, gender: formData.gender || null,
          blood_group: formData.blood_group || null, city: formData.city || null,
        } : p));
        showSuccess(`"${formData.name}" updated.`);
      }
      setIsDrawerOpen(false);
    } catch (err: any) { setFormError(err?.message || "Something went wrong."); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsSubmitting(true);
    try {
      const isProfileId = typeof deleteConfirm.id === "string" && deleteConfirm.id.includes("-");
      if (isProfileId) {
        // Delete auth user via API — cascades to profiles
        const res = await fetch("/api/admin/update-user", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: deleteConfirm.id }),
        });
        if (!res.ok) {
          const result = await res.json();
          throw new Error(result.error || "Failed to delete patient.");
        }
      }
      // Clean up patient detail row if exists
      if (deleteConfirm.patient_id) {
        await supabase.from("patients").delete().eq("id", deleteConfirm.patient_id);
      }
      setPatients((prev) => prev.filter((p) => p.id !== deleteConfirm.id));
      setDeleteConfirm(null);
      showSuccess("Patient deleted.");
    } catch (err: any) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const handleToggleStatus = async (p: Patient) => {
    const ns = p.status === "active" ? "inactive" : "active";
    try {
      const isProfileId = typeof p.id === "string" && p.id.includes("-");
      if (isProfileId) {
        const { error } = await supabase.from("profiles").update({ status: ns }).eq("id", p.id);
        if (error) throw error;
      }
      setPatients((prev) => prev.map((pt) => pt.id === p.id ? { ...pt, status: ns } : pt));
    } catch (err: any) { console.error(err); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Heart className="h-8 w-8 text-pink-500" /> Patients
            </h1>
            <p className="text-muted-foreground mt-1">Manage patients — app signups and manually added</p>
          </div>
        </div>
        <Button className="gap-2 bg-brand-600 hover:bg-brand-700" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add Patient
        </Button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">✅ {successMsg}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[{ label: "Total Patients", val: patients.length, icon: <Users className="h-8 w-8 text-pink-400" />, color: "" },
          { label: "Active", val: activeCount, icon: <UserCheck className="h-8 w-8 text-green-500" />, color: "text-green-600" },
          { label: "Inactive", val: inactiveCount, icon: <UserX className="h-8 w-8 text-gray-400" />, color: "text-gray-400" }
        ].map(({ label, val, icon, color }) => (
          <Card key={label}><CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div><div className={`text-2xl font-bold ${color}`}>{val}</div><p className="text-xs text-muted-foreground mt-1">{label}</p></div>
              {icon}
            </div>
          </CardContent></Card>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, email or phone..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          {(["all", "active", "inactive"] as const).map((s) => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
              className={statusFilter === s ? "bg-brand-600 hover:bg-brand-700" : ""}
            >{s.charAt(0).toUpperCase() + s.slice(1)}</Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground ml-auto">{filtered.length} of {patients.length}</p>
      </div>

      {/* Table */}
      {loading ? (
        <Card><CardContent className="flex items-center justify-center py-16">
          <Loader className="h-8 w-8 animate-spin text-brand-600" />
          <p className="ml-3 text-muted-foreground">Loading patients…</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>All Patients ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Heart className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No patients found</p>
                {!searchQuery && <p className="text-sm mt-1">Click &quot;Add Patient&quot; to add the first one.</p>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-800/50">
                      {["Patient", "Mobile", "Blood / Gender", "City", "Joined", "Status", ""].map((h) => (
                        <th key={h} className={`py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${h === "" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 font-semibold text-sm">
                              {p.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{p.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{p.mobile || "—"}</td>
                        <td className="py-3 px-4 text-sm">
                          <div className="flex items-center gap-1.5">
                            {p.blood_group && <span className="text-xs font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded">{p.blood_group}</span>}
                            <span className="text-muted-foreground capitalize">{p.gender || "—"}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{p.city || "—"}</td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="py-3 px-4">
                          <button onClick={() => handleToggleStatus(p)}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                              p.status === "active"
                                ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
                                : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                            }`}>{p.status === "active" ? "Active" : "Inactive"}</button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-800" onClick={() => openEdit(p)}><Edit2 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => setDeleteConfirm(p)}><Trash2 className="h-4 w-4" /></Button>
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

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg"><Trash2 className="h-5 w-5 text-red-600" /></div>
              <h2 className="text-lg font-bold">Delete Patient?</h2>
            </div>
            <p className="text-sm text-muted-foreground"><strong>{deleteConfirm.name}</strong> will be permanently removed.</p>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={isSubmitting}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                {isSubmitting ? <><Loader className="h-4 w-4 animate-spin mr-2" />Deleting…</> : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      {isDrawerOpen && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => !isSubmitting && setIsDrawerOpen(false)} />}
      <div className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl flex flex-col transition-transform duration-300 ${isDrawerOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" />
            <h2 className="text-xl font-bold">{drawerMode === "add" ? "Add New Patient" : "Edit Patient"}</h2>
          </div>
          <button onClick={() => !isSubmitting && setIsDrawerOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {formError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {formError}
            </div>
          )}
          <div className="space-y-2"><Label>Full Name <span className="text-red-500">*</span></Label>
            <Input placeholder="e.g. Priya Sharma" value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} disabled={isSubmitting} /></div>
          <div className="space-y-2"><Label>Email <span className="text-red-500">*</span></Label>
            <Input type="email" placeholder="patient@email.com" value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              disabled={isSubmitting || drawerMode === "edit"} />
            {drawerMode === "edit" && <p className="text-xs text-muted-foreground">Email cannot be changed.</p>}
          </div>
          <div className="space-y-2"><Label>Mobile</Label>
            <Input placeholder="+91 9876543210" value={formData.mobile}
              onChange={(e) => setFormData((p) => ({ ...p, mobile: e.target.value }))} disabled={isSubmitting} /></div>
          {drawerMode === "add" && (
            <div className="space-y-2"><Label>Password <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} placeholder="Min 6 characters" value={formData.password}
                  onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                  disabled={isSubmitting} className="pr-10" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
          {drawerMode === "edit" && (
            <div className="space-y-2">
              <Label>Set / Reset Password</Label>
              <p className="text-xs text-muted-foreground">Leave blank to keep current password. Patient can use this to login from the mobile app.</p>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} placeholder="Enter new password (min 6 chars)" value={formData.password}
                  onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                  disabled={isSubmitting} className="pr-10" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Date of Birth</Label>
              <Input type="date" value={formData.date_of_birth}
                onChange={(e) => setFormData((p) => ({ ...p, date_of_birth: e.target.value }))} disabled={isSubmitting} /></div>
            <div className="space-y-2"><Label>Gender</Label>
              <select value={formData.gender}
                onChange={(e) => setFormData((p) => ({ ...p, gender: e.target.value }))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" disabled={isSubmitting}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Blood Group</Label>
              <select value={formData.blood_group}
                onChange={(e) => setFormData((p) => ({ ...p, blood_group: e.target.value }))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" disabled={isSubmitting}>
                <option value="">Select</option>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select></div>
            <div className="space-y-2"><Label>City</Label>
              <Input placeholder="e.g. Mumbai" value={formData.city}
                onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))} disabled={isSubmitting} /></div>
          </div>
          <div className="space-y-2"><Label>Status</Label>
            <select value={formData.status}
              onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as "active" | "inactive" }))}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" disabled={isSubmitting}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select></div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0 bg-white dark:bg-gray-900">
          <Button variant="outline" onClick={() => !isSubmitting && setIsDrawerOpen(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2 bg-brand-600 hover:bg-brand-700 min-w-[150px]">
            {isSubmitting ? <><Loader className="h-4 w-4 animate-spin" /> Saving…</> : drawerMode === "add" ? <><Plus className="h-4 w-4" /> Add Patient</> : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
