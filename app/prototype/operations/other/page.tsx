import Link from "next/link";

const WHAT: Record<string, string> = {
  search: "Search stays as it is, restyled as a table, with a filter for searches that have an update waiting (§8.8).",
  offers: "Offers stays: inbound offers from /offer, now with the uploaded PDF and where the terms differ from it (§8.8, built).",
  calendar: "Calendar: real Cal.com bookings beside contract dates and showings, once Kaleb's Cal.com key is connected (§8.8).",
  advocacy: "Advocacy stays as it is today.",
  reports: "Reports: the pilot report, plus funnel and value-ladder figures (§8.8).",
  programs: "Programs stays as built: every assistance record, and the official pages that changed (§6.5).",
  campaigns: "Campaigns come after the pilot (§5.10).",
  questions: "Questions stays as it is today.",
  settings: "Settings stays, grouped by what each setting affects (§8.8).",
  add: "Add someone stays as it is today, opened from the one primary button in the sidebar.",
};

/** The parts of Operations this mock-up does not redesign, and what happens to each. */
export default async function Other({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page = "" } = await searchParams;
  return (
    <>
      <h1 className="ops-h1" style={{ textTransform: "capitalize" }}>{page || "Other pages"}</h1>
      <p className="card" style={{ padding: 12, marginTop: 12, maxWidth: 640 }}>{WHAT[page] ?? "Not part of this mock-up."}</p>
      <p style={{ marginTop: 10 }}><Link className="u" href="/prototype/operations">Back to Today</Link></p>
    </>
  );
}
