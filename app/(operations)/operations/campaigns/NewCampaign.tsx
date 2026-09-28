"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { newCampaign } from "./actions";

/** A new campaign starts as the assistance recipe for one county (CAMP-02), then is composed. */
export function NewCampaign({ counties }: { counties: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const auto = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

  return (
    <form className="desk-form" onSubmit={(e) => {
      e.preventDefault();
      const county = String(new FormData(e.currentTarget).get("county") ?? "");
      start(async () => {
        const r = await newCampaign({ name, slug, county, requestId: crypto.randomUUID() });
        if (!r.ok) { setError(r.error); return; }
        router.push(`/operations/campaigns/${r.id}`);
      });
    }}>
      <label style={{ flex: "2 1 220px" }}>Name<input className="input input-sm" required minLength={3} maxLength={120} value={name}
        onChange={(e) => { setName(e.target.value); if (!touched) setSlug(auto(e.target.value)); }} placeholder="Fulton first-time buyers, October" /></label>
      <label style={{ flex: "1 1 180px" }}>Address: /c/…<input className="input input-sm" required pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]" value={slug}
        onChange={(e) => { setTouched(true); setSlug(e.target.value.toLowerCase()); }} /></label>
      <label>Starts with programs for
        <select className="select input-sm" name="county" defaultValue={counties[0]}>{counties.map((c) => <option key={c} value={c}>{c} County</option>)}</select></label>
      <button className="btn btn-p btn-sm" disabled={pending}>{pending ? "Creating…" : "Create"}</button>
      {error ? <span role="alert" className="t-xs c-neg" style={{ flexBasis: "100%" }}>{error}</span> : null}
    </form>
  );
}
