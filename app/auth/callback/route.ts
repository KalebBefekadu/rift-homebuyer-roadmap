import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNext(path: string | null): string {
  if (path && path.startsWith("/") && !path.startsWith("//")) return path;
  return "/login";
}

/** Exchange Supabase auth code for a session cookie (email confirm / OAuth). */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        // Best-effort: attach any intake rows that match this email.
        await supabase.rpc("claim_my_client_records");
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
