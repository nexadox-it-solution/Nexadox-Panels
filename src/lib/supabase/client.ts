import { createBrowserClient } from "@supabase/ssr";

const STORAGE_PREFIX = "nexadox-sb-";

function persistedCookies() {
  return {
    getAll() {
      const cookieStr = typeof document !== "undefined" ? document.cookie : "";
      const cookies: { name: string; value: string }[] = [];
      if (cookieStr) {
        cookieStr.split(";").forEach((c) => {
          const [name, ...rest] = c.trim().split("=");
          if (name) cookies.push({ name, value: rest.join("=") });
        });
      }
      const hasAuth = cookies.some((c) => c.name.startsWith("sb-") && c.value.length > 10);
      if (!hasAuth && typeof localStorage !== "undefined") {
        const restored: { name: string; value: string }[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(STORAGE_PREFIX)) {
            const name = key.slice(STORAGE_PREFIX.length);
            const value = localStorage.getItem(key) || "";
            if (value.length > 10) {
              restored.push({ name, value });
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
            // Supabase is trying to DELETE (_removeSession).
            // Delete the cookie but keep localStorage backup intact.
            document.cookie = `${name}=; path=${path}; max-age=0; SameSite=${sameSite}`;
            return;
          }
          // Normal set — save to both cookie and localStorage
          document.cookie = `${name}=${value}; path=${path}; max-age=${maxAge}; SameSite=${sameSite}`;
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(STORAGE_PREFIX + name, value);
          }
        } else {
          document.cookie = `${name}=${value}; path=${path}; max-age=${maxAge}; SameSite=${sameSite}`;
        }
      });
    },
  };
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
    { cookies: persistedCookies() }
  );
}
