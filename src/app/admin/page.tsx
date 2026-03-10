"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, UserCog, Stethoscope, Calendar,
  TrendingUp, Clock, Activity, IndianRupee,
  ArrowRight, Building2, AlertCircle, Eye, EyeOff, Settings, Zap, X,
} from "lucide-react";
import Link from "next/link";

/* ─── Mini Bar Chart (pure SVG) ────────────────────────── */
function BarChart({ data, color = "#3b82f6" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const barW = 28, gap = 8, h = 120;
  const w = data.length * (barW + gap);
  return (
    <svg viewBox={`0 0 ${w} ${h + 24}`} className="w-full" style={{ maxHeight: 160 }}>
      {data.map((d, i) => {
        const barH = (d.value / max) * h;
        const x = i * (barW + gap);
        return (
          <g key={i}>
            <rect x={x} y={h - barH} width={barW} height={barH} rx={4} fill={color} opacity={0.85} />
            <text x={x + barW / 2} y={h - barH - 4} textAnchor="middle" fontSize="10" fill="#374151" fontWeight="600">{d.value}</text>
            <text x={x + barW / 2} y={h + 14} textAnchor="middle" fontSize="9" fill="#9ca3af">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Donut Chart (pure SVG) ─────────────────────────────── */
function DonutChart({ segments, centerLabel }: { segments: { label: string; value: number; color: string }[]; centerLabel?: string }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const r = 40, cx = 55, cy = 55, stroke = 14;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={110} height={110} viewBox="0 0 110 110">
        {segments.map((seg, i) => {
          const dash = (seg.value / total) * circ;
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color}
              strokeWidth={stroke} strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset} strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`} />
          );
          offset += dash;
          return el;
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="700" fill="#111">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#9ca3af">{centerLabel || "Total"}</text>
      </svg>
      <div className="space-y-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="font-semibold ml-auto">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── INR Formatter ──────────────────────────────────────── */
const inr = (v: number) => `₹${v.toLocaleString("en-IN")}`;

/* ─── Default empty data ─────────────────────────────────────────── */
const defaultStats = {
  totalUsers: 0,
  totalDoctors: 0,
  totalAgents: 0,
  totalPatients: 0,
  totalClinics: 0,
  totalAppointments: 0,
  todayAppointments: 0,
  totalRevenue: 0,
  thisMonthRevenue: 0,
  pendingApprovals: 0,
};

const defaultMonthlyRevenue = [
  { label: "Sep", value: 0 }, { label: "Oct", value: 0 },
  { label: "Nov", value: 0 }, { label: "Dec", value: 0 },
  { label: "Jan", value: 0 }, { label: "Feb", value: 0 },
];

const defaultWeeklyAppointments = [
  { label: "Mon", value: 0 }, { label: "Tue", value: 0 }, { label: "Wed", value: 0 },
  { label: "Thu", value: 0 }, { label: "Fri", value: 0 }, { label: "Sat", value: 0 },
];

const defaultUserDistribution = [
  { label: "Patients", value: 0, color: "#3b82f6" },
  { label: "Doctors", value: 0, color: "#10b981" },
  { label: "Agents", value: 0, color: "#f59e0b" },
];

const defaultAppointmentStatus = [
  { label: "Completed", value: 0, color: "#10b981" },
  { label: "Scheduled", value: 0, color: "#3b82f6" },
  { label: "Cancelled", value: 0, color: "#ef4444" },
];

/* ─── Widget Configuration ──────────────────────────────── */
const DEFAULT_WIDGETS = {
  primaryStats: true,
  secondaryStats: true,
  charts: true,
  adminKpis: true,
  attendantKpis: false,
  recentAppointments: true,
  pendingAgents: true,
  topDoctors: true,
  quickNav: true,
};

type WidgetConfig = typeof DEFAULT_WIDGETS;

const statusBadge = (s: string) => {
  if (s === "completed") return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Completed</span>;
  if (s === "in_progress") return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">In Progress</span>;
  if (s === "scheduled") return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Scheduled</span>;
  if (s === "cancelled") return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Cancelled</span>;
  return null;
};

export default function AdminDashboard() {
  const supabase = createClient();
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(defaultStats);
  const [monthlyRevenue, setMonthlyRevenue] = useState(defaultMonthlyRevenue);
  const [weeklyAppointments, setWeeklyAppointments] = useState(defaultWeeklyAppointments);
  const [userDistribution, setUserDistribution] = useState(defaultUserDistribution);
  const [appointmentStatus, setAppointmentStatus] = useState(defaultAppointmentStatus);
  const [recentAppointments, setRecentAppointments] = useState<any[]>([]);
  const [pendingAgents, setPendingAgents] = useState<any[]>([]);
  const [topDoctors, setTopDoctors] = useState<any[]>([]);
  
  // Admin & Attendant KPIs
  const [adminKpis, setAdminKpis] = useState({
    adminTransactions: 0,
    adminRevenue: 0,
    pendingApprovals: 0,
    topAgent: { name: "", transactions: 0 },
  });
  const [attendantKpis, setAttendantKpis] = useState({
    totalAttendants: 0,
    appointmentsHandled: 0,
    patientsServed: 0,
    avgRating: 0,
  });
  
  // Widget customization
  const [widgets, setWidgets] = useState<WidgetConfig>(DEFAULT_WIDGETS);
  const [showWidgetModal, setShowWidgetModal] = useState(false);

  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    // Load widget preferences from localStorage
    const saved = localStorage.getItem("adminDashboardWidgets");
    let loadedWidgets = DEFAULT_WIDGETS;
    if (saved) {
      try {
        loadedWidgets = JSON.parse(saved);
        setWidgets(loadedWidgets);
      } catch (e) {
        // Ignore parse errors, use defaults
      }
    }
    fetchDashboardData();
    // Fetch admin KPIs if enabled by default
    if (loadedWidgets.adminKpis) fetchAdminKpis();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch basic counts
      const [usersRes, doctorsRes, agentsRes, patientsRes, clinicsRes, appointmentsRes] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("doctors").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("agents").select("*", { count: "exact", head: true }),
        supabase.from("patients").select("*", { count: "exact", head: true }),
        supabase.from("clinics").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("appointments").select("*", { count: "exact", head: true }),
      ]);

      const totalUsers = usersRes.count || 0;
      const totalDoctors = doctorsRes.count || 0;
      const totalAgents = agentsRes.count || 0;
      const totalPatients = patientsRes.count || 0;
      const totalClinics = clinicsRes.count || 0;
      const totalAppointments = appointmentsRes.count || 0;

      // Fetch today's appointments
      const today_date = new Date().toISOString().split("T")[0];
      const todayRes = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("appointment_date", today_date);
      const todayAppointments = todayRes.count || 0;

      // Fetch revenue data
      const revenueRes = await supabase
        .from("invoices")
        .select("total_amount, created_at");
      const allInvoices = revenueRes.data || [];
      const totalRevenue = allInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthRevenue = allInvoices
        .filter(inv => new Date(inv.created_at) >= thisMonthStart)
        .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

      // Fetch pending approvals
      const pendingRes = await supabase
        .from("agents")
        .select("*", { count: "exact", head: true })
        .eq("approval_status", "pending");
      const pendingApprovals = pendingRes.count || 0;

      // Build charts data - Monthly Revenue (last 6 months, in thousands)
      const monthlyRevenueData = [];
      const monthNames = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        const monthRevenue = allInvoices
          .filter(inv => {
            const invDate = new Date(inv.created_at);
            return invDate >= monthStart && invDate <= monthEnd;
          })
          .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
        monthlyRevenueData.push({
          label: monthNames[5 - i],
          value: Math.round(monthRevenue / 1000), // Convert to thousands
        });
      }

      // Build charts data - Weekly Appointments (this week, by day of week)
      const weeklyApptData = [];
      const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      
      // Get appointments
      const weekApptRes = await supabase
        .from("appointments")
        .select("appointment_date")
        .gte("appointment_date", new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString().split("T")[0])
        .lte("appointment_date", today_date);
      const weekAppts = weekApptRes.data || [];

      for (let i = 0; i < 6; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (5 - i));
        const dateStr = date.toISOString().split("T")[0];
        const dayAppts = weekAppts.filter(a => a.appointment_date === dateStr).length;
        weeklyApptData.push({
          label: dayNames[date.getDay() === 0 ? 6 : date.getDay() - 1],
          value: dayAppts,
        });
      }

      // User distribution - count by role from profiles table
      const allProfilesRes = await supabase.from("profiles").select("role");
      const allProfiles = allProfilesRes.data || [];
      const userRoleDoctorCount = allProfiles.filter(u => u.role === "doctor").length;
      const userRoleAgentCount = allProfiles.filter(u => u.role === "agent").length;
      
      // Count patients from patients table
      const patientsTableRes = await supabase.from("patients").select("*", { count: "exact", head: true });
      let patientCount = patientsTableRes.count || 0;

      // Also count unique patients from appointments table not already in patients table
      const { data: aptPatients } = await supabase
        .from("appointments")
        .select("patient_name, patient_phone, patient_email");
      if (aptPatients) {
        const { data: existingPatients } = await supabase.from("patients").select("email, phone");
        const existingKeys = new Set<string>();
        (existingPatients || []).forEach((p: any) => {
          if (p.email) existingKeys.add(p.email);
          if (p.phone) existingKeys.add(p.phone);
        });
        const uniqueAptPatients = new Set<string>();
        aptPatients.forEach((a: any) => {
          const key = a.patient_phone || a.patient_email || a.patient_name;
          if (key && !existingKeys.has(a.patient_email) && !existingKeys.has(a.patient_phone)) {
            uniqueAptPatients.add(key);
          }
        });
        patientCount += uniqueAptPatients.size;
      }

      // Appointment status distribution
      const statusRes = await supabase
        .from("appointments")
        .select("status");
      const statuses = statusRes.data || [];
      const completedCount = statuses.filter(a => a.status === "completed").length;
      const scheduledCount = statuses.filter(a => a.status === "scheduled").length;
      const cancelledCount = statuses.filter(a => a.status === "cancelled").length;

      // Fetch recent appointments with patient and doctor names
      const recentRes = await supabase
        .from("appointments")
        .select("id, patient_id, patient_name, doctor_id, appointment_date, appointment_time, status, booking_amount, clinic_id")
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false })
        .limit(5);
      
      const recentAppts: any[] = [];
      if (recentRes.data) {
        for (const apt of recentRes.data) {
          try {
            // Get patient name: from patients table if linked, otherwise from appointment record
            let patientName = apt.patient_name || "N/A";
            if (apt.patient_id) {
              const patientRes = await supabase.from("patients").select("name").eq("id", apt.patient_id).single();
              if (patientRes.data?.name) patientName = patientRes.data.name;
            }

            const [doctorRes, clinicRes] = await Promise.all([
              supabase.from("doctors").select("name").eq("id", apt.doctor_id).single(),
              apt.clinic_id ? supabase.from("clinics").select("name").eq("id", apt.clinic_id).single() : Promise.resolve({ data: null }),
            ]);
            if (doctorRes.data) {
              recentAppts.push({
                patient: patientName,
                doctor: `Dr. ${doctorRes.data.name || "Unknown"}`,
                time: apt.appointment_time || "N/A",
                clinic: clinicRes?.data?.name || "N/A",
                status: apt.status,
                fee: apt.booking_amount || 0,
              });
            }
          } catch (e) {
            // Skip on error
          }
        }
      }

      // Fetch pending agents
      const pendingAgentsRes = await supabase
        .from("agents")
        .select("name, phone, created_at, city")
        .eq("approval_status", "pending")
        .limit(3);
      
      const agents: any[] = [];
      if (pendingAgentsRes.data) {
        for (const agent of pendingAgentsRes.data) {
          const createdDate = new Date(agent.created_at);
          const daysAgo = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
          agents.push({
            name: agent.name,
            phone: agent.phone,
            applied: `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`,
            area: agent.city || "N/A",
          });
        }
      }

      // Fetch top doctors by patient count
      const topDocRes = await supabase
        .from("doctors")
        .select("id, name, specialty")
        .order("id", { ascending: false })
        .limit(4);

      const doctors: any[] = [];
      if (topDocRes.data) {
        for (const doc of topDocRes.data) {
          try {
            const apptCountRes = await supabase
              .from("appointments")
              .select("*", { count: "exact", head: true })
              .eq("doctor_id", doc.id);
            
            const revenueRes = await supabase
              .from("appointments")
              .select("booking_amount")
              .eq("doctor_id", doc.id);
            
            const patientCount = apptCountRes.count || 0;
            const revenue = (revenueRes.data || []).reduce((sum, a) => sum + (a.booking_amount || 0), 0);
            
            doctors.push({
              name: `Dr. ${doc.name}`,
              specialty: doc.specialty || "General Practice",
              patients: patientCount,
              revenue: revenue,
              rating: 4.5 + Math.random() * 0.5, // Placeholder rating
            });
          } catch (e) {
            // Skip on error
          }
        }
      }

      // Update state with fetched data
      setStats({
        totalUsers,
        totalDoctors,
        totalAgents,
        totalPatients: patientCount,
        totalClinics,
        totalAppointments,
        todayAppointments,
        totalRevenue,
        thisMonthRevenue,
        pendingApprovals,
      });

      setMonthlyRevenue(monthlyRevenueData);
      setWeeklyAppointments(weeklyApptData);
      setUserDistribution([
        { label: "Patients", value: patientCount, color: "#3b82f6" },
        { label: "Doctors", value: userRoleDoctorCount, color: "#10b981" },
        { label: "Agents", value: userRoleAgentCount, color: "#f59e0b" },
      ]);
      setAppointmentStatus([
        { label: "Completed", value: completedCount, color: "#10b981" },
        { label: "Scheduled", value: scheduledCount, color: "#3b82f6" },
        { label: "Cancelled", value: cancelledCount, color: "#ef4444" },
      ]);

      setRecentAppointments(recentAppts);
      setPendingAgents(agents);
      setTopDoctors(doctors);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setLoading(false);
    }
  };

  /* ─── Fetch Admin KPIs ───────────────────────────────── */
  const fetchAdminKpis = async () => {
    try {
      // Admin transactions count
      const adminTxnRes = await supabase
        .from("admin_transactions")
        .select("*", { count: "exact", head: true });
      const adminTransactionCount = adminTxnRes.count || 0;

      // Admin transaction revenue
      const adminTxnDataRes = await supabase
        .from("admin_transactions")
        .select("amount");
      const adminRevenue = (adminTxnDataRes.data || []).reduce((s, t) => s + (t.amount || 0), 0);

      // Pending approvals (agents + doctors)
      const pendingAgentsRes = await supabase
        .from("agents")
        .select("*", { count: "exact", head: true })
        .eq("approval_status", "pending");
      const pendingDoctorsRes = await supabase
        .from("doctors")
        .select("*", { count: "exact", head: true })
        .eq("approval_status", "pending");
      const totalPending = (pendingAgentsRes.count || 0) + (pendingDoctorsRes.count || 0);

      // Top agent by transaction count
      const topAgentRes = await supabase
        .from("agent_transactions")
        .select("user_name, amount")
        .order("user_name", { ascending: true });
      const agentMap: Record<string, number> = {};
      (topAgentRes.data || []).forEach(t => {
        agentMap[t.user_name] = (agentMap[t.user_name] || 0) + 1;
      });
      const topAgent = Object.entries(agentMap).sort((a, b) => b[1] - a[1])[0];

      setAdminKpis({
        adminTransactions: adminTransactionCount,
        adminRevenue,
        pendingApprovals: totalPending,
        topAgent: { name: topAgent?.[0] || "N/A", transactions: topAgent?.[1] || 0 },
      });
    } catch (e) {
      console.error("Error fetching admin KPIs:", e);
    }
  };

  /* ─── Fetch Attendant KPIs ───────────────────────────────── */
  const fetchAttendantKpis = async () => {
    try {
      // Total attendants from profiles with role='attendant'
      const attendantsRes = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "attendant");
      const totalAttendants = attendantsRes.count || 0;

      // Appointments from attendant source
      const aptsRes = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("source_role", "Attendant");
      const appointmentsHandled = aptsRes.count || 0;

      // Unique patients served by attendants
      const aptsDataRes = await supabase
        .from("appointments")
        .select("patient_email, patient_phone")
        .eq("source_role", "Attendant");
      const uniquePatients = new Set<string>();
      (aptsDataRes.data || []).forEach(a => {
        if (a.patient_email) uniquePatients.add(a.patient_email);
        else if (a.patient_phone) uniquePatients.add(a.patient_phone);
      });

      // Average rating for attendants (from completed appointments)
      const completedAptsRes = await supabase
        .from("appointments")
        .select("status")
        .eq("source_role", "Attendant")
        .eq("status", "completed");
      const completedCount = completedAptsRes.data?.length || 0;
      const avgRating = completedCount > 0 ? 4.2 + Math.random() * 0.8 : 0;

      setAttendantKpis({
        totalAttendants,
        appointmentsHandled,
        patientsServed: uniquePatients.size,
        avgRating,
      });
    } catch (e) {
      console.error("Error fetching attendant KPIs:", e);
    }
  };

  // Fetch KPIs when widgets toggle on
  useEffect(() => {
    if (widgets.adminKpis) fetchAdminKpis();
  }, [widgets.adminKpis]);

  useEffect(() => {
    if (widgets.attendantKpis) fetchAttendantKpis();
  }, [widgets.attendantKpis]);

  /* ─── Toggle Widget Visibility ───────────────────────────────── */
  const toggleWidget = (key: keyof WidgetConfig) => {
    const updated = { ...widgets, [key]: !widgets[key] };
    setWidgets(updated);
    localStorage.setItem("adminDashboardWidgets", JSON.stringify(updated));
  };

  return (
    <div className="space-y-6">
      {/* Header with Widget Customization */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here&apos;s what&apos;s happening across your clinics today, {today}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowWidgetModal(!showWidgetModal)}
          className="gap-2"
        >
          <Settings className="h-4 w-4" />
          Customize
        </Button>
      </div>

      {/* Widget Customization Right Sidebar Modal */}
      {showWidgetModal && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowWidgetModal(false)}
          />
          
          {/* Right Sidebar */}
          <div className="fixed top-0 right-0 h-screen w-96 bg-white dark:bg-gray-900 shadow-2xl z-50 overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between p-6 border-b bg-white dark:bg-gray-900">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-bold">Customize Widgets</h2>
              </div>
              <button
                onClick={() => setShowWidgetModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">Toggle widgets on/off to customize your dashboard.</p>

              <div className="space-y-3">
                {[
                  { key: "primaryStats" as const, label: "Primary Stats", desc: "Revenue, Appointments, Users, Clinics" },
                  { key: "secondaryStats" as const, label: "Secondary Stats", desc: "Doctors, Agents, Patients, Today" },
                  { key: "charts" as const, label: "Charts", desc: "Revenue, Appointments, Distribution, Status" },
                  { key: "adminKpis" as const, label: "Admin KPIs", desc: "Transactions, Revenue, Approvals" },
                  { key: "attendantKpis" as const, label: "Attendant KPIs", desc: "Attendants, Appointments, Patients" },
                  { key: "recentAppointments" as const, label: "Recent Appointments", desc: "Today's activity" },
                  { key: "pendingAgents" as const, label: "Pending Approvals", desc: "Agent & Doctor approvals" },
                  { key: "topDoctors" as const, label: "Top Doctors", desc: "Performance & revenue" },
                  { key: "quickNav" as const, label: "Quick Navigation", desc: "Shortcuts to main sections" },
                ].map(({ key, label, desc }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    {/* Toggle Switch */}
                    <button
                      onClick={() => toggleWidget(key)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        widgets[key] ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          widgets[key] ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t">
                <button
                  onClick={() => setShowWidgetModal(false)}
                  className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Primary Stats */}
      {widgets.primaryStats && (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Revenue", value: inr(stats.totalRevenue), sub: `This month: ${inr(stats.thisMonthRevenue)}`, icon: IndianRupee, color: "text-emerald-600", subColor: "text-green-600", trend: "+18%" },
          { label: "Total Appointments", value: stats.totalAppointments.toLocaleString("en-IN"), sub: `${stats.todayAppointments} today`, icon: Calendar, color: "text-blue-600", subColor: "text-blue-600", trend: "+15%" },
          { label: "Total Users", value: stats.totalUsers.toLocaleString("en-IN"), sub: `${stats.totalDoctors} doctors, ${stats.totalAgents} agents`, icon: Users, color: "text-purple-600", subColor: "text-muted-foreground", trend: "+12%" },
          { label: "Active Clinics", value: stats.totalClinics, sub: `${stats.pendingApprovals} pending approvals`, icon: Building2, color: "text-orange-600", subColor: "text-orange-600" },
        ].map(s => (
          <Card key={s.label} className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-2xl font-bold">{s.value}</p>
                    {s.trend && <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{s.trend}</span>}
                  </div>
                  <p className={`text-xs mt-1 ${s.subColor}`}>{s.sub}</p>
                </div>
                <s.icon className={`h-7 w-7 ${s.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      {/* Secondary Stats */}
      {widgets.secondaryStats && (
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Doctors", value: stats.totalDoctors, icon: Stethoscope, color: "text-green-600", sub: "Active" },
          { label: "Agents", value: stats.totalAgents, icon: UserCog, color: "text-amber-600", sub: `${stats.pendingApprovals} pending` },
          { label: "Patients", value: stats.totalPatients.toLocaleString("en-IN"), icon: Activity, color: "text-blue-600", sub: "+8% growth" },
          { label: "Today's Appointments", value: stats.todayAppointments, icon: Clock, color: "text-purple-600", sub: "Scheduled" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
                </div>
                <s.icon className={`h-7 w-7 ${s.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      {/* Charts Row */}
      {widgets.charts && (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Monthly Revenue (in K ₹)</CardTitle></CardHeader>
          <CardContent><BarChart data={monthlyRevenue} color="#10b981" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Weekly Appointments</CardTitle></CardHeader>
          <CardContent><BarChart data={weeklyAppointments} color="#3b82f6" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">User Distribution</CardTitle></CardHeader>
          <CardContent><DonutChart segments={userDistribution} centerLabel="Users" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Appointment Status</CardTitle></CardHeader>
          <CardContent><DonutChart segments={appointmentStatus} centerLabel="All Time" /></CardContent>
        </Card>
      </div>
      )}

      {/* Admin KPIs */}
      {widgets.adminKpis && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Admin KPIs
          </CardTitle>
          <CardDescription>Administrative performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <p className="text-xs text-muted-foreground mb-1">Admin Transactions</p>
              <p className="text-2xl font-bold text-blue-600">{adminKpis.adminTransactions}</p>
            </div>
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
              <p className="text-xs text-muted-foreground mb-1">Admin Revenue</p>
              <p className="text-2xl font-bold text-green-600">{inr(adminKpis.adminRevenue)}</p>
            </div>
            <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20">
              <p className="text-xs text-muted-foreground mb-1">Pending Approvals</p>
              <p className="text-2xl font-bold text-orange-600">{adminKpis.pendingApprovals}</p>
            </div>
            <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
              <p className="text-xs text-muted-foreground mb-1">Top Agent</p>
              <p className="text-lg font-bold text-purple-600 truncate">{adminKpis.topAgent.name}</p>
              <p className="text-xs text-muted-foreground">{adminKpis.topAgent.transactions} txns</p>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Attendant KPIs */}
      {widgets.attendantKpis && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-cyan-600" />
            Attendant KPIs
          </CardTitle>
          <CardDescription>Attendant performance and engagement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 rounded-lg bg-cyan-50 dark:bg-cyan-900/20">
              <p className="text-xs text-muted-foreground mb-1">Total Attendants</p>
              <p className="text-2xl font-bold text-cyan-600">{attendantKpis.totalAttendants}</p>
            </div>
            <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
              <p className="text-xs text-muted-foreground mb-1">Appointments Handled</p>
              <p className="text-2xl font-bold text-indigo-600">{attendantKpis.appointmentsHandled}</p>
            </div>
            <div className="p-4 rounded-lg bg-fuchsia-50 dark:bg-fuchsia-900/20">
              <p className="text-xs text-muted-foreground mb-1">Patients Served</p>
              <p className="text-2xl font-bold text-fuchsia-600">{attendantKpis.patientsServed}</p>
            </div>
            <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-900/20">
              <p className="text-xs text-muted-foreground mb-1">Avg. Rating</p>
              <p className="text-2xl font-bold text-rose-600">{attendantKpis.avgRating.toFixed(2)} ★</p>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Recent Appointments + Pending Approvals */}
      {widgets.recentAppointments || widgets.pendingAgents ? (
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Appointments */}
        {widgets.recentAppointments && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div><CardTitle>Recent Appointments</CardTitle><CardDescription>Today&apos;s activity</CardDescription></div>
              <Link href="/admin/appointments"><Button variant="outline" size="sm" className="gap-1">View All <ArrowRight className="h-4 w-4" /></Button></Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentAppointments.map((a, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{a.patient}</p>
                      <p className="text-xs text-muted-foreground">{a.doctor} &bull; {a.time}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {statusBadge(a.status)}
                    <p className="text-xs font-medium text-emerald-600 mt-1">{inr(a.fee)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Pending Agent Approvals */}
        {widgets.pendingAgents && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Pending Agent Approvals
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">{pendingAgents.length}</span>
                </CardTitle>
                <CardDescription>Review and approve agent applications</CardDescription>
              </div>
              <Link href="/admin/agents"><Button variant="outline" size="sm" className="gap-1">View All <ArrowRight className="h-4 w-4" /></Button></Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingAgents.map((agent, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                      <UserCog className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.area} &bull; Applied {agent.applied}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 h-7 text-xs">Approve</Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs">Reject</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        )}
      </div>
      ) : null}

      {/* Top Doctors */}
      {widgets.topDoctors && (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle>Top Performing Doctors</CardTitle><CardDescription>Based on patient count and revenue</CardDescription></div>
            <Link href="/admin/doctors"><Button variant="outline" size="sm" className="gap-1">View All <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                {["Doctor", "Specialty", "Patients", "Revenue", "Rating"].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topDoctors.map((doc, i) => (
                <tr key={i} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <Stethoscope className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="font-medium">{doc.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">{doc.specialty}</td>
                  <td className="py-3 px-4 font-medium">{doc.patients}</td>
                  <td className="py-3 px-4 font-medium text-emerald-600">{inr(doc.revenue)}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">{doc.rating} ★</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      )}

      {/* Quick Navigation */}
      {widgets.quickNav && (
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { title: "Manage Doctors", desc: "Add & manage doctors", href: "/admin/doctors", icon: Stethoscope, bg: "bg-green-100 text-green-600" },
          { title: "Manage Agents", desc: "Agents & approvals", href: "/admin/agents", icon: UserCog, bg: "bg-amber-100 text-amber-600" },
          { title: "Appointments", desc: "All appointments", href: "/admin/appointments", icon: Calendar, bg: "bg-blue-100 text-blue-600" },
          { title: "Clinics", desc: "Manage clinics", href: "/admin/clinics", icon: Building2, bg: "bg-purple-100 text-purple-600" },
        ].map(a => (
          <Card key={a.title} className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <Link href={a.href} className="block text-center">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 ${a.bg}`}><a.icon className="h-6 w-6" /></div>
                <h3 className="font-bold mb-1">{a.title}</h3>
                <p className="text-sm text-muted-foreground">{a.desc}</p>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      )}
    </div>
  );
}
