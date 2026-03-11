"use client";

import { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SessionGuard from "@/components/SessionGuard";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wallet,
  Calendar,
  FileText,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Activity,
  TrendingUp,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AgentLayoutProps {
  children: ReactNode;
}

const sidebarLinks = [
  { title: "Dashboard", href: "/agent", icon: LayoutDashboard },
  { title: "Profile", href: "/agent/profile", icon: User },
  { title: "Wallet", href: "/agent/wallet", icon: Wallet },
  { title: "Book Appointment", href: "/agent/booking", icon: Calendar },
  { title: "My Bookings", href: "/agent/bookings", icon: Clock },
  { title: "Reports", href: "/agent/reports", icon: FileText },
  { title: "Earnings", href: "/agent/earnings", icon: TrendingUp },
  { title: "Settings", href: "/agent/settings", icon: Settings },
];

const inr = (v: number) => `₹${v.toLocaleString("en-IN")}`;

export default function AgentLayout({ children }: AgentLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [agentData, setAgentData] = useState({
    name: "Agent User",
    email: "agent@example.com",
    walletBalance: 0,
    approvalStatus: "approved" as "approved" | "pending" | "rejected",
    commissionRate: 10,
  });

  useEffect(() => {
    (async () => {
      try {
        /* Use the server API to get wallet data (bypasses RLS) */
        const res = await fetch("/api/agent/wallet");
        if (!res.ok) return;
        const data = await res.json();
        setAgentData({
          name: data.profile?.name || "Agent User",
          email: data.profile?.email || "",
          walletBalance: data.agent?.wallet_balance || 0,
          approvalStatus: "approved",
          commissionRate: data.agent?.commission_value || 10,
        });
      } catch (e) { /* use defaults */ }
    })();
  }, []);

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
        className={cn(
          "fixed top-0 left-0 z-40 h-screen w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <img src="/Nexadox.png" alt="Nexadox" className="h-10 object-contain" />
          <span className="text-2xl font-bold text-primary">Nexadox</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Wallet Widget */}
        <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-4 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-5 w-5" />
              <span className="text-sm font-medium opacity-90">
                Wallet Balance
              </span>
            </div>
            <div className="text-3xl font-bold">
              {inr(agentData.walletBalance)}
            </div>
            {agentData.approvalStatus === "approved" && (
              <div className="mt-2 flex items-center gap-1 text-xs">
                <TrendingUp className="h-3 w-3" />
                <span>{agentData.commissionRate}% Commission</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-4 py-4 space-y-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
          {sidebarLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <link.icon className="h-5 w-5" />
                {link.title}
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
          <Link href="/api/auth/logout">
            <Button variant="ghost" className="w-full justify-start gap-3">
              <LogOut className="h-5 w-5" />
              Logout
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>

            {/* Approval Status Banner */}
            {agentData.approvalStatus === "pending" && (
              <div className="flex-1 mx-4">
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-lg text-sm">
                  <span className="font-medium">⏳ Pending Approval:</span> Your
                  profile is under review. You&apos;ll be notified once approved.
                </div>
              </div>
            )}

            {agentData.approvalStatus === "rejected" && (
              <div className="flex-1 mx-4">
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded-lg text-sm">
                  <span className="font-medium">❌ Application Rejected:</span>{" "}
                  Please contact support for more information.
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 ml-auto">
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium">{agentData.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {agentData.email}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
