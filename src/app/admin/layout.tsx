"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SessionGuard from "@/components/SessionGuard";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  UserCog,
  BadgeDollarSign,
  Calendar,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  Activity,
  List,
  Receipt,
  FileText,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: ReactNode;
}

const sidebarLinks = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Listings",
    icon: List,
    subItems: [
      {
        title: "Locations",
        href: "/admin/locations",
      },
      {
        title: "Degrees",
        href: "/admin/degrees",
      },
      {
        title: "Specialties",
        href: "/admin/specialties",
      },
      {
        title: "Clinics",
        href: "/admin/clinics",
      },
    ],
  },
  {
    title: "All Users",
    icon: Users,
    subItems: [
      {
        title: "Admins",
        href: "/admin/admins",
      },
      {
        title: "Patients",
        href: "/admin/users",
      },
      {
        title: "Doctors",
        href: "/admin/doctors",
      },
      {
        title: "Agents",
        href: "/admin/agents",
      },
      {
        title: "Attendants",
        href: "/admin/attendants",
      },
    ],
  },
  {
    title: "Appointments",
    href: "/admin/appointments",
    icon: Calendar,
  },
  {
    title: "Patients",
    href: "/admin/patients",
    icon: Activity,
  },
  {
    title: "Invoices",
    href: "/admin/invoices",
    icon: BadgeDollarSign,
  },
  {
    title: "Transactions",
    icon: Receipt,
    subItems: [
      {
        title: "Admin Transactions",
        href: "/admin/admin-transactions",
      },
      {
        title: "Patient Transactions",
        href: "/admin/patient-transactions",
      },
      {
        title: "Agent Transactions",
        href: "/admin/agent-transactions",
      },
      {
        title: "Attendant Transactions",
        href: "/admin/attendant-transactions",
      },
    ],
  },
  {
    title: "Reports",
    href: "/admin/reports",
    icon: FileText,
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Auto-expand menus based on current page
  const isOnTransactionPage = pathname.includes("/transactions");
  const isOnListingsPage = pathname.includes("/locations") || 
                           pathname.includes("/degrees") || 
                           pathname.includes("/specialties") || 
                           pathname.includes("/clinics");
  const isOnUsersPage = pathname.includes("/users") || 
                        pathname.includes("/doctors") || 
                        pathname.includes("/agents") || 
                        pathname.includes("/attendants") ||
                        pathname.includes("/admins");
  
  const initialExpandedMenus: string[] = [];
  if (isOnTransactionPage) initialExpandedMenus.push("Transactions");
  if (isOnListingsPage) initialExpandedMenus.push("Listings");
  if (isOnUsersPage) initialExpandedMenus.push("All Users");
  
  const [expandedMenus, setExpandedMenus] = useState<string[]>(initialExpandedMenus);

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
          "fixed top-0 left-0 z-40 h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300",
          sidebarCollapsed ? "w-20" : "w-64",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center gap-2 py-5 border-b border-gray-200 dark:border-gray-700",
          sidebarCollapsed ? "px-4 justify-center" : "px-6"
        )}>
          <img src="/Nexadox.png" alt="Nexadox" className={sidebarCollapsed ? "h-8 w-8 object-contain" : "h-10 object-contain"} />
          {!sidebarCollapsed && (
            <span className="text-2xl font-bold text-primary">Nexadox</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="px-4 py-6 space-y-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 180px)" }}>
          {sidebarLinks.map((link) => {
            // Check if this item or any sub-item is active
            const isActive = link.href ? pathname === link.href : false;
            const hasActiveSubItem = link.subItems?.some(sub => pathname === sub.href);
            const isExpanded = expandedMenus.includes(link.title);

            // Parent menu without href (expandable)
            if (link.subItems) {
              return (
                <div key={link.title}>
                  <button
                    className={cn(
                      "w-full flex items-center gap-3 py-3 rounded-lg text-sm font-medium transition-colors",
                      sidebarCollapsed ? "px-2 justify-center" : "px-4",
                      hasActiveSubItem
                        ? "bg-primary/10 text-primary"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    )}
                    onClick={() => {
                      if (sidebarCollapsed) return;
                      setExpandedMenus(prev =>
                        prev.includes(link.title)
                          ? prev.filter(item => item !== link.title)
                          : [...prev, link.title]
                      );
                    }}
                    title={sidebarCollapsed ? link.title : ""}
                  >
                    <link.icon className="h-5 w-5" />
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1 text-left">{link.title}</span>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </>
                    )}
                  </button>
                  {/* Sub-items */}
                  {!sidebarCollapsed && isExpanded && (
                    <div className="ml-4 mt-2 mb-2 space-y-1">
                      {link.subItems.map((subItem) => {
                        const isSubActive = pathname === subItem.href;
                        return (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            className={cn(
                              "flex items-center gap-3 py-2 px-4 rounded-lg text-sm font-medium transition-colors",
                              isSubActive
                                ? "bg-primary text-white"
                                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                            )}
                            onClick={() => setSidebarOpen(false)}
                          >
                            {subItem.title}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Regular menu item with href
            return (
              <Link
                key={link.href}
                href={link.href!}
                className={cn(
                  "flex items-center gap-3 py-3 rounded-lg text-sm font-medium transition-colors",
                  sidebarCollapsed ? "px-2 justify-center" : "px-4",
                  isActive
                    ? "bg-primary text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
                onClick={() => setSidebarOpen(false)}
                title={sidebarCollapsed ? link.title : ""}
              >
                <link.icon className="h-5 w-5" />
                {!sidebarCollapsed && link.title}
              </Link>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
          <Link href="/api/auth/logout">
            <Button variant="ghost" className={cn(
              "w-full gap-3",
              sidebarCollapsed ? "justify-center px-2" : "justify-start"
            )}
            title={sidebarCollapsed ? "Logout" : ""}>
              <LogOut className="h-5 w-5" />
              {!sidebarCollapsed && "Logout"}
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
      )}>
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:flex"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex items-center gap-4 ml-auto">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
              </Button>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium">Admin</p>
                  <p className="text-xs text-muted-foreground">Administrator</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
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
