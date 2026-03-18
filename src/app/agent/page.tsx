"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wallet, Calendar, TrendingUp, Clock,
  Users, ArrowUpRight, IndianRupee, Loader,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { resolveAgent } from "@/lib/resolveRole";

/* ─── Mini Bar Chart (pure SVG) ────────────────────────── */
function BarChart({ data, color = "#0D8EAD" }: { data: { label: string; value: number }[]; color?: string }) {
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
  if (total === 0) return <p className="text-sm text-muted-foreground text-center py-6">No data yet</p>;
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

const statusBadgeClass: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  scheduled: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
  waiting: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-purple-100 text-purple-700",
};

export default function AgentDashboard() {
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    walletBalance: 0, totalBookings: 0, totalEarnings: 0,
    thisMonthBookings: 0, thisMonthEarnings: 0,
    pendingBookings: 0, completedBookings: 0, commissionRate: 30,
  });

  const [monthlyEarningsK, setMonthlyEarningsK] = useState<{ label: string; value: number }[]>([]);
  const [weeklyBookings, setWeeklyBookings] = useState<{ label: string; value: number }[]>([]);
  const [bookingStatus, setBookingStatus] = useState<{ label: string; value: number; color: string }[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [doctorMap, setDoctorMap] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        /* ── Identify agent ────────────────────────────── */
        const { data: { user } } = await supabase.auth.getUser();
        let agentUserId: number | null = null;
        let walletBalance = 0, walletEarnings = 0, totalBk = 0, commRate = 30;

        if (user) {
          /* Fetch from server-side API (uses service role key — reliable) */
          const session = localStorage.getItem("nexadox-session") || "";
          const uid = session.split(":")[0] || user.id;
          try {
            const res = await fetch(`/api/agent/wallet?userId=${uid}`);
            if (res.ok) {
              const data = await res.json();
              walletBalance = Number(data.agent?.wallet_balance) || 0;
              walletEarnings = Number(data.agent?.wallet_earnings) || 0;
              totalBk = Number(data.agent?.total_bookings) || 0;
              const commNum = Number(data.agent?.commission_value);
              commRate = !isNaN(commNum) && commNum > 0 ? commNum : 30;
            }
          } catch {}

          /* Still need agentUserId for appointments query */
          const ag = await resolveAgent(user.id);
          if (ag) {
            agentUserId = ag.user_id || ag.id;
          }
        }

        /* ── Query appointments ────────────────────────── */
        let q = supabase.from("appointments").select("id, appointment_id, patient_name, patient_phone, doctor_id, appointment_date, slot, booking_amount, commission_amount, status, created_at").eq("source_role", "Agent").order("created_at", { ascending: false });
        if (agentUserId) q = q.eq("created_by_agent_id", agentUserId);
        const { data: apts } = await q;
        const appointments = apts || [];

        /* ── Doctors map ───────────────────────────────── */
        const { data: docRows } = await supabase.from("doctors").select("id, name");
        const dMap = new Map((docRows || []).map((d: any) => [d.id, d.name]));
        setDoctorMap(dMap);

        /* ── Compute stats ─────────────────────────────── */
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

        const thisMonthApts = appointments.filter(a => a.appointment_date >= thisMonthStart);
        const totalEarnings = appointments.reduce((s, a) => s + (Number(a.commission_amount) || 0), 0);
        const thisMonthEarnings = thisMonthApts.reduce((s, a) => s + (Number(a.commission_amount) || 0), 0);
        const completedCount = appointments.filter(a => a.status === "completed").length;
        const pendingCount = appointments.filter(a => a.status === "scheduled").length;

        setStats({
          walletBalance,
          totalBookings: appointments.length || totalBk,
          totalEarnings: walletEarnings || totalEarnings,
          thisMonthBookings: thisMonthApts.length,
          thisMonthEarnings,
          pendingBookings: pendingCount,
          completedBookings: completedCount,
          commissionRate: commRate,
        });

        /* ── Monthly earnings (last 6 months) ──────────── */
        const monthMap = new Map<string, number>();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthMap.set(d.toLocaleDateString("en-US", { month: "short" }), 0);
        }
        appointments.forEach(a => {
          const d = new Date(a.appointment_date + "T00:00:00");
          const key = d.toLocaleDateString("en-US", { month: "short" });
          if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) || 0) + (Number(a.commission_amount) || 0));
        });
        setMonthlyEarningsK(Array.from(monthMap.entries()).map(([label, v]) => ({ label, value: Math.round(v / 1000) })));

        /* ── Weekly bookings (this week) ───────────────── */
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const weekData: { label: string; value: number }[] = dayNames.map(d => ({ label: d, value: 0 }));
        const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
        appointments.forEach(a => {
          const d = new Date(a.appointment_date + "T00:00:00");
          if (d >= weekStart && d <= now) weekData[d.getDay()].value++;
        });
        setWeeklyBookings(weekData);

        /* ── Booking status donut ──────────────────────── */
        setBookingStatus([
          { label: "Completed", value: completedCount, color: "#0D8EAD" },
          { label: "Scheduled", value: pendingCount, color: "#3b82f6" },
          { label: "Cancelled", value: appointments.filter(a => a.status === "cancelled").length, color: "#ef4444" },
        ]);

        /* ── Recent bookings (5) ───────────────────────── */
        setRecentBookings(appointments.slice(0, 5));

      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader className="h-8 w-8 animate-spin text-orange-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Agent Dashboard 👋</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here&apos;s your bookings &amp; earnings overview for {today}</p>
        </div>
        <Link href="/agent/booking">
          <Button size="lg" className="gap-2"><Calendar className="h-5 w-5" />Book Appointment</Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Wallet Balance", value: inr(stats.walletBalance), sub: "Available balance", icon: Wallet, color: "text-emerald-600", subColor: "text-muted-foreground", link: "/agent/wallet", linkText: "Manage Wallet" },
          { label: "Total Bookings", value: stats.totalBookings, sub: `${stats.thisMonthBookings} this month`, icon: Calendar, color: "text-blue-600", subColor: "text-green-600", link: "/agent/bookings", linkText: "View All" },
          { label: "Total Earnings", value: inr(stats.totalEarnings), sub: `${inr(stats.thisMonthEarnings)} this month`, icon: IndianRupee, color: "text-emerald-600", subColor: "text-green-600", link: "/agent/earnings", linkText: "View Report" },
          { label: "Commission Rate", value: `${stats.commissionRate}%`, sub: "On each booking", icon: TrendingUp, color: "text-purple-600", subColor: "text-muted-foreground" },
        ].map(s => (
          <Card key={s.label} className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-2">{s.value}</p>
                  <p className={`text-xs mt-1 ${s.subColor}`}>{s.sub}</p>
                  {s.link && (
                    <Link href={s.link}><Button variant="link" size="sm" className="mt-1 p-0 h-auto text-xs">{s.linkText} <ArrowUpRight className="h-3 w-3 ml-1" /></Button></Link>
                  )}
                </div>
                <s.icon className={`h-7 w-7 ${s.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { label: "Pending Bookings", value: stats.pendingBookings, icon: Clock, color: "text-orange-600" },
          { label: "This Month", value: stats.thisMonthBookings, icon: Calendar, color: "text-blue-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </div>
                <s.icon className={`h-8 w-8 ${s.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Monthly Earnings (in K ₹)</CardTitle></CardHeader>
          <CardContent><BarChart data={monthlyEarningsK} color="#0D8EAD" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Weekly Bookings</CardTitle></CardHeader>
          <CardContent><BarChart data={weeklyBookings} color="#3b82f6" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Booking Status</CardTitle></CardHeader>
          <CardContent><DonutChart segments={bookingStatus} centerLabel="Bookings" /></CardContent>
        </Card>
      </div>

      {/* Recent Bookings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle>Recent Bookings</CardTitle><CardDescription>Your latest appointment bookings</CardDescription></div>
          <Link href="/agent/bookings"><Button variant="outline" size="sm">View All</Button></Link>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {recentBookings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No bookings yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  {["Patient", "Doctor", "Date & Slot", "Amount", "Commission", "Status"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b: any) => (
                  <tr key={b.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{b.patient_name}</span></div>
                    </td>
                    <td className="py-3 px-4">{doctorMap.get(b.doctor_id) || "—"}</td>
                    <td className="py-3 px-4">
                      <div>{b.appointment_date ? new Date(b.appointment_date + "T00:00:00").toLocaleDateString("en-IN") : "—"}</div>
                      <div className="text-xs text-muted-foreground">{b.slot || "—"}</div>
                    </td>
                    <td className="py-3 px-4 font-medium">{inr(Number(b.booking_amount) || 0)}</td>
                    <td className="py-3 px-4 font-medium text-green-600">{inr(Number(b.commission_amount) || 0)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass[b.status] || ""}`}>
                        {b.status?.charAt(0).toUpperCase() + b.status?.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-blue-600" />Book Appointment</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Create a new appointment booking for your clients with automatic commission calculation.</p>
            <Link href="/agent/booking"><Button className="w-full">Start Booking</Button></Link>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-emerald-600" />Top Up Wallet</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Add funds to your wallet to continue booking appointments seamlessly.</p>
            <Link href="/agent/wallet"><Button variant="outline" className="w-full">Add Funds</Button></Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
