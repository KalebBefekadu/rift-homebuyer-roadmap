import { NextResponse } from "next/server";
import { limited } from "@/lib/db/guard";
import { checkFile } from "@/lib/core/document";
import { readOfferPdf } from "@/lib/db/offer-read";
import { keepOfferFile, saveUploadRead } from "@/lib/db/offer-upload";
import { readSender } from "@/lib/core/offer-upload";
import { MAX_OFFER_PDF_BYTES as MAX_OFFER_BYTES, MAX_OFFER_PDF_SAY } from "@/lib/core/offer-intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Takes an offer PDF (Blueprint v5 §5.9, manual review WS8.2 and WS8.3).
 *
 * Who is sending it comes first (lib/core/offer-upload.ts), then the same
 * structural checks as any document Rift keeps (lib/core/document.ts). The
 * file is then stored, which is the delivery: Kaleb has it from here, form
 * or no form. Only the first file on an upload is read automatically; an
 * addendum is kept beside it. The read may be off, over its monthly limit,
 * refused or failed: each says so, and the form works the same.
 */
export async function POST(req: Request) {
  const refused = limited(req, "offerRead");
  if (refused) return refused;

  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_OFFER_BYTES + 64 * 1024) {
    return NextResponse.json({ ok: false, error: MAX_OFFER_PDF_SAY }, { status: 413 });
  }

  let file: File | null = null;
  let fields: Record<string, unknown> = {};
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
    fields = { name: form.get("name"), phone: form.get("phone"), email: form.get("email"), upload: form.get("upload") };
  } catch {
    file = null;
  }
  const sender = readSender(fields);
  if (!sender.ok) return NextResponse.json({ ok: false, error: "Add your name and phone number first.", fields: sender.fields }, { status: 400 });
  if (!file) return NextResponse.json({ ok: false, error: "No PDF arrived. Try choosing it again." }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > MAX_OFFER_BYTES) return NextResponse.json({ ok: false, error: MAX_OFFER_PDF_SAY }, { status: 413 });
  const check = checkFile(bytes, file.name || "offer.pdf", file.type || "application/pdf");
  if (!check.ok || check.kind !== "pdf") {
    return NextResponse.json({ ok: false, error: `That file could not be used: ${check.kind && check.kind !== "pdf" ? "it is not a PDF" : check.reasons.join("; ")}. Fill in the boxes instead.` }, { status: 400 });
  }

  const kept = await keepOfferFile({
    token: typeof fields.upload === "string" ? fields.upload : null,
    sender: sender.value, fileName: file.name || "offer.pdf", bytes,
  });
  if (!kept.ok && /One offer can carry/.test(kept.error)) return NextResponse.json({ ok: false, error: kept.error }, { status: 400 });
  /* Not kept is said, not hidden: the sender then knows the form is the only
     way this reaches Kaleb, and the read can still fill it in. */
  const keptSay = !kept.ok || "skipped" in kept
    ? "We could not keep the PDF just now, so it has not reached Kaleb yet. Fill in the boxes and press Send, and the offer will."
    : null;
  const k = kept.ok && "data" in kept ? kept.data : null;

  if (k && !k.first) {
    return NextResponse.json({ ok: true, status: "kept", say: `Added. Kaleb has it with the rest of this offer (${k.files.length} PDFs).`, candidates: {}, upload: k.token, files: k.files, addendum: true });
  }
  const r = await readOfferPdf(bytes);
  if (k && r.status === "read") await saveUploadRead(k.uploadId, r.candidates);
  const delivered = k ? "Kaleb has your PDF. " : "";
  return NextResponse.json({ ok: true, ...r, say: keptSay ? `${keptSay} ${r.say}` : `${delivered}${r.say}`, upload: k?.token ?? null, files: k?.files ?? [], kept: Boolean(k) });
}
