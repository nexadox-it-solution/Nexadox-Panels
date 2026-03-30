"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar, Users, Clock, TrendingUp,
  AlertCircle, CheckCircle, ArrowRight,
  IndianRupee, Stethoscope, Loader,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { todayIST } from "@/lib/utils";

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
  if (total === 0) return <p className="text-sm text-muted-foreground text-center py-4">No data</p>;
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

const statusBadge = (s: string) => {
  if (s === "in_progress") return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Clock className="h-3 w-3" />In Progress</span>;
  if (s === "waiting") return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><AlertCircle className="h-3 w-3" />Waiting</span>;
  if (s === "scheduled" || s === "confirmed") return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"><Calendar className="h-3 w-3" />{s === "confirmed" ? "Confirmed" : "Scheduled"}</span>;
  if (s === "completed") return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="h-3 w-3" />Completed</span>;
  return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{s}</span>;
};

interface Apt {
  id: number;
  token_number: number | null;
  patient_name: string;
  appointment_date: string;
  slot: string | null;
  status: string;
  consultation_type: string | null;
  booking_amount: number | null;
  checkin_status: string | null;
  checkin_time: string | null;
}

export default function DoctorDashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [doctorName, setDoctorName] = useState("");
  const [todayAppts, setTodayAppts] = useState<Apt[]>([]);
  const [allAppts, setAllAppts] = useState<Apt[]>([]);
  const [queueItems, setQueueItems] = useState<Apt[]>([]);

  const todayStr = todayIST();
  const todayLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        // Try profile_id first (new architecture), then fall back to auth_user_id
        let doc: { id: number; name: string } | null = null;
        const { data: byProfile } = await supabase
          .from("doctors").select("id, name").eq("profile_id", user.id).single();
        if (byProfile) {
          doc = byProfile;
        } else {
          const { data: byAuth } = await supabase
            .from("doctors").select("id, name").eq("auth_user_id", user.id).single();
          doc = byAuth;
        }
        if (!doc) return;
        setDoctorName(doc.name || "Doctor");

        // All appointments for stats
        const { data: all } = await supabase
          .from("appointments")
          .select("id, token_number, patient_name, appointment_date, slot, status, consultation_type, booking_amount, checkin_status, checkin_time")
          .eq("doctor_id", doc.id)
          .order("appointment_date", { ascending: false });

        const allData = (all || []) as Apt[];
        setAllAppts(allData);

        // Today's appointments
        const todayData = allData.filter(a => a.appointment_date === todayStr);
        setTodayAppts(todayData);

        // Queue (checked-in today)
        setQueueItems(todayData.filter(a => a.checkin_status === "checked_in"));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [todayStr]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader className="h-8 w-8 animate-spin text-brand-600" /></div>;
  }

  // Stats
  const completedToday = todayAppts.filter(a => a.status === "completed").length;
  const inQueue = queueItems.length;
  const todayEarnings = todayAppts.filter(a => a.status === "completed").reduce((s, a) => s + Number(a.booking_amount || 0), 0);
  const totalPatients = new Set(allAppts.map(a => `${a.patient_name?.toLowerCase()}`)).size;

  // Get last 30 days data for monthly earnings
  const last30 = allAppts.filter(a => {
    const d = new Date(a.appointment_date);
    const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 30 && a.status === "completed";
  });
  const monthEarnings = last30.reduce((s, a) => s + Number(a.booking_amount || 0), 0);

  // Weekly chart: last 7 days
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyData: { label: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    weeklyData.push({ label: dayNames[d.getDay()], value: allAppts.filter(a => a.appointment_date === ds).length });
  }

  // Appointment types donut
  const typeMap = new Map<string, number>();
  todayAppts.forEach(a => {
    const t = a.consultation_type || "General";
    typeMap.set(t, (typeMap.get(t) || 0) + 1);
  });
  const typeColors = ["#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#f59e0b", "#ec4899"];
  const appointmentTypes = Array.from(typeMap.entries()).map(([label, value], i) => ({
    label, value, color: typeColors[i % typeColors.length],
  }));

  // Queue display
  const waitMins = (t: string | null) => {
    if (!t) return 0;
    return Math.max(0, Math.round((Date.now() - new Date(t).getTime()) / 60000));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome, {doctorName}!</h1>
        <p className="text-muted-foreground mt-1">Here&apos;s your schedule for today, {todayLabel}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Today's Appointments", value: todayAppts.length, sub: `${completedToday} completed`, icon: Calendar, color: "text-blue-600", subColor: "text-green-600" },
          { label: "In Queue", value: inQueue, sub: "Patients waiting", icon: Clock, color: "text-orange-600", subColor: "text-muted-foreground" },
          { label: "Total Patients", value: totalPatients.toLocaleString("en-IN"), sub: "Lifetime", icon: Users, color: "text-green-600", subColor: "text-muted-foreground" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-2">{s.value}</p>
                  <p className={`text-xs mt-1 ${s.subColor}`}>{s.sub}</p>
                </div>
                <s.icon className={`h-7 w-7 ${s.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Last 7 Days Appointments</CardTitle></CardHeader>
          <CardContent><BarChart data={weeklyData} color="#3b82f6" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Today&apos;s Appointment Types</CardTitle></CardHeader>
          <CardContent><DonutChart segments={appointmentTypes} centerLabel="Today" /></CardContent>
        </Card>
      </div>

      {/* Current Queue */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div><CardTitle>Current Queue</CardTitle><CardDescription>Patients checked-in and waiting</CardDescription></div>
            <Link href="/doctor/queue"><Button variant="outline" size="sm" className="gap-2">View All <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </CardHeader>
        <CardContent>
          {queueItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No patients in queue right now</p>
          ) : (
            <div className="space-y-3">
              {queueItems.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm">#{p.token_number || "?"}</div>
                    <div>
                      <p className="font-medium">{p.patient_name}</p>
                      <p className="text-sm text-muted-foreground">Wait: {waitMins(p.checkin_time)}m</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Waiting</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Schedule Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle>Today&apos;s Schedule</CardTitle><CardDescription>All appointments for today</CardDescription></div>
            <Link href="/doctor/appointments"><Button variant="outline" size="sm" className="gap-2">View All <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {todayAppts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No appointments scheduled for today</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  {["Token", "Patient", "Slot", "Type", "Amount", "Status"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todayAppts.map(a => (
                  <tr key={a.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-blue-600">#{a.token_number || "—"}</td>
                    <td className="py-3 px-4 font-medium">{a.patient_name}</td>
                    <td className="py-3 px-4">{a.slot || "—"}</td>
                    <td className="py-3 px-4">{a.consultation_type || "—"}</td>
                    <td className="py-3 px-4 font-medium">{inr(Number(a.booking_amount || 0))}</td>
                    <td className="py-3 px-4">{statusBadge(a.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Manage Queue", desc: "View and manage waiting patients", href: "/doctor/queue", icon: Clock, bg: "bg-blue-100 text-blue-600" },
          { title: "Patient Records", desc: "Access patient health records", href: "/doctor/patients", icon: Users, bg: "bg-green-100 text-green-600" },
          { title: "Settings", desc: "Manage your profile & preferences", href: "/doctor/settings", icon: Stethoscope, bg: "bg-purple-100 text-purple-600" },
        ].map(a => (
          <Card key={a.title} className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <Link href={a.href} className="block text-center">
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full mb-3 ${a.bg}`}><a.icon className="h-7 w-7" /></div>
                <h3 className="font-bold text-lg mb-1">{a.title}</h3>
                <p className="text-sm text-muted-foreground">{a.desc}</p>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
