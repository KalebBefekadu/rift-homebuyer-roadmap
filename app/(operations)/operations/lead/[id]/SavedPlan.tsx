import { planSummary, type SavedPlan as Plan } from "@/lib/core/saved-plan";
import { siteUrl } from "@/lib/core/site";

const DAY = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });

/**
 * What this person worked out before they spoke to anyone (Blueprint v5
 * §5.5, v3 §46.7). Built from what they saved, never from browsing: the
 * figures are as they were shown on the day, and each link reopens the value
 * with their answers, recomputed today.
 */
export function SavedPlan({ plan, savedAt }: { plan: Plan; savedAt: string }) {
  const origin = siteUrl();
  return (
    <section style={{ marginTop: 24 }} aria-labelledby="saved-plan-h">
      <h2 id="saved-plan-h" className="t-lg w6">What they worked out</h2>
      <div className="card p-4" style={{ marginTop: 10 }}>
        <p className="t-sm c-2">{planSummary(plan)}.</p>
        <p className="t-xs c-4" style={{ marginTop: 4 }}>
          {plan.mode === "review" ? "Asked you to review it" : "Saved it"} on {DAY(savedAt)}. Figures as they were shown that day.
        </p>
        {plan.values.length ? (
          <ul className="col gap-1" style={{ marginTop: 10 }}>
            {plan.values.map((v) => (
              <li key={v.tool} className="between gap-2 t-sm" style={{ borderTop: "1px solid var(--line-3)", paddingTop: 6 }}>
                <span>{v.label}</span>
                <span className="row gap-2">
                  <span className="num">{v.figure}</span>
                  <a href={`${origin}${v.href}`} target="_blank" rel="noopener noreferrer" className="t-xs c-brand">Open today</a>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
