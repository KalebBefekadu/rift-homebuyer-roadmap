import { NextResponse } from "next/server";
import { limited } from "@/lib/db/guard";
import { isPdf, MAX_PDF_BYTES } from "@/lib/core/offer-extract";
import { extractOffer } from "@/lib/ai/offer-extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/* Reading a few pages takes seconds, not minutes; this is the ceiling. */
export const maxDuration = 60;

/**
 * "Upload your offer in PDF" (Blueprint v5 §5.9). Takes the file, returns
 * candidate values with where each was found, and keeps nothing: the PDF is
 * not stored, and the candidates only fill boxes the sender then checks.
 *
 * Every refusal is a 200 with `manual: true` and a sentence, not an error: a
 * file that could not be read leaves the sender exactly where they were,
 * with the form in front of them (DOC-02, AT38).
 */
export async function POST(req: Request) {
  const refused = limited(req, "offer-extract");
  if (refused) return refused;

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return NextResponse.json({ ok: false, manual: true, say: "That upload did not arrive. Fill in the boxes from your PDF." });
  }
  if (!file) return NextResponse.json({ ok: false, manual: true, say: "Choose a PDF to upload." });
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ ok: false, manual: true, say: "That PDF is over 8 MB, too large to read automatically. Fill in the boxes from it." });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) return NextResponse.json({ ok: false, manual: true, say: "That file is not a PDF." });

  const r = await extractOffer(bytes);
  return NextResponse.json(r);
}
