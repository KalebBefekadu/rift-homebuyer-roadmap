import { NextResponse } from "next/server";
import { buildReadout, buildTouch, buildResume } from "@/lib/db/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Renders the emails without sending them.
 *
 * Three templates existed and nobody had ever seen one. Email HTML is the least
 * forgiving markup there is and the hardest to check after the fact — by the
 * time a broken layout is noticed it has been read by everybody who was going
 * to read it.
 *
 * Refuses outright in production. Not because the content is secret, but
 * because an endpoint that renders arbitrary strings into HTML is a reflected
 * XSS waiting to be found, and no production user has any reason to reach it.
 *
 *   /api/dev/email-preview?type=readout
 *   /api/dev/email-preview?type=touch
 *   /api/dev/email-preview?type=resume&last=1
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "not available" }, { status: 404 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "readout";

  /* Deliberately awkward sample data: a name with an apostrophe and one with a
     script tag, so the escaping is visible rather than assumed. */
  const built =
    type === "touch"
      ? buildTouch({
          to: "maya@example.com",
          name: "Maya O'Brien",
          says: "The two programs you matched, and what each would need from you",
          body: "Two Georgia programs look like they fit your answers. Here is what each one would ask of you.",
          shareUrl: `${url.origin}/r/sample-token`,
          county: "DeKalb",
          figures: { cashToClose: 26187.5, gap: 17187.5 },
        })
      : type === "resume"
        ? buildResume({
            to: "sam@example.com",
            name: "<script>alert(1)</script>",
            says: "You were most of the way through — here is what you had so far",
            body: "Your answers are still here, exactly where you left them.",
            resumeUrl: `${url.origin}/buy/start`,
            answered: 3,
            of: 7,
            last: url.searchParams.get("last") === "1",
          })
        : buildReadout({
            to: "maya@example.com",
            name: "Maya O'Brien",
            shareUrl: `${url.origin}/r/sample-token`,
            cashToClose: 26187.5,
            gap: 17187.5,
            monthsToClose: 27,
            county: "DeKalb",
          });

  if (!built) {
    return NextResponse.json(
      { ok: false, error: "this template refuses to render without figures, which is the point" },
      { status: 422 },
    );
  }

  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>${built.subject}</title>
     <div style="background:#f4f4f2;padding:24px;font-family:sans-serif">
       <p style="max-width:520px;margin:0 auto 14px;font-size:12px;color:#666">
         <strong>Subject:</strong> ${built.subject}
       </p>
       <div style="max-width:520px;margin:0 auto;background:#fff;padding:24px;border-radius:8px">
         ${built.html}
       </div>
     </div>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}
