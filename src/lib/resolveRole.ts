/**
 * resolveRole.ts
 * Shared helpers to resolve auth UUID → profile and role-specific records.
 * Uses profiles as SINGLE SOURCE OF TRUTH — no fallback to users table.
 */
import { supabase } from "@/lib/supabase";

/**
 * Get the profile for an authenticated user.
 * profiles table is the single source of truth.
 */
export async function getProfile(authUserId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, name, email, phone, status, created_at")
    .eq("id", authUserId)
    .single();

  if (error || !profile) return null;
  return profile;
}

/** @deprecated Use getProfile() instead */
export async function getProfileOrUser(authUserId: string) {
  return getProfile(authUserId);
}

/**
 * Resolve auth UUID → agent record.
 * Uses profile_id as the primary lookup key.
 */
export async function resolveAgent(authUserId: string) {
  // Primary: lookup by profile_id
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("profile_id", authUserId)
    .single();

  if (!error && data) return data;

  // Fallback: try user_id = UUID (some records may store auth UUID directly)
  const { data: byUserId } = await supabase
    .from("agents")
    .select("*")
    .eq("user_id", authUserId)
    .single();

  return byUserId || null;
}

/**
 * Resolve auth UUID → attendant record.
 * Uses profile_id as the primary lookup key.
 */
export async function resolveAttendant(authUserId: string) {
  // Primary: lookup by profile_id
  const { data, error } = await supabase
    .from("attendants")
    .select("*")
    .eq("profile_id", authUserId)
    .single();

  if (!error && data) return data;

  // Fallback: try user_id = UUID
  const { data: byUserId } = await supabase
    .from("attendants")
    .select("*")
    .eq("user_id", authUserId)
    .single();

  return byUserId || null;
}

/**
 * Resolve auth UUID → doctor record.
 * Uses profile_id as the primary lookup key, falls back to auth_user_id.
 */
export async function resolveDoctor(authUserId: string) {
  // Primary: lookup by profile_id
  const { data, error } = await supabase
    .from("doctors")
    .select("*")
    .eq("profile_id", authUserId)
    .single();

  if (!error && data) return data;

  // Fallback: auth_user_id (doctors table has this column)
  const { data: byAuthId } = await supabase
    .from("doctors")
    .select("*")
    .eq("auth_user_id", authUserId)
    .single();

  return byAuthId || null;
}
