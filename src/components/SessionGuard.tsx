"use client";

/**
 * SessionGuard — intentionally a no-op.
 *
 * Previously this component listened for Supabase's SIGNED_OUT event
 * and cleared our nexadox-session cookie.  That behaviour was
 * COUNTER-PRODUCTIVE: Supabase fires SIGNED_OUT whenever its own
 * token refresh fails (6 different code-paths in _removeSession()),
 * and our SessionGuard then deleted the independent nexadox-session
 * cookie — the very cookie designed to survive that failure.
 *
 * With the current architecture:
 *   - Middleware relies ONLY on the nexadox-session cookie.
 *   - That cookie is set via /api/auth/set-session at login.
 *   - It is deleted ONLY by /api/auth/logout (explicit user action).
 *   - Supabase's internal session state is irrelevant to navigation.
 *
 * Keeping this component as a no-op (instead of removing it) avoids
 * having to touch the four layout files that import it.
 */
export default function SessionGuard() {
  return null;
}
