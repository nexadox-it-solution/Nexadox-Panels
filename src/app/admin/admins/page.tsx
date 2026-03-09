"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Search, Plus, Edit2, Trash2, X, Loader,
  AlertCircle, Users, UserCheck, UserX, Eye, EyeOff, Shield,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/* ─── Types ─────────────────────────────────────────────────── */
interface AdminUser {
  id: string;         // profiles.id (= auth.users.id UUID)
  name: string;
  email: string;
  phone: string | null;
  status: "active" | "inactive" | "suspended";
  created_at: string;
}

type FormMode = "add" | "edit";

const EMPTY_FORM = {
  name: "", email: "", phone: "", password: "",
  status: "active" as "active" | "inactive",
};

/* ─── Page ───────────────────────────────────────────────────── */
export default function AdminsPage() {
  const [admins,       setAdmins]       = useState<AdminUser[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [isDrawerOpen,   setIsDrawerOpen]   = useState(false);
  const [drawerMode,     setDrawerMode]     = useState<FormMode>("add");
  const [editingAdmin,   setEditingAdmin]   = useState<AdminUser | null>(null);
  const [formData,       setFormData]       = useState(EMPTY_FORM);
  const [showPassword,   setShowPassword]   = useState(false);
  const [formError,      setFormError]      = useState("");
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [deleteConfirm,  setDeleteConfirm]  = useState<AdminUser | null>(null);
  const [successMsg,     setSuccessMsg]     = useState("");

  useEffect(() => { fetchAdmins(); }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, phone, status, created_at")
        .eq("role", "admin")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAdmins((data || []) as AdminUser[]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 3500); };

  const filtered = admins.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q) || (a.phone || "").includes(q)) &&
      (statusFilter === "all" || a.status === statusFilter);
  });

  const activeCount = admins.filter((a) => a.status === "active").length;
  const inactiveCount = admins.filter((a) => a.status !== "active").length;

  const openAdd = () => {
    setDrawerMode("add"); setEditingAdmin(null); setFormData(EMPTY_FORM);
    setFormError(""); setShowPassword(false); setIsDrawerOpen(true);
  };

  const openEdit = (a: AdminUser) => {
    setDrawerMode("edit"); setEditingAdmin(a);
    setFormData({ name: a.name, email: a.email, phone: a.phone || "", password: "",
      status: a.status === "active" ? "active" : "inactive" });
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
            mobile: formData.phone || null,
            password: formData.password,
            role: "admin",
            status: formData.status,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to create admin.");

        await fetchAdmins();
        showSuccess(`Admin "${formData.name}" created successfully.`);
      } else if (editingAdmin) {
        // Update via API (uses service role key)
        const res = await fetch("/api/admin/update-user", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: editingAdmin.id,
            name: formData.name.trim(),
            phone: formData.phone || null,
            status: formData.status,
          }),
        });
        if (!res.ok) {
          const uj = await res.json();
          throw new Error(uj.error || "Update failed.");
        }
        await fetchAdmins();
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
      // Delete auth user via API (cascades to profiles via FK)
      await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth_user_id: deleteConfirm.id }),
      });
      await fetchAdmins();
      setDeleteConfirm(null);
      showSuccess("Admin deleted.");
    } catch (err: any) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const handleToggleStatus = async (a: AdminUser) => {
    const ns = a.status === "active" ? "inactive" : "active";
    try {
      const res = await fetch("/api/admin/update-user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: a.id, status: ns }),
      });
      if (!res.ok) return;
      setAdmins((prev) => prev.map((ad) => ad.id === a.id ? { ...ad, status: ns } : ad));
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
              <Shield className="h-8 w-8 text-violet-600" /> Admin Users
            </h1>
            <p className="text-muted-foreground mt-1">Create and manage admin accounts with full panel access</p>
          </div>
        </div>
        <Button className="gap-2 bg-violet-600 hover:bg-violet-700" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add Admin
        </Button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">✅ {successMsg}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-5 pb-4"><div className="flex items-center justify-between">
          <div><div className="text-2xl font-bold">{admins.length}</div><p className="text-xs text-muted-foreground mt-1">Total Admins</p></div>
          <Shield className="h-8 w-8 text-violet-500" />
        </div></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><div className="flex items-center justify-between">
          <div><div className="text-2xl font-bold text-green-600">{activeCount}</div><p className="text-xs text-muted-foreground mt-1">Active</p></div>
          <UserCheck className="h-8 w-8 text-green-500" />
        </div></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><div className="flex items-center justify-between">
          <div><div className="text-2xl font-bold text-red-600">{inactiveCount}</div><p className="text-xs text-muted-foreground mt-1">Inactive</p></div>
          <UserX className="h-8 w-8 text-red-400" />
        </div></CardContent></Card>
      </div>

      {/* Search & Filter */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search admins..." className="pl-10" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex gap-2">
              {(["all", "active", "inactive"] as const).map((s) => (
                <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm"
                  onClick={() => setStatusFilter(s)} className="capitalize">{s}</Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-4 font-semibold">Name</th>
                  <th className="text-left p-4 font-semibold">Email</th>
                  <th className="text-left p-4 font-semibold">Phone</th>
                  <th className="text-left p-4 font-semibold">Status</th>
                  <th className="text-left p-4 font-semibold">Created</th>
                  <th className="text-right p-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center"><Loader className="h-6 w-6 animate-spin mx-auto" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No admin users found</td></tr>
                ) : filtered.map((a) => (
                  <tr key={a.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold">
                          {(a.name || "A")[0]}
                        </div>
                        <span className="font-medium">{a.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">{a.email}</td>
                    <td className="p-4 text-muted-foreground">{a.phone || "—"}</td>
                    <td className="p-4">
                      <button onClick={() => handleToggleStatus(a)}
                        className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer ${
                          a.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                        {a.status}
                      </button>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700"
                          onClick={() => setDeleteConfirm(a)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirm Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                <h3 className="text-lg font-semibold">Delete Admin</h3>
                <p className="text-muted-foreground">Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.</p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={isSubmitting}>Cancel</Button>
                  <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                    {isSubmitting ? <Loader className="h-4 w-4 animate-spin" /> : "Delete"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add/Edit Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
          <div className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold">{drawerMode === "add" ? "Add New Admin" : "Edit Admin"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsDrawerOpen(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="p-6 space-y-5">
              {formError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" /> {formError}
                </div>
              )}
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter full name" />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="admin@example.com" disabled={drawerMode === "edit"} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+91..." />
              </div>
              {drawerMode === "add" && (
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Min 6 characters" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex gap-3">
                  {(["active", "inactive"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setFormData({ ...formData, status: s })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                        formData.status === s ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsDrawerOpen(false)}>Cancel</Button>
                <Button className="flex-1 bg-violet-600 hover:bg-violet-700" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? <><Loader className="h-4 w-4 animate-spin mr-2" /> Saving...</> :
                    drawerMode === "add" ? "Create Admin" : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
