"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Search, Plus, Edit2, Trash2, X, Loader, AlertCircle,
  Check, Eye, EyeOff, Wallet, TrendingUp, Clock, Users, BadgeCheck, XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/* --- Types --------------------------------------------------- */
interface Agent {
  id: string;                  // agents.id
  user_id: string;
  name: string;
  email: string;
  mobile: string | null;
  status: string;
  created_at: string;
  business_name: string | null;
  wallet_balance: number;
  commission_type: "percentage" | "fixed";
  commission_value: number;
  approval_status: "pending" | "approved" | "rejected";
  total_bookings?: number;
}

type FormMode = "add" | "edit";

const EMPTY_FORM = {
  name: "", email: "", mobile: "", password: "",
  business_name: "",
  commission_type: "percentage" as "percentage" | "fixed",
  commission_value: "10",
  status: "active" as "active" | "inactive",
};

/* --- Page ----------------------------------------------------- */
export default function AgentsPage() {
  const [agents,       setAgents]       = useState<Agent[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const [isDrawerOpen,  setIsDrawerOpen]  = useState(false);
  const [drawerMode,    setDrawerMode]    = useState<FormMode>("add");
  const [editingAgent,  setEditingAgent]  = useState<Agent | null>(null);
  const [formData,      setFormData]      = useState(EMPTY_FORM);
  const [showPassword,  setShowPassword]  = useState(false);
  const [formError,     setFormError]     = useState("");
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Agent | null>(null);
  const [successMsg,    setSuccessMsg]    = useState("");

  useEffect(() => { fetchAgents(); }, []);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      // 1. Query all profiles where role = 'agent'
      const { data: profileRows, error: profileErr } = await supabase
        .from("profiles")
        .select("id, role, name, email, phone, status, created_at")
        .eq("role", "agent")
        .order("created_at", { ascending: false });

      if (profileErr) throw profileErr;

      // 2. Query all agent detail rows via API (service role — bypasses RLS)
      let agentList: any[] = [];
      try {
        const res = await fetch("/api/admin/agents");
        if (res.ok) {
          const json = await res.json();
          agentList = json.data || [];
        }
      } catch { /* fallback: empty list */ }

      // 3. Build lookup: profile_id → agent, user_id → agent
      const agentByProfileId: Record<string, any> = {};
      const agentByUserId: Record<string, any> = {};
      agentList.forEach((a: any) => {
        if (a.profile_id) agentByProfileId[String(a.profile_id)] = a;
        if (a.user_id) agentByUserId[String(a.user_id)] = a;
      });

      // 4. Merge profiles with agent details
      const mapped: Agent[] = (profileRows || []).map((p: any) => {
        const ag = agentByProfileId[String(p.id)] || agentByUserId[String(p.id)];
        return {
          id: ag?.id || p.id,
          user_id: p.id,
          name: p.name || "–",
          email: p.email || "–",
          mobile: p.phone || null,
          status: p.status || "active",
          created_at: p.created_at,
          business_name: ag?.business_name || null,
          wallet_balance: parseFloat(ag?.wallet_balance) || 0,
          commission_type: ag?.commission_type || "percentage",
          commission_value: parseFloat(ag?.commission_value) || 0,
          approval_status: ag?.approval_status || "pending",
        };
      });

      setAgents(mapped);
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 3500); };

  const filtered = agents.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) ||
      (a.business_name || "").toLowerCase().includes(q)) &&
      (statusFilter === "all" || a.approval_status === statusFilter);
  });

  const pendingCount  = agents.filter((a) => a.approval_status === "pending").length;
  const approvedCount = agents.filter((a) => a.approval_status === "approved").length;
  const totalEarnings = agents.reduce((s, a) => s + a.wallet_balance, 0);

  const openAdd = () => {
    setDrawerMode("add"); setEditingAgent(null);
    setFormData(EMPTY_FORM); setFormError(""); setShowPassword(false); setIsDrawerOpen(true);
  };

  const openEdit = (a: Agent) => {
    setDrawerMode("edit"); setEditingAgent(a);
    setFormData({
      name: a.name, email: a.email, mobile: a.mobile || "", password: "",
      business_name: a.business_name || "",
      commission_type: a.commission_type,
      commission_value: String(a.commission_value),
      status: a.status === "active" ? "active" : "inactive",
    });
    setFormError(""); setIsDrawerOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) { setFormError("Name is required."); return; }
    if (!formData.email.trim()) { setFormError("Email is required."); return; }
    if (drawerMode === "add" && !formData.password) { setFormError("Password is required."); return; }
    if (formData.password && formData.password.length < 6) { setFormError("Password min 6 chars."); return; }
    const commVal = parseFloat(formData.commission_value);
    if (isNaN(commVal) || commVal < 0) { setFormError("Enter a valid commission value."); return; }

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
            role: "agent",
            status: formData.status,
            rolePayload: {
              business_name: formData.business_name || null,
              commission_type: formData.commission_type,
              commission_value: commVal,
              approval_status: "pending",
            },
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to create agent.");

        const newAgent: Agent = {
          id: result.roleData?.id || result.user.id,
          user_id: result.user.id,
          name: formData.name.trim(), email: formData.email.trim(),
          mobile: formData.mobile || null, status: formData.status,
          created_at: new Date().toISOString(),
          business_name: formData.business_name || null,
          wallet_balance: 0,
          commission_type: formData.commission_type, commission_value: commVal,
          approval_status: "pending",
        };
        setAgents((prev) => [newAgent, ...prev]);
        showSuccess(`Agent "${formData.name}" added (pending approval).`);

      } else if (editingAgent) {
        // Use API route for clean profile + agent detail update (service role, bypasses RLS)
        const updateBody: Record<string, any> = {
            user_id: editingAgent.user_id,
            name: formData.name.trim(),
            phone: formData.mobile || null,
            status: formData.status,
            // Agent-specific fields (updated via service role in the API)
            business_name: formData.business_name || null,
            commission_type: formData.commission_type,
            commission_value: commVal,
        };
        // Optionally update password
        if (formData.password && formData.password.length >= 6) {
          updateBody.password = formData.password;
        }
        const res = await fetch("/api/admin/update-user", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateBody),
        });
        if (!res.ok) {
          const result = await res.json();
          throw new Error(result.error || "Failed to update agent.");
        }

        setAgents((prev) => prev.map((a) => a.id === editingAgent.id ? {
          ...a, name: formData.name.trim(), mobile: formData.mobile || null, status: formData.status,
          business_name: formData.business_name || null,
          commission_type: formData.commission_type, commission_value: commVal,
        } : a));
        showSuccess(`"${formData.name}" updated.`);
      }
      setIsDrawerOpen(false);
    } catch (err: any) { setFormError(err?.message || "Something went wrong."); }
    finally { setIsSubmitting(false); }
  };

  const handleApproval = async (agent: Agent, newStatus: "approved" | "rejected") => {
    try {
      // Use server API (service role) to bypass RLS
      const res = await fetch("/api/admin/update-user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: agent.user_id,
          approval_status: newStatus,
        }),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Failed to update approval.");
      }
      setAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, approval_status: newStatus } : a));
      showSuccess(`"${agent.name}" ${newStatus}.`);
    } catch (err: any) { console.error(err); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setIsSubmitting(true);
    try {
      // Delete via API — deletes auth user which cascades to profiles, agent rows cleaned up
      const res = await fetch("/api/admin/update-user", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: deleteConfirm.user_id }),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Failed to delete agent.");
      }
      // Also clean up agent detail row
      await supabase.from("agents").delete().eq("profile_id", deleteConfirm.user_id);
      setAgents((prev) => prev.filter((a) => a.id !== deleteConfirm.id));
      setDeleteConfirm(null);
      showSuccess("Agent deleted.");
    } catch (err: any) { console.error(err); }
    finally { setIsSubmitting(false); }
  };

  const statusBadge = (s: string) => {
    if (s === "approved") return "bg-green-100 text-green-700 border-green-200";
    if (s === "rejected") return "bg-red-100 text-red-700 border-red-200";
    return "bg-yellow-100 text-yellow-700 border-yellow-200";
  };

  /* --- Render -------------------------------------------------- */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Wallet className="h-8 w-8 text-orange-500" /> Agents
            </h1>
            <p className="text-muted-foreground mt-1">Manage agents, commissions and approvals</p>
          </div>
        </div>
        <Button className="gap-2 bg-brand-600 hover:bg-brand-700" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add Agent
        </Button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">✓ {successMsg}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Agents", val: agents.length, icon: <Users className="h-8 w-8 text-orange-400" />, color: "" },
          { label: "Pending", val: pendingCount, icon: <Clock className="h-8 w-8 text-yellow-500" />, color: "text-yellow-600" },
          { label: "Approved", val: approvedCount, icon: <BadgeCheck className="h-8 w-8 text-green-500" />, color: "text-green-600" },
          { label: "Total Wallet", val: `₹${totalEarnings.toLocaleString()}`, icon: <TrendingUp className="h-8 w-8 text-blue-400" />, color: "text-blue-600" },
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
          <Input placeholder="Search by name or business..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          {(["all", "pending", "approved", "rejected"] as const).map((s) => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
              className={statusFilter === s ? "bg-brand-600 hover:bg-brand-700" : ""}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground ml-auto">{filtered.length} of {agents.length}</p>
      </div>

      {/* Table */}
      {loading ? (
        <Card><CardContent className="flex items-center justify-center py-16">
          <Loader className="h-8 w-8 animate-spin text-brand-600" />
          <p className="ml-3 text-muted-foreground">Loading agents...</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>All Agents ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No agents found</p>
                {!searchQuery && <p className="text-sm mt-1">Click &quot;Add Agent&quot; to add the first one.</p>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-800/50">
                      {["Agent", "Business", "Commission", "Wallet", "Approval", ""].map((h) => (
                        <th key={h} className={`py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${h === "" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => (
                      <tr key={a.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 font-semibold text-sm">
                              {a.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{a.name}</p>
                              <p className="text-xs text-muted-foreground">{a.email}</p>
                              {a.mobile && <p className="text-xs text-muted-foreground">{a.mobile}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm">{a.business_name || "–"}</td>
                        <td className="py-3 px-4 text-sm font-medium">
                          {a.commission_type === "percentage" ? `${a.commission_value}%` : `₹${a.commission_value}`}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium">₹{a.wallet_balance.toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadge(a.approval_status)}`}>
                            {a.approval_status.charAt(0).toUpperCase() + a.approval_status.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {a.approval_status === "pending" && (<>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-800" title="Approve"
                                onClick={() => handleApproval(a, "approved")}><Check className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" title="Reject"
                                onClick={() => handleApproval(a, "rejected")}><XCircle className="h-4 w-4" /></Button>
                            </>)}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-800" onClick={() => openEdit(a)}><Edit2 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => setDeleteConfirm(a)}><Trash2 className="h-4 w-4" /></Button>
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
              <h2 className="text-lg font-bold">Delete Agent?</h2>
            </div>
            <p className="text-sm text-muted-foreground"><strong>{deleteConfirm.name}</strong> will be permanently removed.</p>
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
            <Wallet className="h-5 w-5 text-orange-500" />
            <h2 className="text-xl font-bold">{drawerMode === "add" ? "Add New Agent" : "Edit Agent"}</h2>
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
            <Input placeholder="e.g. Ramesh Kumar" value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} disabled={isSubmitting} /></div>

          <div className="space-y-2"><Label>Email <span className="text-red-500">*</span></Label>
            <Input type="email" placeholder="agent@business.com" value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              disabled={isSubmitting || drawerMode === "edit"} />
            {drawerMode === "edit" && <p className="text-xs text-muted-foreground">Email cannot be changed.</p>}
          </div>

          <div className="space-y-2"><Label>Mobile</Label>
            <Input placeholder="+91 9876543210" value={formData.mobile}
              onChange={(e) => setFormData((p) => ({ ...p, mobile: e.target.value }))} disabled={isSubmitting} /></div>

          <div className="space-y-2">
            <Label>Password {drawerMode === "add" && <span className="text-red-500">*</span>}</Label>
            {drawerMode === "edit" && <p className="text-xs text-muted-foreground">Leave blank to keep current password.</p>}
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} placeholder={drawerMode === "add" ? "Min 6 characters" : "New password (optional)"} value={formData.password}
                  onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} disabled={isSubmitting} className="pr-10" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
          </div>

          <div className="space-y-2"><Label>Business Name</Label>
            <Input placeholder="e.g. MedCare Agency" value={formData.business_name}
              onChange={(e) => setFormData((p) => ({ ...p, business_name: e.target.value }))} disabled={isSubmitting} /></div>

          {/* Commission */}
          <div className="space-y-2">
            <Label>Commission Type <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-2 gap-2">
              {(["percentage", "fixed"] as const).map((t) => (
                <button key={t} type="button"
                  onClick={() => setFormData((p) => ({ ...p, commission_type: t }))}
                  className={`py-2.5 px-4 rounded-lg border text-sm font-medium transition-colors ${
                    formData.commission_type === t
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white dark:bg-gray-800 text-muted-foreground border-gray-200 hover:border-brand-400"
                  }`}>
                  {t === "percentage" ? "Percentage (%)" : "Fixed Amount (₹)"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Commission Value <span className="text-red-500">*</span>
              <span className="text-muted-foreground ml-1 font-normal text-xs">
                {formData.commission_type === "percentage" ? "(e.g. 10 = 10%)" : "(e.g. 50 = ₹50 per booking)"}
              </span>
            </Label>
            <div className="relative">
              <Input type="number" min="0" step="0.01"
                placeholder={formData.commission_type === "percentage" ? "e.g. 10" : "e.g. 50"}
                value={formData.commission_value}
                onChange={(e) => setFormData((p) => ({ ...p, commission_value: e.target.value }))}
                disabled={isSubmitting} className="pr-10" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">
                {formData.commission_type === "percentage" ? "%" : "₹"}
              </span>
            </div>
          </div>

          <div className="space-y-2"><Label>Status</Label>
            <select value={formData.status}
              onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as "active" | "inactive" }))}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" disabled={isSubmitting}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select></div>

          {drawerMode === "add" && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 px-4 py-3">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                New agents are added with <strong>Pending</strong> status. Approve them from the table after review.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0 bg-white dark:bg-gray-900">
          <Button variant="outline" onClick={() => !isSubmitting && setIsDrawerOpen(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2 bg-brand-600 hover:bg-brand-700 min-w-[150px]">
            {isSubmitting ? <><Loader className="h-4 w-4 animate-spin" /> Saving...</> : drawerMode === "add" ? <><Plus className="h-4 w-4" /> Add Agent</> : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

