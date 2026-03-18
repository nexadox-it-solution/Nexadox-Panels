"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle,
  Clock,
  XCircle,
  Upload,
  FileText,
  Save,
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  Loader,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function AgentProfilePage() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [agentId, setAgentId] = useState<number | null>(null);

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

  const [documents, setDocuments] = useState({
    panCard: null as File | null,
    gstCertificate: null as File | null,
    businessProof: null as File | null,
  });

  /* ── Fetch agent data from server-side API (uses service role key) ── */
  useEffect(() => {
    (async () => {
      try {
        /* Get userId from localStorage (reliable even when cookies expire) */
        const session = localStorage.getItem("nexadox-session") || "";
        const userId = session.split(":")[0];

        const url = userId ? `/api/agent/wallet?userId=${userId}` : `/api/agent/wallet`;
        const res = await fetch(url);
        if (!res.ok) {
          console.error("Agent profile API error:", res.status);
          return;
        }

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
        if (agent.id) setAgentId(agent.id);
      } catch (e) {
        console.error("Error fetching agent profile:", e);
      } finally {
        setPageLoading(false);
      }
    })();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof documents) => {
    if (e.target.files && e.target.files[0]) {
      setDocuments((prev) => ({
        ...prev,
        [field]: e.target.files![0],
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Update profiles table (name, phone)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("profiles").update({ name: formData.name, phone: formData.mobile }).eq("id", user.id);

      // Update agent table (business info)
      if (agentId) {
        await supabase.from("agents").update({
          business_name: formData.businessName,
          business_address: formData.businessAddress,
          pan_number: formData.panNumber,
          gst_number: formData.gstNumber,
        }).eq("id", agentId);
      }

      toast({ title: "Profile Updated", description: "Your profile has been updated successfully." });
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    }
  };

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
                <h3 className="text-lg font-semibold text-green-900">
                  Profile Approved ✓
                </h3>
                <p className="text-sm text-green-700 mt-1">
                  Your agent profile has been approved. You can now start
                  booking appointments and earning commissions.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-green-600 font-medium">
                      Commission Type
                    </p>
                    <p className="text-sm font-semibold text-green-900 mt-1">
                      {formData.commissionType === "percentage"
                        ? "Percentage"
                        : "Fixed Amount"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-green-600 font-medium">
                      Commission Rate
                    </p>
                    <p className="text-sm font-semibold text-green-900 mt-1">
                      {formData.commissionType === "percentage"
                        ? `${formData.commissionValue}%`
                        : `₹${formData.commissionValue}`}
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
                <h3 className="text-lg font-semibold text-yellow-900">
                  Pending Approval
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Your profile is currently under review by our team. This
                  usually takes 1-2 business days. You&apos;ll receive a notification
                  once your application is reviewed.
                </p>
                <div className="mt-4">
                  <p className="text-xs text-yellow-600 font-medium">
                    Submission Date
                  </p>
                  <p className="text-sm font-semibold text-yellow-900 mt-1">
                    February 12, 2026
                  </p>
                </div>
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
                <h3 className="text-lg font-semibold text-red-900">
                  Application Rejected
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  Unfortunately, your agent application has been rejected.
                  Please review the reason below and resubmit with correct
                  information.
                </p>
                {formData.rejectionReason && (
                  <div className="mt-4 bg-white rounded-lg p-3 border border-red-200">
                    <p className="text-xs text-red-600 font-medium mb-1">
                      Rejection Reason
                    </p>
                    <p className="text-sm text-red-900">
                      {formData.rejectionReason}
                    </p>
                  </div>
                )}
                <Button variant="outline" className="mt-4" onClick={() => setIsEditing(true)}>
                  Update & Resubmit
                </Button>
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Agent Profile
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your business information and approval status
          </p>
        </div>
        <Button variant="outline" disabled className="gap-2 opacity-60 cursor-not-allowed">
          Profile Locked
        </Button>
      </div>

      {/* Approval Status Card */}
      {renderApprovalStatus()}

      {/* Profile Form */}
      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
          <CardDescription>
            Your business details for agent verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Personal Information
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={!isEditing}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={!isEditing}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input
                    id="mobile"
                    name="mobile"
                    type="tel"
                    value={formData.mobile}
                    onChange={handleChange}
                    disabled={!isEditing}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Business Information */}
            <div className="space-y-4 pt-6 border-t">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Business Information
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    disabled={!isEditing}
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="businessAddress">Business Address</Label>
                  <Input
                    id="businessAddress"
                    name="businessAddress"
                    value={formData.businessAddress}
                    onChange={handleChange}
                    disabled={!isEditing}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="panNumber">PAN Number</Label>
                  <Input
                    id="panNumber"
                    name="panNumber"
                    value={formData.panNumber}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="ABCDE1234F"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gstNumber">GST Number (Optional)</Label>
                  <Input
                    id="gstNumber"
                    name="gstNumber"
                    value={formData.gstNumber}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>
              </div>
            </div>

            {/* Document Upload */}
            {isEditing && (
              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Documents
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="panCard">PAN Card</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary transition-colors cursor-pointer">
                      <input
                        type="file"
                        id="panCard"
                        className="hidden"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileChange(e, "panCard")}
                      />
                      <label htmlFor="panCard" className="cursor-pointer">
                        <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">
                          {documents.panCard
                            ? documents.panCard.name
                            : "Click to upload"}
                        </p>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gstCertificate">GST Certificate</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary transition-colors cursor-pointer">
                      <input
                        type="file"
                        id="gstCertificate"
                        className="hidden"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileChange(e, "gstCertificate")}
                      />
                      <label htmlFor="gstCertificate" className="cursor-pointer">
                        <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">
                          {documents.gstCertificate
                            ? documents.gstCertificate.name
                            : "Click to upload"}
                        </p>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessProof">Business Proof</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary transition-colors cursor-pointer">
                      <input
                        type="file"
                        id="businessProof"
                        className="hidden"
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileChange(e, "businessProof")}
                      />
                      <label htmlFor="businessProof" className="cursor-pointer">
                        <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">
                          {documents.businessProof
                            ? documents.businessProof.name
                            : "Click to upload"}
                        </p>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {isEditing && (
              <div className="flex gap-4 pt-6 border-t">
                <Button type="submit" className="gap-2">
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Commission Information */}
      {formData.approvalStatus === "approved" && (
        <Card>
          <CardHeader>
            <CardTitle>Commission Details</CardTitle>
            <CardDescription>
              Your earnings structure on each booking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Commission Type</p>
                <p className="text-2xl font-bold">
                  {formData.commissionType === "percentage"
                    ? "Percentage Based"
                    : "Fixed Amount"}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Commission Value</p>
                <p className="text-2xl font-bold text-green-600">
                  {formData.commissionType === "percentage"
                    ? `${formData.commissionValue}%`
                    : `₹${formData.commissionValue}`}
                </p>
              </div>
              <div className="md:col-span-2 bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <span className="font-semibold">Example:</span> For a ₹500
                  consultation, you&apos;ll earn a commission of{" "}
                  <span className="font-bold">
                    ₹
                    {formData.commissionType === "percentage"
                      ? (500 * formData.commissionValue) / 100
                      : formData.commissionValue}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TODO: Add approval history */}
      {/* TODO: Add document verification status */}
      {/* TODO: Add contact support button */}
    </div>
  );
}
