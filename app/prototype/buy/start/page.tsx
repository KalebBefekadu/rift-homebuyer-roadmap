"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AskShell, Leave, Q, Nav, LiveCard, Carried, Field } from "@/components/rift/Ask";
import { GA_COUNTIES, matchPrograms } from "@/lib/prototype/registry";
import { useFunnel } from "@/lib/prototype/funnelStore";
import { track, useTrack } from "@/lib/prototype/telemetry";
import { readAttribution } from "@/lib/prototype/attribution";
import { firstTimeFrom, OWNERSHIP_CAVEAT, type Ownership } from "@/lib/prototype/funnel";
import { BUYER_DEFAULTS, cashGap, cashToClose, money, monthlyComputed, range, type BuyerInputs } from "@/lib/prototype/compute";

type A = Record<string, unknown>;

function BuyStart() {
  const router = useRouter();
  const sp = useSearchParams();
  const { funnel } = useFunnel("buy");

  /* Anything they already told us on the landing page is not asked again.
     Re-asking is the fastest way to make a system feel like it isn't listening. */
  const preCounty = sp.get("c");
  const preOwn = sp.get("o") as Ownership | null;

  const QS = useMemo(
    () => funnel.questions.filter((q) =>
      q.enabled && !(q.id === "county" && preCounty) && !(q.id === "ownership" && preOwn)),
    [funnel, preCounty, preOwn],
  );

  const [n, setN] = useState(0);
  const [left, setLeft] = useState(false);
  const [touched, setTouched] = useState<string[]>([]);
  const [a, setA] = useState<A>({
    price: 0, savings: 0, monthlySaving: 0, timing: "", who: "",
    county: preCounty || BUYER_DEFAULTS.county,
    ownership: (preOwn || "none") as Ownership,
  });
  const set = (k: string, v: unknown) => setA((p) => ({ ...p, [k]: v }));

  const q = QS[Math.min(n, QS.length - 1)];
  const key = q?.bound || q?.id || "";
  const answered = touched.includes(key) || (a[key] !== "" && a[key] !== 0 && a[key] !== undefined);
  const ok = !q?.required || answered;
  const last = n === QS.length - 1;

  /* Instrumentation. Question ids and timings only — never the answer. */
  const src = useRef<string | undefined>(undefined);
  useEffect(() => { src.current = readAttribution()?.first.source; }, []);
  useTrack({ name: "assessment_start", side: "buy", fv: funnel.version, meta: { prefilled: QS.length !== funnel.questions.length } });
  const seen = useRef<Date | number>(Date.now());
  useEffect(() => {
    if (!q) return;
    seen.current = Date.now();
    track({ name: "question_view", side: "buy", qid: q.id, step: n + 1, fv: funnel.version, src: src.current });
  }, [q, n, funnel.version]);
  const dwell = () => Date.now() - Number(seen.current);


  const ownership = (a.ownership as Ownership) || "none";
  const county = String(a.county || BUYER_DEFAULTS.county);
  const m = useMemo(
    () => matchPrograms({ county, firstTimeBuyer: firstTimeFrom(ownership) }),
    [county, ownership],
  );

  const inp: BuyerInputs = useMemo(() => ({
    ...BUYER_DEFAULTS, county,
    price: Number(a.price) || 0, savings: Number(a.savings) || 0,
    monthlySaving: Number(a.monthlySaving) || 0,
    /* Zero on purpose — see buyerReadout. Assistance is upside, not a balance. */
    assistance: 0,
  }), [a, county]);

  const cash = useMemo(() => cashToClose(inp), [inp]);
  const gap = useMemo(() => cashGap(inp), [inp]);
  const mo = useMemo(() => monthlyComputed(inp), [inp]);

  const go = (i: number) => { setTouched((t) => (t.includes(key) ? t : [...t, key])); setN(i); };
  const next = () => {
    track({ name: "question_answer", side: "buy", qid: q?.id, step: n + 1, dwell: dwell(), fv: funnel.version, src: src.current });
    setTouched((t) => (t.includes(key) ? t : [...t, key]));
    if (!last) return setN(n + 1);
    const p = new URLSearchParams({
      c: county, o: ownership, f: firstTimeFrom(ownership) ? "1" : "0",
      p: String(a.price ?? 0), s: String(a.savings ?? 0), r: String(a.monthlySaving ?? 0),
      t: String(a.timing ?? ""), w: String(a.who || "none"),
    });
    router.push(`/prototype/buy/results?${p}`);
  };

  if (left) return (
    <Leave v="buy" n={n} onBack={() => setLeft(false)}
      extra={m.matched.length ? (
        <div className="tint p-3" style={{ marginTop: 16 }}>
          <div className="t-xs c-4">Already found for you</div>
          <div className="num" style={{ fontSize: 20, color: "var(--brand-2)", marginTop: 3 }}>{range(m.usableMin, m.usableMax)}</div>
          <div className="t-xs c-4">in {county} County assistance</div>
        </div>
      ) : undefined} />
  );
  if (!q) return null;

  const extra =
    q.id === "price" ? (
      <button className="btn btn-g btn-sm" style={{ paddingLeft: 0, marginTop: 6 }}
        onClick={() => { set("price", 325_000); setTouched((t) => [...t, "price"]); }}>
        I don&apos;t know — use a typical starter price
      </button>
    ) : q.id === "who" ? (
      <button className="btn btn-g btn-sm" style={{ paddingLeft: 0, marginTop: 8 }}
        onClick={() => { set("who", "none"); setTouched((t) => [...t, "who"]); setTimeout(next, 150); }}>
        It&apos;s just me
      </button>
    ) : null;

  return (
    <AskShell v="buy" n={n} total={QS.length} onLeave={() => {
        track({ name: "assessment_abandon", side: "buy", qid: q?.id, step: n + 1, dwell: dwell(), fv: funnel.version, src: src.current });
        setLeft(true);
      }}
      hasValues={Boolean(m.matched.length || Number(a.price) > 0 || preCounty)}
      panel={
        <>
          <div className="between ask-panel-head" style={{ marginBottom: 18 }}>
            <span className="t-sm w6">What we know so far</span>
            {m.matched.length || Number(a.price) > 0 ? (
              <span className="chip chip-brand"><span className="dot" style={{ background: "var(--brand)" }} />Live</span>
            ) : null}
          </div>
          <div className="col gap-3">
            {preCounty ? (
              <Carried label="From the last page"
                value={`${county} County · ${ownership === "primary" ? "owned recently" : ownership === "investment" ? "investment property only" : "no ownership in three years"}`} />
            ) : null}
            {m.matched.length ? (
              <LiveCard brand label={`Assistance in ${county}`} value={range(m.usableMin, m.usableMax)}
                note={`${m.matched.length} programs may fit you`} />
            ) : null}
            {ownership === "investment" ? (
              <div className="card p-3" style={{ background: "var(--warn-wash)", borderColor: "var(--warn-line)" }}>
                <div className="t-xs c-2" style={{ lineHeight: 1.55 }}>
                  Matched as first-time — an investment property usually doesn&apos;t count. A lender confirms it.
                </div>
              </div>
            ) : null}
            {Number(a.price) > 0 ? (
              <LiveCard label="Cash you'd actually need" value={money(cash.total)}
                note={`Not ${money(cash.down)} — that's just the down payment`} />
            ) : null}
            {Number(a.price) > 0 ? <LiveCard label="All-in monthly" value={money(mo.value)} /> : null}
            {Number(a.price) > 0 && Number(a.savings) > 0 ? (
              <LiveCard strong label={gap.gap > 0 ? "Still to find" : "You're covered"} value={money(gap.gap)}
                note={gap.monthsToClose ? `~${gap.monthsToClose} months at ${money(Number(a.monthlySaving))}/mo, before any assistance` : undefined} />
            ) : null}
            {!m.matched.length && !Number(a.price) && !preCounty ? (
              <p className="t-sm c-4" style={{ lineHeight: 1.6 }}>Your numbers start appearing here from the next question.</p>
            ) : null}
          </div>
        </>
      }>
      <Q key={q.id} topic={q.topic} q={q.title} why={q.description}>
        <Field q={q} value={a[key]} advance={next} options={GA_COUNTIES}
          onChange={(v) => set(key, v)} extra={extra} />
        {q.id === "ownership" && ownership === "investment" ? (
          <p className="t-xs c-3" style={{ marginTop: 14, lineHeight: 1.6 }}>{OWNERSHIP_CAVEAT.investment}</p>
        ) : null}
      </Q>

      <Nav n={n} canNext={!!ok} last={last} cta="Show me everything"
        onBack={() => go(n - 1)} onNext={next} />
    </AskShell>
  );
}

export default function Page() {
  return <Suspense fallback={null}><BuyStart /></Suspense>;
}
