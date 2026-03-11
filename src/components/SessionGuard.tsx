"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * SessionGuard monitors the Supabase auth state.
 *
 * When the Supabase client detects a token refresh failure it calls
 * `_removeSession()` internally, which deletes all `sb-*-auth-token`
 * cookies and fires the SIGNED_OUT event.
 *
 * This component catches that event and:
 *   1. Calls /api/auth/logout to clear our nexadox-session cookie (HttpOnly)
 *   2. Redirects to /auth/login
 *
 * It does NOT interfere with explicit logouts (which go through
 * /api/auth/logout directly).
 */
export default function SessionGuard() {
  const isExplicitLogout = useRef(false);

  useEffect(() => {
    // Detect clicks on the logout link
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.("a, button");
      const href = target?.getAttribute("href") || "";
      if (href.includes("/auth/logout") || href.includes("/api/auth/logout")) {
        isExplicitLogout.current = true;
      }
    };
    document.addEventListener("click", handleClick, true);

    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === "SIGNED_OUT" && !isExplicitLogout.current) {
          // Session was silently removed (token refresh failure).
          // Clear our HttpOnly session cookie via server and redirect.
          try {
            await fetch("/api/auth/logout", { method: "POST" });
          } catch {
            // Best effort
          }
          window.location.replace("/auth/login");
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return null;
}
