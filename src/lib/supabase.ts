import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient;

/**
 * Custom cookie handlers that persist auth tokens to localStorage.
 *
 * Why: Supabase's GoTrueClient._removeSession() deletes all sb-* cookies
 * when a token refresh fails. This wipes the auth session and causes all
 * RLS-protected queries to return empty results.
 *
 * By shadowing every cookie write into localStorage and restoring from it,
 * we keep auth tokens alive even after _removeSession() runs.
 */
const STORAGE_PREFIX = "nexadox-sb-";

function persistedCookies() {
  return {
    getAll() {
      // First try real cookies
      const cookieStr = typeof document !== "undefined" ? document.cookie : "";
      const cookies: { name: string; value: string }[] = [];
      if (cookieStr) {
        cookieStr.split(";").forEach((c) => {
          const [name, ...rest] = c.trim().split("=");
          if (name) cookies.push({ name, value: rest.join("=") });
        });
      }

      // Check if auth cookies are present
      const hasAuth = cookies.some((c) => c.name.startsWith("sb-") && c.value.length > 10);

      // If auth cookies are gone, restore from localStorage
      if (!hasAuth && typeof localStorage !== "undefined") {
        const restored: { name: string; value: string }[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(STORAGE_PREFIX)) {
            const name = key.slice(STORAGE_PREFIX.length);
            const value = localStorage.getItem(key) || "";
            if (value.length > 10) {
              restored.push({ name, value });
              // Re-set the cookie so Supabase can use it normally
              if (typeof document !== "undefined") {
                document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
              }
            }
          }
        }
        if (restored.length > 0) return [...cookies, ...restored];
      }

      return cookies;
    },
    setAll(cookies: { name: string; value: string; options?: any }[]) {
      if (typeof document === "undefined") return;
      cookies.forEach(({ name, value, options }) => {
        const maxAge = options?.maxAge ?? 60 * 60 * 24 * 365;
        const path = options?.path ?? "/";
        const sameSite = options?.sameSite ?? "Lax";

        if (name.startsWith("sb-")) {
          if (maxAge <= 0 || !value) {
            // Supabase is trying to DELETE the cookie (_removeSession).
            // Set the cookie as requested (so Supabase's internal state is happy),
            // but do NOT delete our localStorage backup — that's the whole point.
            document.cookie = `${name}=; path=${path}; max-age=0; SameSite=${sameSite}`;
            return;
          }
          // Normal set — save to both cookie and localStorage
          document.cookie = `${name}=${value}; path=${path}; max-age=${maxAge}; SameSite=${sameSite}`;
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(STORAGE_PREFIX + name, value);
          }
        } else {
          // Non-sb cookie — just set it normally
          document.cookie = `${name}=${value}; path=${path}; max-age=${maxAge}; SameSite=${sameSite}`;
        }
      });
    },
  };
}

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
      { cookies: persistedCookies() }
    );
  }
  return _supabase;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    const value = (client as any)[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
