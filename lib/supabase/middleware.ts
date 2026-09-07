import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { withTimeout } from "@/lib/core/timeout";

/**
 * Shorter than a page read, because this is on the path of every matched
 * request rather than of one page, and because there is nothing to wait for:
 * the fallback is simply not refreshing, which costs nothing a user can see.
 */
const AUTH_REFRESH_DEADLINE_MS = 1_000;

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

  /* Avoid writing cookies from Server Components; middleware owns refresh.
     
     On a deadline, and failures are swallowed on purpose. This runs on every
     matched request, so a slow or unreachable auth server would hang all of
     them — and the only thing lost by skipping it is a token refresh, which
     the next request retries. A page that needs a session checks for itself;
     middleware refreshing one is an optimisation, and an optimisation must
     never be able to take the site down. */
  const { timedOut } = await withTimeout(
    supabase.auth.getUser().then(() => true).catch(() => true),
    AUTH_REFRESH_DEADLINE_MS,
    true,
  );

  if (timedOut) {
    supabaseResponse.headers.set("x-rift-auth-refresh", "skipped");
  }

  return supabaseResponse;
}
