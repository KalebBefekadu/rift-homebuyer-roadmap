import { createBrowserClient } from "@supabase/ssr";

function isLocalAuthMode(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MODE === "local";
}

export function createClient() {
  if (isLocalAuthMode()) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes("your-project")) {
    return null;
  }
  return createBrowserClient(url, key);
}

export function isSupabaseConfigured(): boolean {
  if (isLocalAuthMode()) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes("your-project"));
}
