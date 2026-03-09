"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  IndianRupee,
  Calendar,
  Award,
  Download,
  ArrowUpRight,
  Users,
  Stethoscope,
  Loader,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const inr = (v: number) => `₹${v.toLocaleString("en-IN")}`;

export default function EarningsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [loading, setLoading] = useState(true);

  const [earningsData, setEarningsData] = useState({
    totalEarnings: 0,
    thisMonth: 0,
    lastMonth: 0,
    growth: 0,
    avgPerBooking: 0,
    totalBookings: 0,
    commissionRate: 10,
  });

  const [monthlyEarnings, setMonthlyEarnings] = useState<{ month: string; earnings: number; bookings: number }[]>([]);
  const [topDoctors, setTopDoctors] = useState<{ name: string; specialty: string; bookings: number; earnings: number }[]>([]);
  const [weeklyBreakdown, setWeeklyBreakdown] = useState<{ week: string; earnings: number; bookings: number }[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        /* ── Identify agent ───────────────────────────── */
        const { data: { user } } = await supabase.auth.getUser();
        let agentUserId: number | null = null;
        let commissionRate = 10;
        let walletEarnings = 0;

        if (user) {
          // Look up agent by profile_id, then user_id
          const { data: agByProfile } = await supabase.from("agents").select("id, user_id, commission_value, wallet_earnings, total_bookings").eq("profile_id", user.id).single();
          if (agByProfile) {
            agentUserId = agByProfile.user_id;
            commissionRate = Number(agByProfile.commission_value) || 10;
            walletEarnings = Number(agByProfile.wallet_earnings) || 0;
          } else {
            const { data: agByUser } = await supabase.from("agents").select("id, user_id, commission_value, wallet_earnings, total_bookings").eq("user_id", user.id).single();
            if (agByUser) {
              agentUserId = agByUser.user_id;
              commissionRate = Number(agByUser.commission_value) || 10;
              walletEarnings = Number(agByUser.wallet_earnings) || 0;
            }
          }
        }

        /* ── Query agent's appointments ───────────────── */
        let q = supabase.from("appointments").select("id, appointment_date, doctor_id, booking_amount, commission_amount, status, created_at").eq("source_role", "Agent").order("appointment_date", { ascending: false });
        if (agentUserId) q = q.eq("created_by_agent_id", agentUserId);
        const { data: apts } = await q;
        const appointments = apts || [];

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

        const totalEarnings = appointments.reduce((s, a) => s + (Number(a.commission_amount) || 0), 0);
        const thisMonthApts = appointments.filter(a => a.appointment_date >= thisMonthStart);
        const lastMonthApts = appointments.filter(a => a.appointment_date >= lastMonthStart && a.appointment_date <= lastMonthEnd);

        const thisMonthEarnings = thisMonthApts.reduce((s, a) => s + (Number(a.commission_amount) || 0), 0);
        const lastMonthEarnings = lastMonthApts.reduce((s, a) => s + (Number(a.commission_amount) || 0), 0);
        const growth = lastMonthEarnings > 0 ? Math.round(((thisMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100) : 0;
        const avg = appointments.length > 0 ? Math.round(totalEarnings / appointments.length) : 0;

        setEarningsData({
          totalEarnings: walletEarnings || totalEarnings,
          thisMonth: thisMonthEarnings,
          lastMonth: lastMonthEarnings,
          growth,
          avgPerBooking: avg,
          totalBookings: appointments.length,
          commissionRate,
        });

        /* ── Monthly trend (last 7 months) ────────────── */
        const monthMap = new Map<string, { earnings: number; bookings: number }>();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
          monthMap.set(key, { earnings: 0, bookings: 0 });
        }
        appointments.forEach(a => {
          const d = new Date(a.appointment_date + "T00:00:00");
          const key = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
          if (monthMap.has(key)) {
            const v = monthMap.get(key)!;
            v.earnings += Number(a.commission_amount) || 0;
            v.bookings += 1;
          }
        });
        setMonthlyEarnings(Array.from(monthMap.entries()).map(([month, v]) => ({ month, ...v })));

        /* ── Top doctors ──────────────────────────────── */
        const docMap = new Map<number, { bookings: number; earnings: number }>();
        appointments.forEach(a => {
          if (!a.doctor_id) return;
          const v = docMap.get(a.doctor_id) || { bookings: 0, earnings: 0 };
          v.bookings += 1;
          v.earnings += Number(a.commission_amount) || 0;
          docMap.set(a.doctor_id, v);
        });
        const docIds = Array.from(docMap.keys());
        const { data: docRows } = await supabase.from("doctors").select("id, name, specialty_ids").in("id", docIds.length ? docIds : [0]);
        const { data: specRows } = await supabase.from("specialties").select("id, name");
        const specMap = new Map((specRows || []).map((s: any) => [s.id, s.name]));

        const topDocs = Array.from(docMap.entries())
          .sort((a, b) => b[1].earnings - a[1].earnings)
          .slice(0, 5)
          .map(([docId, v]) => {
            const doc = (docRows || []).find((d: any) => d.id === docId);
            const specs = (doc?.specialty_ids || []).map((id: number) => specMap.get(id) || "").filter(Boolean).join(", ");
            return { name: doc?.name || "Doctor", specialty: specs || "General", ...v };
          });
        setTopDoctors(topDocs);

        /* ── Weekly breakdown (current month) ─────────── */
        const weeks: { week: string; earnings: number; bookings: number }[] = [];
        for (let w = 0; w < 4; w++) {
          const wStart = new Date(now.getFullYear(), now.getMonth(), w * 7 + 1);
          const wEnd = new Date(now.getFullYear(), now.getMonth(), (w + 1) * 7);
          const wApts = thisMonthApts.filter(a => {
            const d = new Date(a.appointment_date + "T00:00:00");
            return d >= wStart && d <= wEnd;
          });
          weeks.push({
            week: `Week ${w + 1}`,
            earnings: wApts.reduce((s, a) => s + (Number(a.commission_amount) || 0), 0),
            bookings: wApts.length,
          });
        }
        setWeeklyBreakdown(weeks);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Earnings Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track your commission earnings and performance</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export Report
        </Button>
      </div>

      {/* Main Earnings Card */}
      <Card className="bg-gradient-to-br from-green-500 to-green-700 text-white border-0">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <IndianRupee className="h-6 w-6" />
            <span className="text-lg font-medium opacity-90">Total Commission Earned</span>
          </div>
          <div className="text-6xl font-bold mb-6">{inr(earningsData.totalEarnings)}</div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-sm opacity-90 mb-1">This Month</p>
              <p className="text-2xl font-semibold">{inr(earningsData.thisMonth)}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-sm opacity-90 mb-1">Avg per Booking</p>
              <p className="text-2xl font-semibold">{inr(earningsData.avgPerBooking)}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-sm opacity-90 mb-1">Growth Rate</p>
              <p className="text-2xl font-semibold flex items-center gap-1">
                <TrendingUp className="h-5 w-5" />
                {earningsData.growth}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-3xl font-bold mt-2">{inr(earningsData.thisMonth)}</p>
                {earningsData.growth !== 0 && (
                  <div className={`flex items-center gap-1 mt-2 ${earningsData.growth >= 0 ? "text-green-600" : "text-red-600"}`}>
                    <ArrowUpRight className="h-4 w-4" />
                    <span className="text-sm font-medium">{earningsData.growth > 0 ? "+" : ""}{earningsData.growth}%</span>
                  </div>
                )}
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Month</p>
                <p className="text-3xl font-bold mt-2">{inr(earningsData.lastMonth)}</p>
                <p className="text-sm text-muted-foreground mt-2">Previous period</p>
              </div>
              <Calendar className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Bookings</p>
                <p className="text-3xl font-bold mt-2">{earningsData.totalBookings}</p>
                <p className="text-sm text-muted-foreground mt-2">All time</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Commission Rate</p>
                <p className="text-3xl font-bold mt-2">{earningsData.commissionRate}%</p>
                <p className="text-sm text-muted-foreground mt-2">Current rate</p>
              </div>
              <Award className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Earnings Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Earnings Trend</CardTitle>
          <CardDescription>Monthly commission earnings over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {monthlyEarnings.map((item, index) => {
              const maxEarnings = Math.max(...monthlyEarnings.map((m) => m.earnings), 1);
              const barWidth = (item.earnings / maxEarnings) * 100;
              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.month}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">{item.bookings} bookings</span>
                      <span className="font-bold text-green-600">{inr(item.earnings)}</span>
                    </div>
                  </div>
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Performing Doctors */}
      {topDoctors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Doctors</CardTitle>
            <CardDescription>Doctors generating highest earnings for you</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topDoctors.map((doctor, index) => (
                <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-xl">
                    #{index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{doctor.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{doctor.specialty}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{doctor.bookings} bookings</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-600">{inr(doctor.earnings)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>This Month - Weekly Breakdown</CardTitle>
          <CardDescription>Week by week performance for current month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {weeklyBreakdown.map((week, index) => (
              <div key={index} className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">{week.week}</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-2">{inr(week.earnings)}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{week.bookings} bookings</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
