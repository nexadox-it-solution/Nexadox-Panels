"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Settings, Save, Loader, AlertCircle, CheckCircle,
  Building2, Percent, Users, Calendar, Shield, RefreshCcw,
  IndianRupee, Hash, Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/* ─── Types ─────────────────────────────────────────────────── */
interface SystemSetting {
  id: number;
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

interface SettingsForm {
  platform_name: string;
  default_gst_percent: string;
  default_agent_commission: string;
  booking_sessions: string[];
  default_max_seats: string;
}

const DEFAULT_SESSIONS = ["Morning", "Afternoon", "Evening", "Night"];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [rawSettings, setRawSettings] = useState<SystemSetting[]>([]);

  const [form, setForm] = useState<SettingsForm>({
    platform_name: "Nexadox",
    default_gst_percent: "18",
    default_agent_commission: "10",
    booking_sessions: DEFAULT_SESSIONS,
    default_max_seats: "30",
  });

  // Platform stats
  const [stats, setStats] = useState({
    totalUsers: 0, totalDoctors: 0, totalPatients: 0,
    totalAppointments: 0, totalClinics: 0, totalAgents: 0,
  });

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .order("id", { ascending: true });

      if (error) throw error;

      const settings = data || [];
      setRawSettings(settings);

      // Parse settings into form
      const getValue = (key: string, fallback: string) => {
        const s = settings.find((s: SystemSetting) => s.key === key);
        if (!s) return fallback;
        try {
          const parsed = JSON.parse(s.value);
          return typeof parsed === "string" ? parsed : String(s.value);
        } catch {
          return String(s.value).replace(/^"|"$/g, "");
        }
      };

      const getArrayValue = (key: string, fallback: string[]) => {
        const s = settings.find((s: SystemSetting) => s.key === key);
        if (!s) return fallback;
        try {
          const parsed = JSON.parse(s.value);
          return Array.isArray(parsed) ? parsed : fallback;
        } catch {
          return fallback;
        }
      };

      setForm({
        platform_name: getValue("platform_name", "Nexadox"),
        default_gst_percent: getValue("default_gst_percent", "18"),
        default_agent_commission: getValue("default_agent_commission", "10"),
        booking_sessions: getArrayValue("booking_sessions", DEFAULT_SESSIONS),
        default_max_seats: getValue("default_max_seats", "30"),
      });

