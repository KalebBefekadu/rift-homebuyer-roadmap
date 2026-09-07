"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AskShell, Leave, Q, Nav, LiveCard, Carried, Field } from "@/components/rift/Ask";
import { GA_COUNTIES } from "@/lib/core/registry";
import { useFunnel } from "@/lib/prototype/funnelStore";
import { track, useTrack } from "@/lib/prototype/telemetry";
import { readAttribution } from "@/lib/prototype/attribution";
import { SELLER_DEFAULTS, money, netProceeds, unclaimedValue, type SellerInputs } from "@/lib/core/compute";

type A = Record<string, unknown>;

function SellStart() {
  const router = useRouter();
  const sp = useSearchParams();
  const { funnel } = useFunnel("sell");

  const prePrice = sp.get("p");
  const prePayoff = sp.get("o");
  const preCounty = sp.get("c");
  const carried = !!(prePrice && preCounty);

  const QS = useMemo(
    () => funnel.questions.filter((q) => q.enabled && !(carried && (q.id === "county" || q.id === "price" || q.id === "payoff"))),
    [funnel, carried],
  );

  const [n, setN] = useState(0);
  const [left, setLeft] = useState(false);
  const [touched, setTouched] = useState<string[]>([]);
  const [a, setA] = useState<A>({
    timing: "", who: "", yearsOwned: 0,
    price: Number(prePrice) || 0,
    payoff: Number(prePayoff) || 0,
    county: preCounty || SELLER_DEFAULTS.county,
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
  useTrack({ name: "assessment_start", side: "sell", fv: funnel.version, meta: { prefilled: QS.length !== funnel.questions.length } });
  const seen = useRef<Date | number>(Date.now());
  useEffect(() => {
    if (!q) return;
    seen.current = Date.now();
    track({ name: "question_view", side: "sell", qid: q.id, step: n + 1, fv: funnel.version, src: src.current });
  }, [q, n, funnel.version]);
  const dwell = () => Date.now() - Number(seen.current);


  const price = Number(a.price) || 0;
  const s: SellerInputs = useMemo(() => ({
    ...SELLER_DEFAULTS, price, payoff: Number(a.payoff) || 0,
    county: String(a.county), yearsOwned: Number(a.yearsOwned) || 0,
    assessedValue: Math.round(price * 0.96),
  }), [a, price]);

  const r = useMemo(() => netProceeds(s), [s]);
  const unclaimed = useMemo(() => unclaimedValue(s), [s]);

  const next = () => {
    track({ name: "question_answer", side: "sell", qid: q?.id, step: n + 1, dwell: dwell(), fv: funnel.version, src: src.current });
    setTouched((t) => (t.includes(key) ? t : [...t, key]));
    if (!last) return setN(n + 1);
    const p = new URLSearchParams({
      p: String(price), o: String(a.payoff ?? 0), c: String(a.county),
      y: String(a.yearsOwned ?? 0), t: String(a.timing ?? ""), w: String(a.who || "none"), h: "0",
    });
    router.push(`/prototype/sell/results?${p}`);
  };
  const go = (i: number) => { setTouched((t) => (t.includes(key) ? t : [...t, key])); setN(i); };

  if (left) return (
    <Leave v="sell" n={n} onBack={() => setLeft(false)}
      extra={price > 0 ? (
        <div className="tint p-3" style={{ marginTop: 16 }}>
          <div className="t-xs c-4">Already worked out for you</div>
          <div className="num" style={{ fontSize: 20, color: "var(--brand-2)", marginTop: 3 }}>{money(r.net)}</div>
          <div className="t-xs c-4">estimated net proceeds</div>
        </div>
      ) : undefined} />
  );
  if (!q) return null;

  const extra =
    q.id === "payoff" ? (
      <button className="btn btn-g btn-sm" style={{ paddingLeft: 0, marginTop: 6 }}
        onClick={() => { set("payoff", 0); setTouched((t) => [...t, "payoff"]); setTimeout(next, 150); }}>
        It&apos;s paid off
      </button>
    ) : q.id === "who" ? (
      <button className="btn btn-g btn-sm" style={{ paddingLeft: 0, marginTop: 8 }}
        onClick={() => { set("who", "none"); setTouched((t) => [...t, "who"]); setTimeout(next, 150); }}>
        It&apos;s just me
      </button>
    ) : null;

  return (
    <AskShell v="sell" n={n} total={QS.length} onLeave={() => {
        track({ name: "assessment_abandon", side: "sell", qid: q?.id, step: n + 1, dwell: dwell(), fv: funnel.version, src: src.current });
        setLeft(true);
      }}
      hasValues={Boolean(price > 0 || carried)}
      panel={
        <>
          <div className="between ask-panel-head" style={{ marginBottom: 18 }}>
            <span className="t-sm w6">What we know so far</span>
            {price > 0 ? <span className="chip chip-brand"><span className="dot" style={{ background: "var(--brand)" }} />Live</span> : null}
          </div>
          <div className="col gap-3">
            {carried ? (
              <Carried label="From the last page" value={`${money(price)} · ${money(Number(a.payoff))} owed · ${a.county} County`} />
            ) : null}
            {price > 0 ? (
              <LiveCard brand label="What you'd walk away with" value={money(r.net)}
                note={`${Math.round((r.net / price) * 100)}% of the sale price`} />
            ) : null}
            {price > 0 ? <LiveCard label="Payoff and costs" value={money(r.totalCosts)} /> : null}
            {Number(a.yearsOwned) > 0 ? (
              <LiveCard strong label="Worth a phone call each" value={`${unclaimed.length} things`}
                note="exemptions, appeals and reliefs you may be owed" />
            ) : null}
            {!price ? <p className="t-sm c-4" style={{ lineHeight: 1.6 }}>Your numbers start appearing here once you tell us what you&apos;d sell for.</p> : null}
          </div>
        </>
      }>
      <Q key={q.id} topic={q.topic} q={q.title} why={q.description}>
        <Field q={q} value={a[key]} advance={next} options={GA_COUNTIES}
          onChange={(v) => set(key, v)} extra={extra} />
      </Q>

      <Nav n={n} canNext={!!ok} last={last} cta="Show me everything"
        onBack={() => go(n - 1)} onNext={next} />
    </AskShell>
  );
}

export default function Page() {
  return <Suspense fallback={null}><SellStart /></Suspense>;
}
