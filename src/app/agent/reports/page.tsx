"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Download,
  Calendar,
  TrendingUp,
  IndianRupee,
  Users,
  FileText,
  Loader,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const inr = (v: number) => `₹${v.toLocaleString("en-IN")}`;

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalBookings: 0,
    totalEarnings: 0,
    totalCommission: 0,
    avgCommission: 10,
    completedBookings: 0,
    cancelledBookings: 0,
    scheduledBookings: 0,
  });

  const [bookingsByDoctor, setBookingsByDoctor] = useState<{ doctor: string; bookings: number; earnings: number }[]>([]);
  const [bookingsByMonth, setBookingsByMonth] = useState<{ month: string; bookings: number; earnings: number }[]>([]);
  const [dailyBookings, setDailyBookings] = useState<{ date: string; bookings: number; earnings: number }[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        /* ── Identify agent ───────────────────────────── */
        const session = localStorage.getItem("nexadox-session") || "";
        const sessionUserId = session.split(":")[0] || null;
        const { data: { user } } = await supabase.auth.getUser();
        const userId = sessionUserId || user?.id;
        let agentUserId: number | null = null;
        let commRate = 10;

        if (userId) {
          // Look up agent by profile_id, then user_id
          const { data: agByProfile } = await supabase.from("agents").select("id, user_id, commission_value").eq("profile_id", userId).single();
          if (agByProfile) {
            agentUserId = agByProfile.user_id;
            commRate = Number(agByProfile.commission_value) || 10;
          } else {
            const { data: agByUser } = await supabase.from("agents").select("id, user_id, commission_value").eq("user_id", userId).single();
            if (agByUser) {
              agentUserId = agByUser.user_id;
              commRate = Number(agByUser.commission_value) || 10;
            }
          }
        }

        /* ── Query appointments ───────────────────────── */
        let q = supabase.from("appointments").select("id, appointment_date, doctor_id, booking_amount, commission_amount, status, created_at").eq("source_role", "Agent").order("appointment_date", { ascending: false });
        if (agentUserId) q = q.eq("created_by_agent_id", agentUserId);
        const { data: apts } = await q;
        const appointments = apts || [];

        const totalBookingValue = appointments.reduce((s, a) => s + (Number(a.booking_amount) || 0), 0);
        const totalCommission = appointments.reduce((s, a) => s + (Number(a.commission_amount) || 0), 0);
        const completed = appointments.filter(a => a.status === "completed").length;
        const cancelled = appointments.filter(a => a.status === "cancelled").length;
        const scheduled = appointments.filter(a => a.status === "scheduled").length;

        setStats({
          totalBookings: appointments.length,
          totalEarnings: totalCommission,
          totalCommission: totalBookingValue,
          avgCommission: commRate,
          completedBookings: completed,
          cancelledBookings: cancelled,
          scheduledBookings: scheduled,
        });

        /* ── Bookings by doctor ───────────────────────── */
        const docMap = new Map<number, { bookings: number; earnings: number }>();
        appointments.forEach(a => {
          if (!a.doctor_id) return;
          const v = docMap.get(a.doctor_id) || { bookings: 0, earnings: 0 };
          v.bookings += 1;
          v.earnings += Number(a.commission_amount) || 0;
          docMap.set(a.doctor_id, v);
        });
        const docIds = Array.from(docMap.keys());
        const { data: docRows } = await supabase.from("doctors").select("id, name").in("id", docIds.length ? docIds : [0]);
        const docNameMap = new Map((docRows || []).map((d: any) => [d.id, d.name]));

        setBookingsByDoctor(
          Array.from(docMap.entries())
            .sort((a, b) => b[1].bookings - a[1].bookings)
            .map(([id, v]) => ({ doctor: docNameMap.get(id) || "Doctor", ...v }))
        );

        /* ── Monthly performance ──────────────────────── */
        const monthMap = new Map<string, { bookings: number; earnings: number }>();
        appointments.forEach(a => {
          const d = new Date(a.appointment_date + "T00:00:00");
          const key = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
          const v = monthMap.get(key) || { bookings: 0, earnings: 0 };
          v.bookings += 1;
          v.earnings += Number(a.commission_amount) || 0;
          monthMap.set(key, v);
        });
        setBookingsByMonth(Array.from(monthMap.entries()).map(([month, v]) => ({ month, ...v })));

        /* ── Daily activity (last 7 days) ─────────────── */
        const daily: { date: string; bookings: number; earnings: number }[] = [];
        const now = new Date();
        for (let i = 0; i < 7; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split("T")[0];
          const dayApts = appointments.filter(a => a.appointment_date === dateStr);
          daily.push({
            date: dateStr,
            bookings: dayApts.length,
            earnings: dayApts.reduce((s, a) => s + (Number(a.commission_amount) || 0), 0),
          });
        }
        setDailyBookings(daily);
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
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Comprehensive booking and earnings reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
          <Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> PDF</Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Bookings</p>
                <p className="text-3xl font-bold mt-2">{stats.totalBookings}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <p className="text-3xl font-bold mt-2">{inr(stats.totalEarnings)}</p>
              </div>
              <IndianRupee className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Booking Value</p>
                <p className="text-3xl font-bold mt-2">{inr(stats.totalCommission)}</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.avgCommission}% commission rate</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-3xl font-bold mt-2">{stats.completedBookings}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.totalBookings > 0 ? Math.round((stats.completedBookings / stats.totalBookings) * 100) : 0}% success rate
                </p>
              </div>
              <Users className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bookings by Doctor */}
      {bookingsByDoctor.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bookings by Doctor</CardTitle>
            <CardDescription>Performance breakdown by each doctor</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bookingsByDoctor.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex-1">
                    <p className="font-semibold">{item.doctor}</p>
                    <p className="text-sm text-muted-foreground">{item.bookings} bookings</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{inr(item.earnings)}</p>
                    <p className="text-xs text-muted-foreground">commission earned</p>
                  </div>
                  <div className="ml-4">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${stats.totalBookings > 0 ? (item.bookings / stats.totalBookings) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Performance */}
      {bookingsByMonth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Performance</CardTitle>
            <CardDescription>Month-over-month comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bookingsByMonth.map((item, index) => (
                <div key={index} className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Month</p>
                    <p className="font-semibold mt-1">{item.month}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bookings</p>
                    <p className="font-semibold mt-1 text-blue-600">{item.bookings}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Earnings</p>
                    <p className="font-semibold mt-1 text-green-600">{inr(item.earnings)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Bookings */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Daily Activity</CardTitle>
          <CardDescription>Last 7 days booking activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Bookings</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Earnings</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Avg per Booking</th>
                </tr>
              </thead>
              <tbody>
                {dailyBookings.map((item, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="py-3 px-4">
                      {new Date(item.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}
                    </td>
                    <td className="py-3 px-4 text-center font-medium">{item.bookings}</td>
                    <td className="py-3 px-4 text-right font-semibold text-green-600">{inr(item.earnings)}</td>
                    <td className="py-3 px-4 text-right text-muted-foreground">
                      {item.bookings > 0 ? inr(Math.round(item.earnings / item.bookings)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-3">
                <FileText className="h-6 w-6" />
              </div>
              <p className="text-2xl font-bold">{stats.completedBookings}</p>
              <p className="text-sm text-muted-foreground mt-1">Completed Bookings</p>
              <p className="text-xs text-green-600 mt-2">
                {stats.totalBookings > 0 ? Math.round((stats.completedBookings / stats.totalBookings) * 100) : 0}% of total
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-3">
                <Calendar className="h-6 w-6" />
              </div>
              <p className="text-2xl font-bold">{stats.scheduledBookings}</p>
              <p className="text-sm text-muted-foreground mt-1">Scheduled Bookings</p>
              <p className="text-xs text-blue-600 mt-2">
                {stats.totalBookings > 0 ? Math.round((stats.scheduledBookings / stats.totalBookings) * 100) : 0}% of total
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mb-3">
                <Users className="h-6 w-6" />
              </div>
              <p className="text-2xl font-bold">{stats.cancelledBookings}</p>
              <p className="text-sm text-muted-foreground mt-1">Cancelled Bookings</p>
              <p className="text-xs text-red-600 mt-2">
                {stats.totalBookings > 0 ? Math.round((stats.cancelledBookings / stats.totalBookings) * 100) : 0}% of total
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
