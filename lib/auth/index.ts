import { isSupabaseConfigured } from "@/lib/supabase/client";
import * as local from "@/lib/auth/local";
import * as supabaseAuth from "@/lib/auth/supabase";

export type { AuthUser, UserRole } from "@/lib/auth/local";
export { portalPathForRole } from "@/lib/auth/local";

/** Prefer Supabase Auth when keys are set; otherwise localStorage auth. */
export async function getSession() {
  if (isSupabaseConfigured()) return supabaseAuth.getSession();
  return local.getSession();
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
  role: local.UserRole;
}) {
  if (isSupabaseConfigured()) return supabaseAuth.signUp(input);
  return local.signUp(input);
}

export async function signIn(input: { email: string; password: string }) {
  if (isSupabaseConfigured()) return supabaseAuth.signIn(input);
  return local.signIn(input);
}

export async function signOut() {
  if (isSupabaseConfigured()) return supabaseAuth.signOut();
  local.signOut();
}
