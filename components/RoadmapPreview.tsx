"use client";

import { computeRoadmap } from "@/lib/roadmap/calc";
import { formToCalcInputs, money, type AgentBranding, type RoadmapFormState } from "@/lib/roadmap/types";

function niceDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function RoadmapPreview({
  form,
  branding,
}: {
  form: RoadmapFormState;
  branding: AgentBranding;
}) {
  const c = computeRoadmap(formToCalcInputs(form));
  const hasPrice = form.price > 0;
  const first = form.firstName.trim();
  const last = form.lastName.trim();
  const full = [first, last].filter(Boolean).join(" ");
  const bedsBaths =
    form.beds || form.baths ? `${form.beds || "?"} bd / ${form.baths || "?"} ba` : "";
  const features = [
    ...form.features,
    ...form.featuresOther
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];
  const activeDpa = form.dpaPrograms.filter((d) => d.name.trim() || d.amount > 0);
  const activeMoves = form.moves.filter((m) => m.text.trim());
  const dpaTotal = form.dpaPrograms.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div
      id="roadmap-sheet"
      className="sheet relative w-[816px] min-h-[1056px] bg-[var(--paper)] px-[58px] pb-[46px] pt-[54px] text-[var(--ink)] shadow-[0_24px_60px_rgba(0,0,0,.35)]"
      style={
        {
          ["--brand" as string]: branding.brandColor,
          ["--accent" as string]: branding.accentColor,
        } as React.CSSProperties
      }
    >
      <div className="absolute inset-x-0 top-0 h-[7px] bg-[var(--brand)]" />
      <div className="absolute inset-x-0 top-[7px] h-0.5 bg-[var(--accent)]" />

      <div className="mb-[30px] flex items-start justify-between pt-1.5">
        <div className="flex items-center gap-[11px]">
          <div className="font-display grid h-10 w-10 place-items-center rounded-[10px] bg-[var(--brand)] text-[21px] font-semibold text-white">
            {branding.markLetter || "R"}
          </div>
          <div>
            <div className="font-display text-base font-semibold leading-tight text-[var(--brand)]">
              {branding.brandName || branding.displayName || "Your Brand"}
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--muted)]">{branding.roleLine}</div>
          </div>
        </div>
        <div className="text-right text-[11px] leading-relaxed text-[var(--muted)]">
          {branding.displayName && (
            <>
              {branding.displayName}
              <br />
            </>
          )}
          {branding.phone && (
            <>
              {branding.phone}
              <br />
            </>
          )}
          {branding.email}
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-2 text-[11px] font-bold tracking-[0.16em] text-[var(--accent)] uppercase">
          Homeownership Roadmap
        </div>
        <h2 className="font-display text-[38px] leading-[1.02] font-semibold tracking-[-0.02em] text-[var(--brand)]">
          {full ? `${full}'s Path to Owning` : "Your Client's Path to Owning"}
        </h2>
        <div className="mt-[11px] text-xs text-[var(--muted)]">
          Prepared by <b className="font-semibold text-[var(--ink)]">{branding.displayName || "your advisor"}</b>
          {form.preparedDate ? ` · ${niceDate(form.preparedDate)}` : ""}
        </div>
      </div>

      <div className="mb-[26px] rounded-r-lg border-l-[3px] border-[var(--accent)] bg-[var(--panel)] px-4 py-[13px] text-[13px] leading-relaxed text-[#3d433b]">
        {first || "Here"}, this is your personal plan to homeownership. It shows exactly where you stand today,
        what the numbers look like, the money you may qualify for, and the specific moves that get you to the
        closing table. Work these steps with me and we will get you there.
      </div>

      <Section label="Your snapshot">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--line)]">
          <SnapCell k="Target timeline" v={form.timeline} />
          <SnapCell k="Home type" v={form.homeType} />
          <SnapCell k="Size" v={bedsBaths} />
          <SnapCell k="Target areas" v={form.areas} />
          <SnapCell k="Target price" v={hasPrice ? money(form.price) : ""} big />
          <SnapCell k="Est. monthly" v={hasPrice ? `${money(c.monthlyTotal)} /mo` : ""} big />
          {features.length > 0 && (
            <div className="col-span-2 bg-[var(--paper)] px-[15px] py-3">
              <div className="mb-1 text-[10px] font-semibold tracking-[0.06em] text-[var(--muted)] uppercase">
                Must-haves
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {features.map((f) => (
                  <span
                    key={f}
                    className="rounded-full border border-[#d9e0d2] bg-[#eef1e8] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--brand)]"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      {hasPrice && (
        <Section label="Your numbers">
          <div className="grid grid-cols-2 gap-3.5">
            <div className="rounded-[11px] border border-[var(--line)] bg-white px-4 py-[15px]">
              <div className="mb-2 text-[10.5px] font-semibold tracking-[0.06em] text-[var(--muted)] uppercase">
                Estimated monthly payment
              </div>
              <div className="font-display text-[27px] font-semibold leading-none text-[var(--brand)]">
                {money(c.monthlyTotal)}
                <span className="font-sans text-xs font-medium text-[var(--muted)]"> /month</span>
              </div>
              <div className="mt-[11px] border-t border-[var(--line)] pt-2">
                <BrkRow label="Principal & interest" value={money(c.monthlyPI)} />
                <BrkRow label="Property taxes" value={money(c.monthlyTax)} />
                <BrkRow label="Homeowners insurance" value={money(c.monthlyInsurance)} />
                {c.monthlyPMI > 0 && <BrkRow label="Mortgage insurance" value={money(c.monthlyPMI)} />}
                {c.monthlyHOA > 0 && <BrkRow label="HOA" value={money(c.monthlyHOA)} />}
              </div>
            </div>
            <div className="rounded-[11px] border border-[var(--line)] bg-white px-4 py-[15px]">
              <div className="mb-2 text-[10.5px] font-semibold tracking-[0.06em] text-[var(--muted)] uppercase">
                Cash to close
              </div>
              <div className="space-y-0.5 text-xs text-[#4a5147]">
                <StackRow label={`Down payment (${form.downPct}%)`} value={money(c.down)} />
                <StackRow label="Estimated closing costs" value={money(c.closingCosts)} />
                <div className="mt-1 flex justify-between border-t border-[var(--line)] pt-1.5 font-semibold text-[var(--ink)]">
                  <span>Cash to close</span>
                  <span>{money(c.cashToClose)}</span>
                </div>
                {form.savings > 0 && (
                  <StackRow label="Your savings" value={`- ${money(form.savings)}`} minus />
                )}
                {dpaTotal > 0 && (
                  <StackRow label="Assistance programs" value={`- ${money(dpaTotal)}`} minus />
                )}
                <div className="mt-2 flex items-baseline justify-between border-t-[1.5px] border-[var(--brand)] pt-2">
                  <span className="text-[11px] font-bold tracking-[0.05em] text-[var(--brand)] uppercase">
                    {c.cashGap > 0 ? "Still to save" : "Cash need"}
                  </span>
                  <span
                    className={`font-display text-[23px] font-semibold tabular-nums ${
                      c.cashGap > 0 ? "text-[var(--brand)]" : "text-[#2f7a4a]"
                    }`}
                  >
                    {c.cashGap > 0 ? money(c.cashGap) : "Fully covered"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Section>
      )}

      <Section label="Where you stand today">
        <div className="grid grid-cols-2 gap-3.5">
          <div className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-[15px]">
            <div className="mb-2 text-[10.5px] font-semibold tracking-[0.06em] text-[var(--muted)] uppercase">
              Credit score
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-display text-[26px] font-semibold">{form.creditNow || "—"}</span>
              <span className="font-bold text-[var(--accent)]">→</span>
              <span className="font-display text-[26px] font-semibold text-[var(--brand)]">
                {form.creditGoal || "—"}
              </span>
            </div>
            <div className="mt-1.5 text-[10px] text-[var(--muted)]">
              {form.creditWhen ? `Target within ${form.creditWhen}` : "now to target"}
            </div>
          </div>
          <div className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-[15px]">
            <div className="mb-2 text-[10.5px] font-semibold tracking-[0.06em] text-[var(--muted)] uppercase">
              Loan snapshot
            </div>
            <div className="font-display text-[22px] font-semibold text-[var(--brand)]">
              {hasPrice ? money(c.loan) : "—"}
            </div>
            <div className="mt-1.5 text-[10px] text-[var(--muted)]">
              {hasPrice
                ? `Estimated loan amount at ${form.downPct}% down`
                : "set price to estimate loan"}
            </div>
          </div>
          {form.incomeNotes.trim() && (
            <div className="col-span-2 rounded-[10px] border border-[var(--line)] bg-white px-4 py-3.5 text-[12.5px] leading-relaxed text-[#3d433b]">
              <b className="text-[var(--brand)]">Income & documents:</b> {form.incomeNotes}
            </div>
          )}
        </div>
      </Section>

      {activeDpa.length > 0 && (
        <Section label="Money you may qualify for">
          <div className="overflow-hidden rounded-[11px] border border-[var(--accent)] bg-gradient-to-b from-[#fbf6ea] to-white">
            <div className="flex items-center justify-between bg-[var(--brand)] px-4 py-[11px] text-xs text-white">
              <span className="font-semibold">Assistance you may be eligible for</span>
              {dpaTotal > 0 && (
                <span className="font-display text-[17px] font-semibold text-[#f3d9a0]">
                  Up to {money(dpaTotal)}
                </span>
              )}
            </div>
            {activeDpa.map((d, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3.5 border-b border-[#eadfc7] px-4 py-3 last:border-b-0"
              >
                <div>
                  <div className="text-[13px] font-semibold">{d.name || "Program"}</div>
                  {d.note.trim() && (
                    <div className="mt-0.5 max-w-[430px] text-[11px] leading-snug text-[var(--muted)]">
                      {d.note}
                    </div>
                  )}
                </div>
                {d.amount > 0 && (
                  <div className="font-display text-[17px] font-semibold whitespace-nowrap text-[var(--brand)] tabular-nums">
                    {money(d.amount)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section label="Your next moves">
        <div className="relative pl-2">
          {(activeMoves.length ? activeMoves : [{ text: "", dueBy: "" }]).map((m, i) => (
            <div key={i} className="relative pb-[18px] pl-[34px] last:pb-0.5">
              {i < (activeMoves.length || 1) - 1 && (
                <div className="absolute top-[22px] bottom-[-4px] left-[9px] w-0.5 bg-[var(--line)]" />
              )}
              <div className="absolute top-0.5 left-0 grid h-5 w-5 place-items-center rounded-full bg-[var(--brand)] text-[11px] font-bold text-white">
                {i + 1}
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <div className={`text-[13.5px] leading-snug font-semibold ${m.text ? "" : "italic text-[#b9b3a3]"}`}>
                  {m.text || "Add the first move on the left"}
                </div>
                {m.dueBy.trim() && (
                  <div className="text-[11px] font-semibold whitespace-nowrap text-[var(--accent)]">{m.dueBy}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {form.personalNote.trim() && (
        <div className="mt-7 border-t border-[var(--line)] pt-5">
          <div className="font-display text-sm leading-relaxed text-[#3d433b] italic">
            &ldquo;{form.personalNote}&rdquo;
          </div>
          <div className="mt-3 text-xs text-[var(--muted)]">
            With you on this, <b className="font-semibold text-[var(--brand)]">{branding.displayName}</b>
            {branding.brandName ? `, ${branding.brandName}` : ""}
          </div>
        </div>
      )}

      <div className="mt-5 text-center text-[10px] text-[var(--muted)]">
        This plan was prepared for you and is yours to keep.
      </div>
      <div className="mt-2 text-center text-[9px] leading-relaxed text-[#a49d8c]">
        Payment and cost figures are good-faith estimates for planning only, based on the assumptions shown, and
        are not a loan approval, quote, or commitment.
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 break-inside-avoid">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-bold tracking-[0.1em] text-[var(--brand)] uppercase">
        {label}
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>
      {children}
    </div>
  );
}

function SnapCell({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <div className="bg-[var(--paper)] px-[15px] py-3">
      <div className="mb-1 text-[10px] font-semibold tracking-[0.06em] text-[var(--muted)] uppercase">{k}</div>
      {v ? (
        <div className={`${big ? "font-display text-[19px] text-[var(--brand)]" : "text-[14.5px]"} font-semibold tabular-nums`}>
          {v}
        </div>
      ) : (
        <div className={`${big ? "font-display text-[19px]" : "text-[14.5px]"} italic text-[#b9b3a3]`}>to set</div>
      )}
    </div>
  );
}

function BrkRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5 text-[11.5px] text-[#4a5147] tabular-nums">
      <span>{label}</span>
      <span className="font-semibold text-[var(--ink)]">{value}</span>
    </div>
  );
}

function StackRow({ label, value, minus }: { label: string; value: string; minus?: boolean }) {
  return (
    <div className="flex justify-between py-0.5 tabular-nums">
      <span>{label}</span>
      <span className={`font-semibold ${minus ? "text-[#3f7a4f]" : "text-[var(--ink)]"}`}>{value}</span>
    </div>
  );
}
