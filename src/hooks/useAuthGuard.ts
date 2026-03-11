"use client";

import { useEffect, useState } from "react";

/**
 * Client-side auth guard using localStorage.
 * localStorage is 100% browser-side — no server, no edge, no CDN can touch it.
 * Survives page refresh, browser restart (non-incognito), and Supabase token wipes.
 */
export function useAuthGuard(requiredRole?: string): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem("nexadox-session");

    if (!session) {
      window.location.replace(
        `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`
      );
      return;
    }

    if (requiredRole) {
      const role = session.split(":")[1];
      if (role !== requiredRole) {
        const roleRoutes: Record<string, string> = {
          admin: "/admin",
          doctor: "/doctor",
          agent: "/agent",
          attendant: "/attendant",
        };
        window.location.replace(roleRoutes[role] || "/auth/login");
        return;
      }
    }

    setReady(true);
  }, [requiredRole]);

  return ready;
}
