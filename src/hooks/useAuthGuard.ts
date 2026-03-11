"use client";

import { useEffect, useState } from "react";

/**
 * Client-side auth guard that checks for the `nexadox-session` cookie.
 * Returns `true` once the cookie is confirmed present.
 * Redirects to /auth/login if the cookie is missing.
 *
 * If `requiredRole` is provided, also checks that the cookie role matches.
 */
export function useAuthGuard(requiredRole?: string): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const cookies = document.cookie.split(";").map((c) => c.trim());
    const session = cookies
      .find((c) => c.startsWith("nexadox-session="))
      ?.split("=")[1];

    if (!session) {
      window.location.replace(
        `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`
      );
      return;
    }

    if (requiredRole) {
      const role = session.split(":")[1];
      if (role !== requiredRole) {
        // Wrong role — send them to their own dashboard
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
