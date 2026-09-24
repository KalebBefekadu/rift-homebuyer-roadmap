"use client";

/** Print, or save as a PDF from the print dialog. */
export function PrintButton() {
  return <button type="button" className="btn btn-s btn-sm" onClick={() => window.print()}>Print or save as PDF</button>;
}
