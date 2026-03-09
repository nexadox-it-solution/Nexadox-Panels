"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User, Lock, Bell, Shield, Mail, Phone, Save, Eye, EyeOff,
  Clock, Stethoscope, Edit, Loader,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";

type TabKey = "profile" | "account" | "notifications" | "security";

export default function SettingsPage() {
  const supabase = createClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [doctorId, setDoctorId] = useState<number | null>(null);

  const [profileData, setProfileData] = useState({
    name: "", email: "", mobile: "", specialty: "",
    experience: 0, consultation_fee: 0, booking_fee: 0, about: "",
  });
  const [accountData, setAccountData] = useState({ name: "", email: "", mobile: "" });
  const [passwordData, setPasswordData] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true, smsNotifications: false,
    appointmentReminders: true, newPatientAlerts: true, queueUpdates: true,
  });
  const [securitySettings, setSecuritySettings] = useState({ twoFactorAuth: false, loginAlerts: true });
  const [consultationSettings, setConsultationSettings] = useState({
    avgConsultationTime: 15, bufferTime: 5, autoAcceptBookings: true, maxDailyAppointments: 20,
  });
  const [stats, setStats] = useState({ totalPatients: 0, totalAppointments: 0 });

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        // Try profile_id first (new architecture), then fall back to auth_user_id
        let doc: any = null;
        const { data: byProfile } = await supabase
          .from("doctors")
          .select("id, name, email, mobile, specialty_ids, experience, consultation_fee, booking_fee, about")
          .eq("profile_id", user.id)
          .single();
        if (byProfile) {
          doc = byProfile;
        } else {
          const { data: byAuth } = await supabase
            .from("doctors")
            .select("id, name, email, mobile, specialty_ids, experience, consultation_fee, booking_fee, about")
            .eq("auth_user_id", user.id)
            .single();
          doc = byAuth;
        }
        if (!doc) return;
        setDoctorId(doc.id);

        let specName = "";
        if (doc.specialty_ids?.length) {
          const { data: sp } = await supabase.from("specialties").select("name").eq("id", doc.specialty_ids[0]).single();
          if (sp) specName = sp.name;
        }

        setProfileData({
          name: doc.name || "", email: doc.email || "", mobile: doc.mobile || "",
          specialty: specName, experience: doc.experience || 0,
          consultation_fee: Number(doc.consultation_fee) || 0,
          booking_fee: Number(doc.booking_fee) || 0, about: doc.about || "",
        });
        setAccountData({ name: doc.name || "", email: doc.email || "", mobile: doc.mobile || "" });

        const { count: pCount } = await supabase.from("appointments").select("patient_name", { count: "exact", head: true }).eq("doctor_id", doc.id);
        const { count: aCount } = await supabase.from("appointments").select("id", { count: "exact", head: true }).eq("doctor_id", doc.id);
        setStats({ totalPatients: pCount || 0, totalAppointments: aCount || 0 });
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorId) return;
    try {
      await supabase.from("doctors").update({
        name: profileData.name, email: profileData.email, mobile: profileData.mobile,
        experience: profileData.experience, consultation_fee: profileData.consultation_fee,
        booking_fee: profileData.booking_fee, about: profileData.about,
      }).eq("id", doctorId);
      toast({ title: "Profile Updated", description: "Your profile has been saved." });
      setIsEditing(false);
    } catch { toast({ title: "Error", description: "Failed to save profile.", variant: "destructive" }); }
  };

  const handleAccountUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorId) return;
    try {
      await supabase.from("doctors").update({ name: accountData.name, email: accountData.email, mobile: accountData.mobile }).eq("id", doctorId);
      toast({ title: "Success", description: "Account information updated." });
    } catch { toast({ title: "Error", description: "Failed to update account.", variant: "destructive" }); }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) throw error;
      toast({ title: "Success", description: "Password changed successfully." });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to change password.", variant: "destructive" });
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProfileData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader className="h-8 w-8 animate-spin text-brand-600" /></div>;
  }

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "profile", label: "Profile", icon: User },
    { key: "account", label: "Account", icon: Stethoscope },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "security", label: "Security", icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile, account settings and preferences</p>
      </div>

      {/* Tab Nav */}
      <div className="border-b">
        <nav className="flex gap-6">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <Icon className="h-4 w-4" />{t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── PROFILE TAB ─────────────────────────────────────── */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-6">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Stethoscope className="h-10 w-10 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold">{profileData.name}</h3>
                  <p className="text-muted-foreground">{profileData.specialty}</p>
                  <p className="text-sm text-muted-foreground mt-1">{profileData.experience} years of experience</p>
                </div>
                <Button variant={isEditing ? "outline" : "default"} onClick={() => setIsEditing(!isEditing)} className="gap-2">
                  {isEditing ? "Cancel" : <><Edit className="h-4 w-4" />Edit Profile</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><User className="h-5 w-5 text-primary" /><CardTitle>Basic Information</CardTitle></div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSave} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="name">Full Name</Label><Input id="name" name="name" value={profileData.name} onChange={handleProfileChange} disabled={!isEditing} required /></div>
                  <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" value={profileData.email} onChange={handleProfileChange} disabled={!isEditing} required /></div>
                  <div className="space-y-2"><Label htmlFor="mobile">Mobile</Label><Input id="mobile" name="mobile" type="tel" value={profileData.mobile} onChange={handleProfileChange} disabled={!isEditing} /></div>
                  <div className="space-y-2"><Label>Specialty</Label><Input value={profileData.specialty} disabled className="bg-muted" /></div>
                  <div className="space-y-2"><Label htmlFor="experience">Experience (years)</Label><Input id="experience" name="experience" type="number" value={profileData.experience} onChange={handleProfileChange} disabled={!isEditing} /></div>
                  <div className="space-y-2"><Label htmlFor="consultation_fee">Consultation Fee (₹)</Label><Input id="consultation_fee" name="consultation_fee" type="number" value={profileData.consultation_fee} onChange={handleProfileChange} disabled={!isEditing} /></div>
                  <div className="space-y-2"><Label htmlFor="booking_fee">Booking Fee (₹)</Label><Input id="booking_fee" name="booking_fee" type="number" value={profileData.booking_fee} onChange={handleProfileChange} disabled={!isEditing} /></div>
                  <div className="space-y-2 md:col-span-2"><Label htmlFor="about">Professional Bio</Label>
                    <textarea id="about" name="about" rows={4} value={profileData.about} onChange={handleProfileChange} disabled={!isEditing}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
                  </div>
                </div>
                {isEditing && <Button type="submit" className="gap-2"><Save className="h-4 w-4" />Save Changes</Button>}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Professional Statistics</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg"><p className="text-3xl font-bold text-blue-600">{stats.totalPatients}</p><p className="text-sm text-muted-foreground mt-1">Total Patients</p></div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg"><p className="text-3xl font-bold text-green-600">{stats.totalAppointments}</p><p className="text-sm text-muted-foreground mt-1">Total Appointments</p></div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg"><p className="text-3xl font-bold text-purple-600">{profileData.experience}</p><p className="text-sm text-muted-foreground mt-1">Years Experience</p></div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── ACCOUNT TAB ─────────────────────────────────────── */}
      {activeTab === "account" && (
        <div className="space-y-6">
          <Card>
            <CardHeader><div className="flex items-center gap-2"><User className="h-5 w-5 text-primary" /><CardTitle>Account Information</CardTitle></div><CardDescription>Update your personal account details</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={handleAccountUpdate} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>Full Name</Label><Input value={accountData.name} onChange={(e) => setAccountData(p => ({ ...p, name: e.target.value }))} required /></div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" value={accountData.email} onChange={(e) => setAccountData(p => ({ ...p, email: e.target.value }))} required /></div>
                  <div className="space-y-2"><Label>Mobile</Label><Input type="tel" value={accountData.mobile} onChange={(e) => setAccountData(p => ({ ...p, mobile: e.target.value }))} required /></div>
                </div>
                <Button type="submit" className="gap-2"><Save className="h-4 w-4" />Save Changes</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div className="flex items-center gap-2"><Lock className="h-5 w-5 text-primary" /><CardTitle>Change Password</CardTitle></div></CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                <div className="space-y-2"><Label>Current Password</Label>
                  <div className="relative">
                    <Input type={showCurrentPassword ? "text" : "password"} value={passwordData.currentPassword} onChange={(e) => setPasswordData(p => ({ ...p, currentPassword: e.target.value }))} required />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowCurrentPassword(!showCurrentPassword)}>{showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  </div>
                </div>
                <div className="space-y-2"><Label>New Password</Label>
                  <div className="relative">
                    <Input type={showNewPassword ? "text" : "password"} value={passwordData.newPassword} onChange={(e) => setPasswordData(p => ({ ...p, newPassword: e.target.value }))} required />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNewPassword(!showNewPassword)}>{showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  </div>
                </div>
                <div className="space-y-2"><Label>Confirm Password</Label><Input type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData(p => ({ ...p, confirmPassword: e.target.value }))} required /></div>
                <Button type="submit" className="gap-2"><Lock className="h-4 w-4" />Change Password</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><CardTitle>Consultation Settings</CardTitle></div></CardHeader>
            <CardContent>
              <div className="space-y-4 max-w-md">
                <div className="space-y-2"><Label>Avg Consultation Time (min)</Label><Input type="number" value={consultationSettings.avgConsultationTime} onChange={(e) => setConsultationSettings(p => ({ ...p, avgConsultationTime: parseInt(e.target.value) || 0 }))} /></div>
                <div className="space-y-2"><Label>Buffer Time (min)</Label><Input type="number" value={consultationSettings.bufferTime} onChange={(e) => setConsultationSettings(p => ({ ...p, bufferTime: parseInt(e.target.value) || 0 }))} /></div>
                <div className="space-y-2"><Label>Max Daily Appointments</Label><Input type="number" value={consultationSettings.maxDailyAppointments} onChange={(e) => setConsultationSettings(p => ({ ...p, maxDailyAppointments: parseInt(e.target.value) || 0 }))} /></div>
                <div className="flex items-center justify-between py-3 border-t">
                  <div><p className="font-medium">Auto-Accept Bookings</p><p className="text-sm text-muted-foreground">Automatically accept appointment requests</p></div>
                  <button onClick={() => setConsultationSettings(p => ({ ...p, autoAcceptBookings: !p.autoAcceptBookings }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${consultationSettings.autoAcceptBookings ? "bg-primary" : "bg-gray-200"}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${consultationSettings.autoAcceptBookings ? "translate-x-6" : "translate-x-1"}`} /></button>
                </div>
                <Button className="gap-2" onClick={() => toast({ title: "Success", description: "Consultation settings saved." })}><Save className="h-4 w-4" />Save Settings</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── NOTIFICATIONS TAB ───────────────────────────────── */}
      {activeTab === "notifications" && (
        <Card>
          <CardHeader><div className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /><CardTitle>Notification Preferences</CardTitle></div></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {([
                { key: "emailNotifications" as const, icon: Mail, label: "Email Notifications", desc: "Receive notifications via email" },
                { key: "smsNotifications" as const, icon: Phone, label: "SMS Notifications", desc: "Receive notifications via SMS" },
                { key: "appointmentReminders" as const, icon: Clock, label: "Appointment Reminders", desc: "Get reminded about upcoming appointments" },
                { key: "newPatientAlerts" as const, icon: User, label: "New Patient Alerts", desc: "Get notified when new patients register" },
                { key: "queueUpdates" as const, icon: Clock, label: "Queue Updates", desc: "Real-time updates about patient queue" },
              ]).map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div className="flex items-center gap-3"><Icon className="h-5 w-5 text-muted-foreground" /><div><p className="font-medium">{item.label}</p><p className="text-sm text-muted-foreground">{item.desc}</p></div></div>
                    <button onClick={() => setNotificationSettings(p => ({ ...p, [item.key]: !p[item.key] }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationSettings[item.key] ? "bg-primary" : "bg-gray-200"}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationSettings[item.key] ? "translate-x-6" : "translate-x-1"}`} /></button>
                  </div>
                );
              })}
              <Button className="gap-2" onClick={() => toast({ title: "Success", description: "Notification preferences updated." })}><Save className="h-4 w-4" />Save Preferences</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── SECURITY TAB ────────────────────────────────────── */}
      {activeTab === "security" && (
        <Card>
          <CardHeader><div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /><CardTitle>Security Settings</CardTitle></div></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b">
                <div><p className="font-medium">Two-Factor Authentication</p><p className="text-sm text-muted-foreground">Add an extra layer of security</p></div>
                <button onClick={() => setSecuritySettings(p => ({ ...p, twoFactorAuth: !p.twoFactorAuth }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${securitySettings.twoFactorAuth ? "bg-primary" : "bg-gray-200"}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${securitySettings.twoFactorAuth ? "translate-x-6" : "translate-x-1"}`} /></button>
              </div>
              <div className="flex items-center justify-between py-3">
                <div><p className="font-medium">Login Alerts</p><p className="text-sm text-muted-foreground">Get notified when someone logs in</p></div>
                <button onClick={() => setSecuritySettings(p => ({ ...p, loginAlerts: !p.loginAlerts }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${securitySettings.loginAlerts ? "bg-primary" : "bg-gray-200"}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${securitySettings.loginAlerts ? "translate-x-6" : "translate-x-1"}`} /></button>
              </div>
              <Button className="gap-2" onClick={() => toast({ title: "Success", description: "Security settings updated." })}><Save className="h-4 w-4" />Save Security Settings</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
