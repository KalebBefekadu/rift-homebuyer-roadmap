import { NextResponse } from "next/server";
import { limited } from "@/lib/db/guard";
import { checkFile } from "@/lib/core/document";
import { readOfferPdf } from "@/lib/db/offer-read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Offers are a few pages; this is generous and well under the model's limit. */
const MAX_OFFER_BYTES = 10 * 1024 * 1024;

/**
 * Reads an uploaded offer PDF into candidate values for the form (Blueprint
 * v5 §5.9). The same structural checks as any document Rift keeps
 * (lib/core/document.ts), then the automatic read, which may be off, over
 * its monthly limit, refused or failed: each says so, and the form works the
 * same (lib/db/offer-read.ts).
 */
export async function POST(req: Request) {
  const refused = limited(req, "offerRead");
  if (refused) return refused;

  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_OFFER_BYTES + 64 * 1024) {
    return NextResponse.json({ ok: false, error: "That file is over 10 MB. Fill in the boxes instead." }, { status: 413 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    file = null;
  }
  if (!file) return NextResponse.json({ ok: false, error: "No PDF arrived. Try choosing it again." }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_OFFER_BYTES) return NextResponse.json({ ok: false, error: "That file is over 10 MB. Fill in the boxes instead." }, { status: 413 });
  const check = checkFile(bytes, file.name || "offer.pdf", file.type || "application/pdf");
  if (!check.ok || check.kind !== "pdf") {
    return NextResponse.json({ ok: false, error: `That file could not be used: ${check.kind && check.kind !== "pdf" ? "it is not a PDF" : check.reasons.join("; ")}. Fill in the boxes instead.` }, { status: 400 });
  }

  const r = await readOfferPdf(bytes);
  return NextResponse.json({ ok: true, ...r });
}
