"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle, Clock, XCircle, User, Building2, Loader,
  Lock, Eye, EyeOff, AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AgentProfilePage() {
  const supabase = createClient();
  const [pageLoading, setPageLoading] = useState(true);

  /* Change password state */
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwForm, setPwForm] = useState({ newPassword: "", confirmPassword: "" });

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobile: "",
    businessName: "",
    businessAddress: "",
    panNumber: "",
    gstNumber: "",
    approvalStatus: "pending" as "approved" | "pending" | "rejected",
    commissionType: "percentage" as "percentage" | "fixed",
    commissionValue: 0,
    rejectionReason: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const session = localStorage.getItem("nexadox-session") || "";
        const userId = session.split(":")[0];
        const url = userId ? `/api/agent/wallet?userId=${userId}` : `/api/agent/wallet`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const { profile, agent } = data;

        setFormData({
          name: profile.name || "",
          email: profile.email || "",
          mobile: profile.phone || "",
          businessName: agent.business_name || "",
          businessAddress: agent.business_address || "",
          panNumber: agent.pan_number || "",
          gstNumber: agent.gst_number || "",
          approvalStatus: (agent.approval_status || "pending") as "approved" | "pending" | "rejected",
          commissionType: (agent.commission_type || "percentage") as "percentage" | "fixed",
          commissionValue: Number(agent.commission_value) || 0,
          rejectionReason: agent.rejection_reason || "",
        });
      } catch (e) {
        console.error("Error fetching agent profile:", e);
      } finally {
        setPageLoading(false);
      }
    })();
  }, []);

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const renderApprovalStatus = () => {
    switch (formData.approvalStatus) {
      case "approved":
        return (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-900">Profile Approved ✓</h3>
                <p className="text-sm text-green-700 mt-1">
                  Your agent profile has been approved. You can now start booking appointments and earning commissions.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-green-600 font-medium">Commission Type</p>
                    <p className="text-sm font-semibold text-green-900 mt-1">
                      {formData.commissionType === "percentage" ? "Percentage" : "Fixed Amount"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-green-600 font-medium">Commission Rate</p>
                    <p className="text-sm font-semibold text-green-900 mt-1">
                      {formData.commissionType === "percentage" ? `${formData.commissionValue}%` : `₹${formData.commissionValue}`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "pending":
        return (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-900">Pending Approval</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Your profile is currently under review by our team. This usually takes 1-2 business days.
                </p>
              </div>
            </div>
          </div>
        );
      case "rejected":
        return (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900">Application Rejected</h3>
                <p className="text-sm text-red-700 mt-1">
                  Unfortunately, your agent application has been rejected. Please contact support.
                </p>
                {formData.rejectionReason && (
                  <div className="mt-4 bg-white rounded-lg p-3 border border-red-200">
                    <p className="text-xs text-red-600 font-medium mb-1">Rejection Reason</p>
                    <p className="text-sm text-red-900">{formData.rejectionReason}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Agent Profile</h1>
          <p className="text-muted-foreground mt-1">View your business information and approval status</p>
        </div>
        <Button variant="outline" disabled className="gap-2 opacity-60 cursor-not-allowed">View Only</Button>
      </div>

      {renderApprovalStatus()}

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
          <CardDescription>Your business details for agent verification</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Personal Information</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={formData.name} disabled />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={formData.email} disabled />
              </div>
              <div className="space-y-2">
                <Label>Mobile</Label>
                <Input value={formData.mobile} disabled />
              </div>
            </div>
          </div>

          {/* Business Information */}
          <div className="space-y-4 pt-6 border-t">
            <h3 className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> Business Information</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input value={formData.businessName} disabled />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Business Address</Label>
                <Input value={formData.businessAddress} disabled />
              </div>
              <div className="space-y-2">
                <Label>PAN Number</Label>
                <Input value={formData.panNumber} disabled />
              </div>
              <div className="space-y-2">
                <Label>GST Number</Label>
                <Input value={formData.gstNumber || "—"} disabled />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commission Information */}
      {formData.approvalStatus === "approved" && (
        <Card>
          <CardHeader>
            <CardTitle>Commission Details</CardTitle>
            <CardDescription>Your earnings structure on each booking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Commission Type</p>
                <p className="text-2xl font-bold">
                  {formData.commissionType === "percentage" ? "Percentage Based" : "Fixed Amount"}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Commission Value</p>
                <p className="text-2xl font-bold text-green-600">
                  {formData.commissionType === "percentage" ? `${formData.commissionValue}%` : `₹${formData.commissionValue}`}
                </p>
              </div>
              <div className="md:col-span-2 bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <span className="font-semibold">Example:</span> For a ₹500 consultation, you&apos;ll earn{" "}
                  <span className="font-bold">
                    ₹{formData.commissionType === "percentage" ? (500 * formData.commissionValue) / 100 : formData.commissionValue}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-blue-600" /> Change Password</CardTitle>
          <CardDescription>Update your account password. Must be at least 6 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          {pwMsg && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
              <CheckCircle className="h-4 w-4" /> {pwMsg}
            </div>
          )}
          {pwErr && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
              <AlertCircle className="h-4 w-4" /> {pwErr}
            </div>
          )}
          <form onSubmit={async (e) => {
            e.preventDefault();
            setPwMsg(""); setPwErr("");
            if (!pwForm.newPassword || pwForm.newPassword.length < 6) { setPwErr("New password must be at least 6 characters."); return; }
            if (pwForm.newPassword !== pwForm.confirmPassword) { setPwErr("Passwords do not match."); return; }
            setPwSaving(true);
            try {
              const { error } = await supabase.auth.updateUser({ password: pwForm.newPassword });
              if (error) throw error;
              setPwMsg("Password changed successfully!");
              setPwForm({ newPassword: "", confirmPassword: "" });
            } catch (err: any) { setPwErr(err?.message || "Failed to change password."); }
            finally { setPwSaving(false); }
          }} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input type={showNew ? "text" : "password"} value={pwForm.newPassword} onChange={e => { setPwForm(p => ({ ...p, newPassword: e.target.value })); setPwErr(""); }} placeholder="Enter new password" required />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <div className="relative">
                <Input type={showConfirm ? "text" : "password"} value={pwForm.confirmPassword} onChange={e => { setPwForm(p => ({ ...p, confirmPassword: e.target.value })); setPwErr(""); }} placeholder="Confirm new password" required />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={pwSaving} className="gap-2 bg-blue-600 hover:bg-blue-700">
              {pwSaving ? <><Loader className="h-4 w-4 animate-spin" /> Changing…</> : <><Lock className="h-4 w-4" /> Change Password</>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
