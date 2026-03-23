"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import SessionGuard from "@/components/SessionGuard";
import {
  LayoutDashboard,
  UserCheck,
  Clock,
  User,
  Users,
  Menu,
  X,
  ClipboardList,
  Bell,
  LogOut,
  Calendar,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export default function AttendantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = useAuthGuard("attendant");
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({ currentQueueCount: 0, todayCheckIns: 0, todayAppointments: 0 });

  /* Fetch real sidebar stats — scoped to attendant's assigned doctors */
  useEffect(() => {
    let iv: ReturnType<typeof setInterval>;
    const init = async () => {
      // Get attendant's assigned doctor IDs
      let doctorIdsParam = "";
      try {
        const session = localStorage.getItem("nexadox-session");
        const userId = session?.split(":")[0];
        if (userId) {
          const { data: attRow } = await supabase
            .from("attendants")
            .select("assigned_doctors")
            .or(`profile_id.eq.${userId},user_id.eq.${userId}`)
            .limit(1)
            .single();
          if (attRow?.assigned_doctors?.length) {
            doctorIdsParam = `?doctor_ids=${attRow.assigned_doctors.join(",")}`;
          }
        }
      } catch (_) { /* fallback: no filter */ }

      const fetchStats = async () => {
        try {
          const res = await fetch(`/api/attendant/stats${doctorIdsParam}`);
          if (res.ok) {
            const data = await res.json();
            setStats(data);
          }
        } catch (e) { console.error("Stats fetch error:", e); }
      };
      fetchStats();
      iv = setInterval(fetchStats, 30000);
    };
    init();
    return () => { if (iv) clearInterval(iv); };
  }, []);

  const navigation = [
    {
      name: "Dashboard",
      href: "/attendant",
      icon: LayoutDashboard,
      current: pathname === "/attendant",
    },
    {
      name: "Check-In",
      href: "/attendant/checkin",
      icon: UserCheck,
      current: pathname === "/attendant/checkin",
    },
    {
      name: "Appointments",
      href: "/attendant/appointments",
      icon: Calendar,
      current: pathname === "/attendant/appointments",
    },
    {
      name: "Doctor Schedule",
      href: "/attendant/schedule",
      icon: CalendarClock,
      current: pathname === "/attendant/schedule",
    },
    {
      name: "Queue Display",
      href: "/attendant/queue",
      icon: Clock,
      current: pathname === "/attendant/queue",
      badge: stats.currentQueueCount,
    },
    {
      name: "Patients",
      href: "/attendant/patients",
      icon: Users,
      current: pathname === "/attendant/patients",
    },
    {
      name: "Profile",
      href: "/attendant/profile",
      icon: User,
      current: pathname?.startsWith("/attendant/profile"),
    },
  ];

  if (!authenticated) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SessionGuard />
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
            <Link href="/attendant" className="flex items-center gap-2">
              <img src="/Nexadox.png" alt="Nexadox" className="h-9 object-contain" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                Nexadox
              </span>
            </Link>
            <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate">
                  Attendant
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  Clinic Staff
                </p>
              </div>
            </div>
          </div>

          {/* Stats Widget — REAL DATA from /api/attendant/stats */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Queue Status
                  </span>
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {stats.currentQueueCount}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Patients waiting
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-green-900 dark:text-green-100">
                    Today&apos;s Check-ins
                  </span>
                  <UserCheck className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {stats.todayCheckIns}
                  <span className="text-sm font-normal text-green-600 dark:text-green-400 ml-1">
                    / {stats.todayAppointments}
                  </span>
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Checked in / Total booked
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    item.current
                      ? "bg-primary text-white"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="flex-1">{item.name}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => {
                window.location.href = "/api/auth/logout";
              }}
            >
              <LogOut className="h-5 w-5" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 lg:flex-none" />
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
              <Bell className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
