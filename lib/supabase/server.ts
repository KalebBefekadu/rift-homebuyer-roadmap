import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  /* SUPABASE_URL first. NEXT_PUBLIC_ variables are inlined at build time, so a
     server reading one is pinned to whatever project the bundle was compiled
     against: the runtime environment cannot move it. The same bug was fixed
     in lib/db/service.ts; it was here too, in the auth path, where the symptom
     is worse: sign-in silently checked against the wrong project. */
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes("your-project")) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      /* Server components cannot set headers; the middleware's refresh is the
         response that carries the no-store headers (lib/supabase/middleware.ts). */
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component: ignore if middleware will refresh session.
        }
      },
    },
  });
}
