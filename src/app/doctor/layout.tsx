"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import SessionGuard from "@/components/SessionGuard";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Clock,
  User,
  Settings,
  Menu,
  X,
  Stethoscope,
  Bell,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = useAuthGuard("doctor");
  const supabase = createClient();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [doctorData, setDoctorData] = useState({
    name: "Doctor",
    email: "",
    specialty: "",
    avatar: null as string | null,
    currentQueueCount: 0,
    nextAppointment: "—",
  });

  /* ── Fetch real doctor data from Supabase ────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get doctor row by profile_id (new arch) or auth_user_id (backward compat)
        let doc = null;
        const { data: byProfile } = await supabase
          .from("doctors")
          .select("id, name, email, specialty_ids")
          .eq("profile_id", user.id)
          .single();

        if (byProfile) {
          doc = byProfile;
        } else {
          const { data: byAuth } = await supabase
            .from("doctors")
            .select("id, name, email, specialty_ids")
            .eq("auth_user_id", user.id)
            .single();
          doc = byAuth;
        }

        if (!doc) return;

        // Fetch specialty name
        let specialtyName = "";
        if (doc.specialty_ids && doc.specialty_ids.length > 0) {
          const { data: spec } = await supabase
            .from("specialties")
            .select("name")
            .eq("id", doc.specialty_ids[0])
            .single();
          if (spec) specialtyName = spec.name;
        }

        // Fetch today's queue count
        const today = new Date().toISOString().split("T")[0];
        const { count: queueCount } = await supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("doctor_id", doc.id)
          .eq("appointment_date", today)
          .eq("checkin_status", "checked_in");

        // Fetch next appointment time
        const { data: nextApt } = await supabase
          .from("appointments")
          .select("appointment_time, slot")
          .eq("doctor_id", doc.id)
          .eq("appointment_date", today)
          .in("status", ["scheduled", "waiting"])
          .order("created_at", { ascending: true })
          .limit(1);

        setDoctorData({
          name: doc.name || "Doctor",
          email: doc.email || "",
          specialty: specialtyName,
          avatar: null,
          currentQueueCount: queueCount || 0,
          nextAppointment: nextApt?.[0]?.appointment_time || nextApt?.[0]?.slot || "—",
        });
      } catch (e) {
        console.error("Error fetching doctor data:", e);
      }
    })();
  }, []);

  const navigation = [
    {
      name: "Dashboard",
      href: "/doctor",
      icon: LayoutDashboard,
      current: pathname === "/doctor",
    },
    {
      name: "Appointments",
      href: "/doctor/appointments",
      icon: Calendar,
      current: pathname === "/doctor/appointments",
    },
    {
      name: "Queue",
      href: "/doctor/queue",
      icon: Clock,
      current: pathname === "/doctor/queue",
      badge: doctorData.currentQueueCount,
    },
    {
      name: "Patients",
      href: "/doctor/patients",
      icon: Users,
      current: pathname === "/doctor/patients",
    },
    {
      name: "Settings",
      href: "/doctor/settings",
      icon: Settings,
      current: pathname === "/doctor/settings" || pathname === "/doctor/profile",
    },
  ];

  if (!authenticated) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SessionGuard />
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 transform transition-all duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 ${sidebarCollapsed ? "lg:w-20" : "lg:w-64"} w-64`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={`h-16 flex items-center border-b border-gray-200 dark:border-gray-700 ${
            sidebarCollapsed ? "justify-center px-2" : "justify-between px-6"
          }`}>
            <Link href="/doctor" className="flex items-center gap-2">
              <img src="/Nexadox.png" alt="Nexadox" className={sidebarCollapsed ? "h-7 w-7 object-contain" : "h-9 object-contain"} />
              {!sidebarCollapsed && (
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  Nexadox
                </span>
              )}
            </Link>
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Doctor Info */}
          {!sidebarCollapsed && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Stethoscope className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate">
                  {doctorData.name}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {doctorData.specialty}
                </p>
              </div>
            </div>
          </div>
          )}

          {/* Queue Status Widget */}
          {!sidebarCollapsed && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Current Queue
                </span>
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {doctorData.currentQueueCount} Patients
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Next: {doctorData.nextAppointment}
              </p>
            </div>
          </div>
          )}

          {/* Navigation */}
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
                  } ${sidebarCollapsed ? "justify-center" : ""}`}
                  title={sidebarCollapsed ? item.name : ""}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1">{item.name}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              className={`w-full gap-3 ${sidebarCollapsed ? "justify-center px-2" : "justify-start"}`}
              title={sidebarCollapsed ? "Logout" : ""}
              onClick={() => {
                window.location.href = "/api/auth/logout";
              }}
            >
              <LogOut className="h-5 w-5" />
              {!sidebarCollapsed && "Logout"}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${
        sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"
      }`}>
        {/* Top Bar */}
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <button
              className="hidden lg:block"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <button className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
            </button>

            {/* Doctor Info */}
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {doctorData.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {doctorData.specialty}
              </p>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
