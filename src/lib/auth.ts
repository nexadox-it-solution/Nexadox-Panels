/**
 * auth.ts — Centralized authentication logic.
 *
 * - Direct Supabase auth (no API proxy)
 * - Client-side rate-limit protection
 * - Session persistence via localStorage
 * - Password validation
 */

const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 60_000; // 60 seconds
const STORAGE_KEY = "nexadox-login-attempts";

interface AttemptData {
  count: number;
  firstAttemptAt: number;
}

function getAttempts(): AttemptData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { count: 0, firstAttemptAt: 0 };
    return JSON.parse(raw);
  } catch {
    return { count: 0, firstAttemptAt: 0 };
  }
}

function saveAttempts(data: AttemptData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearLoginAttempts() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if login is currently blocked due to too many attempts.
 * Returns { blocked, remainingSeconds }.
 */
export function checkLoginBlocked(): { blocked: boolean; remainingSeconds: number } {
  const attempts = getAttempts();
  if (attempts.count < MAX_ATTEMPTS) {
    return { blocked: false, remainingSeconds: 0 };
  }
  const elapsed = Date.now() - attempts.firstAttemptAt;
  if (elapsed >= COOLDOWN_MS) {
    // Cooldown expired — reset
    clearLoginAttempts();
    return { blocked: false, remainingSeconds: 0 };
  }
  return {
    blocked: true,
    remainingSeconds: Math.ceil((COOLDOWN_MS - elapsed) / 1000),
  };
}

/**
 * Record a login attempt. Returns { blocked, remainingSeconds } if blocked.
 */
export function recordLoginAttempt(): { blocked: boolean; remainingSeconds: number } {
  const attempts = getAttempts();
  const now = Date.now();

  // If cooldown expired, reset
  if (attempts.count >= MAX_ATTEMPTS && now - attempts.firstAttemptAt >= COOLDOWN_MS) {
    saveAttempts({ count: 1, firstAttemptAt: now });
    return { blocked: false, remainingSeconds: 0 };
  }

  const newCount = attempts.count + 1;
  const firstAt = attempts.count === 0 ? now : attempts.firstAttemptAt;
  saveAttempts({ count: newCount, firstAttemptAt: firstAt });

  if (newCount >= MAX_ATTEMPTS) {
    const remaining = Math.ceil((COOLDOWN_MS - (now - firstAt)) / 1000);
    return { blocked: true, remainingSeconds: remaining > 0 ? remaining : COOLDOWN_MS / 1000 };
  }

  return { blocked: false, remainingSeconds: 0 };
}

/**
 * Validate password strength.
 */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include a number.";
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
    return "Password must include a special character.";
  return null;
}

/**
 * Set the Nexadox session in localStorage after successful login.
 */
export function setSession(userId: string, role: string) {
  localStorage.setItem("nexadox-session", `${userId}:${role}`);
  localStorage.setItem("nexadox-role", role);
}

/**
 * Get the current session from localStorage.
 */
export function getSession(): { userId: string; role: string } | null {
  const session = localStorage.getItem("nexadox-session");
  if (!session) return null;
  const [userId, role] = session.split(":");
  if (!userId || !role) return null;
  return { userId, role };
}

/**
 * Clear all auth data from localStorage.
 */
export function clearSession() {
  localStorage.removeItem("nexadox-session");
  localStorage.removeItem("nexadox-role");
  clearLoginAttempts();
  // Clear Supabase session backups
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("nexadox-sb-")) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

/**
 * Role → dashboard route mapping.
 */
export const ROLE_ROUTES: Record<string, string> = {
  admin:     "/admin",
  doctor:    "/doctor",
  agent:     "/agent",
  attendant: "/attendant",
  patient:   "/patient",
};