      // Fetch platform stats
      const [usersRes, doctorsRes, patientsRes, aptsRes, clinicsRes, agentsRes] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("doctors").select("*", { count: "exact", head: true }),
        supabase.from("patients").select("*", { count: "exact", head: true }),
        supabase.from("appointments").select("*", { count: "exact", head: true }),
        supabase.from("clinics").select("*", { count: "exact", head: true }),
        supabase.from("agents").select("*", { count: "exact", head: true }),
      ]);

      setStats({
        totalUsers: usersRes.count || 0,
        totalDoctors: doctorsRes.count || 0,
        totalPatients: patientsRes.count || 0,
        totalAppointments: aptsRes.count || 0,
        totalClinics: clinicsRes.count || 0,
        totalAgents: agentsRes.count || 0,
      });
    } catch (err) {
      console.error("Failed to load settings:", err);
      setErrorMsg("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg("");
    try {
      const updates = [
        { key: "platform_name", value: JSON.stringify(form.platform_name), description: "Platform display name" },
        { key: "default_gst_percent", value: form.default_gst_percent, description: "Default GST percentage" },
        { key: "default_agent_commission", value: form.default_agent_commission, description: "Default agent commission %" },
        { key: "booking_sessions", value: JSON.stringify(form.booking_sessions), description: "Available booking sessions" },
        { key: "default_max_seats", value: form.default_max_seats, description: "Default max seats per session" },
      ];

      for (const update of updates) {
        const existing = rawSettings.find(s => s.key === update.key);
        if (existing) {
          const { error } = await supabase
            .from("system_settings")
            .update({ value: update.value, updated_at: new Date().toISOString() })
            .eq("key", update.key);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("system_settings")
            .insert({ key: update.key, value: update.value, description: update.description });
          if (error) throw error;
        }
      }

      showSuccess("Settings saved successfully!");
      fetchSettings();
    } catch (err: any) {
      console.error("Save error:", err);
      setErrorMsg(err?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSession = (session: string) => {
    setForm(prev => ({
      ...prev,
      booking_sessions: prev.booking_sessions.includes(session)
        ? prev.booking_sessions.filter(s => s !== session)
        : [...prev.booking_sessions, session],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader className="h-8 w-8 animate-spin text-brand-600" />
        <p className="ml-3 text-muted-foreground">Loading settings…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="h-8 w-8 text-brand-600" /> Settings
            </h1>
            <p className="text-muted-foreground mt-1">Manage platform configuration and preferences</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-brand-600 hover:bg-brand-700 min-w-[140px]">
          {saving ? <><Loader className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save Changes</>}
        </Button>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          <CheckCircle className="h-4 w-4 flex-shrink-0" /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {errorMsg}
        </div>
      )}

      {/* Platform Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-brand-600" /> Platform Overview
          </CardTitle>
          <CardDescription>Current platform statistics at a glance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Users", val: stats.totalUsers, icon: <Users className="h-5 w-5 text-blue-500" />, bg: "bg-blue-50" },
              { label: "Doctors", val: stats.totalDoctors, icon: <Users className="h-5 w-5 text-green-500" />, bg: "bg-green-50" },
              { label: "Patients", val: stats.totalPatients, icon: <Users className="h-5 w-5 text-pink-500" />, bg: "bg-pink-50" },
              { label: "Agents", val: stats.totalAgents, icon: <Users className="h-5 w-5 text-orange-500" />, bg: "bg-orange-50" },
              { label: "Clinics", val: stats.totalClinics, icon: <Building2 className="h-5 w-5 text-purple-500" />, bg: "bg-purple-50" },
              { label: "Appointments", val: stats.totalAppointments, icon: <Calendar className="h-5 w-5 text-brand-500" />, bg: "bg-brand-50" },
            ].map(item => (
              <div key={item.label} className={`${item.bg} rounded-xl p-4 text-center`}>
                <div className="flex justify-center mb-2">{item.icon}</div>
                <p className="text-2xl font-bold">{item.val}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-brand-600" /> General Settings
            </CardTitle>
            <CardDescription>Basic platform configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Platform Name</Label>
              <Input
                value={form.platform_name}
                onChange={(e) => setForm(prev => ({ ...prev, platform_name: e.target.value }))}
                placeholder="e.g. Nexadox"
              />
              <p className="text-xs text-muted-foreground">Displayed across the platform and invoices</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" /> Default Max Seats Per Session
              </Label>
              <Input
                type="number"
                min="1"
                max="500"
                value={form.default_max_seats}
                onChange={(e) => setForm(prev => ({ ...prev, default_max_seats: e.target.value }))}
                placeholder="30"
              />
              <p className="text-xs text-muted-foreground">Maximum number of patients per booking session (can be overridden per doctor)</p>
            </div>
          </CardContent>
        </Card>

        {/* Financial Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IndianRupee className="h-5 w-5 text-brand-600" /> Financial Settings
            </CardTitle>
            <CardDescription>Tax and commission configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Percent className="h-3.5 w-3.5" /> GST Percentage
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={form.default_gst_percent}
                  onChange={(e) => setForm(prev => ({ ...prev, default_gst_percent: e.target.value }))}
                  placeholder="18"
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">%</span>
              </div>
              <p className="text-xs text-muted-foreground">Applied to all invoices by default</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Percent className="h-3.5 w-3.5" /> Default Agent Commission
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={form.default_agent_commission}
                  onChange={(e) => setForm(prev => ({ ...prev, default_agent_commission: e.target.value }))}
                  placeholder="10"
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">%</span>
              </div>
              <p className="text-xs text-muted-foreground">Default commission rate for agents (can be overridden per agent)</p>
            </div>
          </CardContent>
        </Card>

        {/* Booking Sessions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-brand-600" /> Booking Sessions
            </CardTitle>
            <CardDescription>Enable or disable available booking time slots</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {["Morning", "Afternoon", "Evening", "Night"].map((session) => {
                const isActive = form.booking_sessions.includes(session);
                const timeLabel = session === "Morning" ? "9:00 AM" : session === "Afternoon" ? "1:00 PM" : session === "Evening" ? "5:00 PM" : "8:00 PM";
                return (
                  <button
                    key={session}
                    onClick={() => toggleSession(session)}
                    className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-5 transition-all ${
                      isActive
                        ? "border-brand-500 bg-brand-50 text-brand-700 shadow-sm"
                        : "border-gray-200 bg-white text-gray-400 hover:border-gray-300"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle className="h-4 w-4 text-brand-500" />
                      </div>
                    )}
                    <Calendar className={`h-6 w-6 ${isActive ? "text-brand-600" : "text-gray-300"}`} />
                    <span className="font-semibold text-sm">{session}</span>
                    <span className={`text-xs ${isActive ? "text-brand-600" : "text-gray-400"}`}>{timeLabel}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">Click to enable/disable. At least one session must remain active.</p>
          </CardContent>
        </Card>
      </div>

      {/* Database Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RefreshCcw className="h-5 w-5 text-brand-600" /> System Information
          </CardTitle>
          <CardDescription>Raw settings stored in the database</CardDescription>
        </CardHeader>
        <CardContent>
          {rawSettings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No system settings found in database. Click &quot;Save Changes&quot; to initialize.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2.5 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Key</th>
                    <th className="text-left py-2.5 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Value</th>
                    <th className="text-left py-2.5 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Description</th>
                    <th className="text-left py-2.5 px-4 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {rawSettings.map((s) => (
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="py-2.5 px-4">
                        <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{s.key}</code>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="text-xs font-mono text-brand-700 bg-brand-50 px-2 py-0.5 rounded max-w-[200px] truncate inline-block">
                          {String(s.value).length > 50 ? String(s.value).slice(0, 50) + "…" : String(s.value)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground text-xs">{s.description || "—"}</td>
                      <td className="py-2.5 px-4 text-muted-foreground text-xs">
                        {new Date(s.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Save */}
      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-brand-600 hover:bg-brand-700 min-w-[160px]">
          {saving ? <><Loader className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save All Settings</>}
        </Button>
      </div>
    </div>
  );
}
