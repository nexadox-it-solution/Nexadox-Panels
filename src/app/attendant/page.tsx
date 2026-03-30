"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  UserCheck, Clock, TrendingUp,
  ArrowRight, Stethoscope, Loader,
} from "lucide-react";
import Link from "next/link";

/* ─── Types ─────────────────────────────────────────────────── */
interface DashboardData {
  todayCheckIns: number;
  currentQueue: number;
  completedToday: number;
  avgWaitTime: number;
  recentCheckIns: {
    token: number;
    patient: string;
    doctor: string;
    time: string;
    status: string;
  }[];
  queueOverview: {
    token: number;
    patient: string;
    status: string;
    waitTime: string;
  }[];
}

const statusBadge = (s: string) => {
  if (s === "in_progress" || s === "in_consultation") return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">In Progress</span>;
  if (s === "waiting") return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Waiting</span>;
  if (s === "completed") return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Completed</span>;
  return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{s}</span>;
};

export default function AttendantDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    todayCheckIns: 0, currentQueue: 0, completedToday: 0, avgWaitTime: 0,
    recentCheckIns: [], queueOverview: [],
  });

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/attendant/dashboard");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const iv = setInterval(fetchDashboard, 30000);
    return () => clearInterval(iv);
  }, [fetchDashboard]);

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader className="h-10 w-10 animate-spin text-brand-600" />
        <p className="ml-3 text-muted-foreground text-lg">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold">Attendant Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview for today, {today}</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Today's Check-ins", value: data.todayCheckIns, sub: `${data.completedToday} completed`, icon: UserCheck, color: "text-green-600", subColor: "text-green-600" },
          { label: "Current Queue", value: data.currentQueue, sub: "Patients waiting", icon: Clock, color: "text-orange-600", subColor: "text-muted-foreground" },
          { label: "Completed", value: data.completedToday, sub: "Today", icon: Stethoscope, color: "text-blue-600", subColor: "text-muted-foreground" },
          { label: "Avg Wait Time", value: data.avgWaitTime > 0 ? `${data.avgWaitTime}m` : "0m", sub: "Per patient", icon: TrendingUp, color: "text-purple-600", subColor: "text-muted-foreground" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-3xl font-bold mt-2">{s.value}</p>
                  <p className={`text-xs mt-1 ${s.subColor}`}>{s.sub}</p>
                </div>
                <s.icon className={`h-8 w-8 ${s.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { title: "Check-In Patient", desc: "Register patient arrival, record vitals & issue token", href: "/attendant/checkin", icon: UserCheck, bg: "bg-brand-600 text-white" },
          { title: "View Queue", desc: "Monitor real-time patient queue status", href: "/attendant/queue", icon: Clock, bg: "bg-orange-100 text-orange-600" },
        ].map(a => (
          <Card key={a.title} className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <Link href={a.href} className="block text-center">
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full mb-4 ${a.bg}`}><a.icon className="h-7 w-7" /></div>
                <h3 className="font-bold text-lg mb-1">{a.title}</h3>
                <p className="text-sm text-muted-foreground">{a.desc}</p>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Queue Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle>Current Queue</CardTitle><CardDescription>Real-time queue status</CardDescription></div>
            <Link href="/attendant/queue"><Button variant="outline" size="sm" className="gap-2">View All <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </CardHeader>
        <CardContent>
          {data.queueOverview.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground">No patients in queue right now</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.queueOverview.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-600 text-white font-bold text-sm">#{item.token}</div>
                    <div>
                      <p className="font-medium">{item.patient}</p>
                      <p className="text-sm text-muted-foreground">Wait: {item.waitTime}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${item.status === "In Progress" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>{item.status}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Check-ins */}
      <Card>
        <CardHeader><CardTitle>Recent Check-ins</CardTitle><CardDescription>Latest patient registrations</CardDescription></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {data.recentCheckIns.length === 0 ? (
            <div className="text-center py-8 px-4">
              <p className="text-muted-foreground">No check-ins yet today</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  {["Token", "Patient", "Doctor", "Time", "Status"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentCheckIns.map((c, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-brand-600">#{c.token}</td>
                    <td className="py-3 px-4 font-medium">{c.patient}</td>
                    <td className="py-3 px-4">{c.doctor}</td>
                    <td className="py-3 px-4">{c.time}</td>
                    <td className="py-3 px-4">{statusBadge(c.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
