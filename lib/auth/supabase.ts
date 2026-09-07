import { createClient } from "@/lib/supabase/client";
import { portalPathForRole, type AuthUser, type UserRole } from "@/lib/auth/local";

function parseRole(value: unknown): UserRole | null {
  return value === "admin" || value === "client" ? value : null;
}

async function resolveRole(
  supabase: NonNullable<ReturnType<typeof createClient>>,
  user: { id: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> },
): Promise<UserRole> {
  const fromApp = parseRole(user.app_metadata?.role);
  if (fromApp) return fromApp;

  const { data } = await supabase
    .from("agents_settings")
    .select("agent_id")
    .eq("agent_id", user.id)
    .maybeSingle();
  if (data) return "admin";

  return parseRole(user.user_metadata?.role) ?? "client";
}

function toAuthUser(
  user: {
    id: string;
    email?: string | null;
    created_at: string;
    user_metadata?: Record<string, unknown>;
  },
  role: UserRole,
): AuthUser {
  const metaName = user.user_metadata?.name;
  const name =
    typeof metaName === "string" && metaName.trim()
      ? metaName.trim()
      : (user.email?.split("@")[0] ?? "User");
  return {
    id: user.id,
    email: user.email ?? "",
    name,
    role,
    createdAt: user.created_at,
  };
}

export async function getSession(): Promise<AuthUser | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const role = await resolveRole(supabase, user);
  return toAuthUser(user, role);
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<{ user: AuthUser } | { error: string }> {
  const supabase = createClient();
  if (!supabase) return { error: "Supabase is not configured." };

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!name || !email || !input.password) return { error: "Name, email, and password are required." };
  if (input.password.length < 6) return { error: "Password must be at least 6 characters." };

  const emailRedirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(portalPathForRole(input.role))}`
      : undefined;

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: { name, role: input.role },
      emailRedirectTo,
    },
  });

  if (error) return { error: error.message };
  if (!data.user) return { error: "Sign up failed." };

  if (!data.session) {
    return {
      error: "Account created. Confirm your email, then log in.",
    };
  }

  if (input.role === "admin") {
    const { error: settingsError } = await supabase.from("agents_settings").upsert({
      agent_id: data.user.id,
      display_name: name,
      email,
      updated_at: new Date().toISOString(),
    });
    if (settingsError) {
      return { error: `Account created but agent settings failed: ${settingsError.message}` };
    }
  } else {
    await supabase.rpc("claim_my_client_records");
  }

  return { user: toAuthUser(data.user, input.role) };
}

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<{ user: AuthUser } | { error: string }> {
  const supabase = createClient();
  if (!supabase) return { error: "Supabase is not configured." };

  const email = input.email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error) return { error: error.message };
  if (!data.user) return { error: "Sign in failed." };

  const role = await resolveRole(supabase, data.user);
  if (role === "client") {
    await supabase.rpc("claim_my_client_records");
  }
  return { user: toAuthUser(data.user, role) };
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}
