"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * SessionGuard monitors the Supabase auth state.
 *
 * When the Supabase client detects a token refresh failure it calls
 * `_removeSession()` internally, which:
 *   1. Deletes all `sb-*-auth-token` cookies
 *   2. Fires the SIGNED_OUT event
 *
 * This component catches that event and redirects to /auth/login so the
 * user isn't left on a broken page that will 401 on every API call.
 *
 * It does NOT interfere with explicit logouts (which go through
 * /api/auth/logout).
 */
export default function SessionGuard() {
  const isExplicitLogout = useRef(false);

  useEffect(() => {
    // Mark explicit logouts so we don't double-redirect
    const handleBeforeUnload = () => {
      // navigation away from page – could be logout link
    };

    // Detect clicks on the logout link
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.("a");
      if (target?.getAttribute("href")?.includes("/auth/logout") ||
          target?.getAttribute("href")?.includes("/api/auth/logout")) {
        isExplicitLogout.current = true;
      }
    };
    document.addEventListener("click", handleClick, true);

    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_OUT" && !isExplicitLogout.current) {
          // Session was silently removed (token refresh failure).
          // Redirect to login.
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
