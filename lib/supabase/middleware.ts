import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/* Server-side, so SUPABASE_URL wins over the build-time-inlined public one.
   See the note in lib/supabase/server.ts. */
const serverUrl = () => process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serverKey = () => process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isConfigured() {
  const url = serverUrl();
  return Boolean(url && serverKey() && !url.includes("your-project"));
}

/** Refresh Supabase auth cookies on each request when configured. */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!isConfigured()) {
    return supabaseResponse;
  }

  const url = serverUrl()!;
  const key = serverKey()!;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Avoid writing cookies from Server Components; middleware owns refresh.
  await supabase.auth.getUser();
  return supabaseResponse;
}
