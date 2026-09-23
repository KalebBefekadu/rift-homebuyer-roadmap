import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Signs the buyer out and sends them to the sign-in page. A form post, so it works without scripts. */
export async function POST(req: Request) {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/app/sign-in?out=1", req.url), { status: 303 });
}
