"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RoadmapPreview } from "@/components/RoadmapPreview";
import {
  BUCKET_LABELS,
  FEATURE_OPTIONS,
  GA_COUNTIES,
  HOME_TYPE_OPTIONS,
  TIMELINE_OPTIONS,
  emptyForm,
} from "@/lib/roadmap/constants";
import { computeRoadmap } from "@/lib/roadmap/calc";
import {
  formToCalcInputs,
  money,
  type AgentBranding,
  type RoadmapFormState,
  type TimeToBuy,
} from "@/lib/roadmap/types";
import {
  getBranding,
  getCalcDefaults,
  getClient,
  getDpaPrograms,
  getLatestRoadmap,
  saveClientAndRoadmap,
} from "@/lib/store/local";

async function downloadPdf(firstName: string) {
  const sheet = document.getElementById("roadmap-sheet");
  if (!sheet) return;
  const html2pdf = (await import("html2pdf.js")).default;
  try {
    if (document.fonts?.ready) await document.fonts.ready;
  } catch {
    /* ignore */
  }
  const client =
    (firstName || "client").trim().split(" ")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") || "client";
  await html2pdf()
    .set({
      margin: 0,
      filename: `homeownership-roadmap-${client}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#FAF7F0", windowWidth: 816 },
      jsPDF: { unit: "px", format: [816, 1056], orientation: "portrait", hotfixes: ["px_scaling"] },
      pagebreak: { mode: ["css", "legacy"] },
    })
    .from(sheet)
    .save();
}

export function RoadmapWorkspace({ clientId }: { clientId?: string }) {
  const router = useRouter();
  const [branding, setBranding] = useState<AgentBranding | null>(null);
  const [form, setForm] = useState<RoadmapFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [version, setVersion] = useState<number | null>(null);

  useEffect(() => {
    const b = getBranding();
    const defaults = getCalcDefaults();
    setBranding(b);
    document.documentElement.style.setProperty("--brand", b.brandColor);
    document.documentElement.style.setProperty("--accent", b.accentColor);

    if (clientId) {
      const client = getClient(clientId);
      const latest = getLatestRoadmap(clientId);
      if (latest) {
        setForm(latest.inputs);
        setVersion(latest.version);
      } else if (client) {
        const f = emptyForm(defaults);
        f.firstName = client.firstName;
        f.lastName = client.lastName;
        f.email = client.email;
        f.phone = client.phone;
        f.timeToBuy = client.timeToBuy;
        setForm(f);
      } else {
        setForm(emptyForm(defaults));
      }
    } else {
      setForm(emptyForm(defaults));
    }
  }, [clientId]);

  const dpaCatalog = useMemo(() => (form ? getDpaPrograms() : []), [form]);
  const filteredDpa = useMemo(() => {
    if (!form) return [];
    return dpaCatalog.filter((p) => !p.county || p.county === form.county);
  }, [dpaCatalog, form]);

  const outputs = useMemo(
    () => (form ? computeRoadmap(formToCalcInputs(form)) : null),
    [form],
  );

  const patch = useCallback(<K extends keyof RoadmapFormState>(key: K, value: RoadmapFormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const onSave = async (andPdf = false) => {
    if (!form) return;
    setSaving(true);
    setStatus("");
    try {
      const result = saveClientAndRoadmap(form, clientId);
      setVersion(result.version);
      setStatus(`Saved as version ${result.version}`);
      if (andPdf) {
        setPdfBusy(true);
        await downloadPdf(form.firstName);
        setPdfBusy(false);
      }
      if (!clientId) router.replace(`/portal/admin/roadmap/${result.clientId}`);
    } catch (e) {
      console.error(e);
      setStatus("Save failed. Try again.");
    } finally {
      setSaving(false);
      setPdfBusy(false);
    }
  };

  if (!form || !branding) {
    return <div className="p-8 text-[var(--app-panel)]">Loading…</div>;
  }

  return (
    <div className="grid min-h-[calc(100vh-57px)] grid-cols-1 lg:grid-cols-[minmax(380px,460px)_1fr]">
      <div className="max-h-[calc(100vh-57px)] overflow-y-auto border-r border-black/10 bg-[var(--app-panel)] px-6 pt-6 pb-28">
        <div className="mb-1 flex items-center gap-2.5">
          <div className="font-display grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-[var(--brand)] text-lg font-semibold text-white">
            {branding.markLetter}
          </div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Roadmap Generator</h1>
        </div>
        <p className="mb-5 text-[12.5px] leading-relaxed text-[var(--muted)]">
          Fill this in live during intake. Numbers calculate themselves. Save to keep the client in your
          pipeline{version ? ` · v${version}` : ""}.
        </p>

        <Group title="Client">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="First name">
              <input value={form.firstName} onChange={(e) => patch("firstName", e.target.value)} placeholder="Meron" />
            </Field>
            <Field label="Last name">
              <input value={form.lastName} onChange={(e) => patch("lastName", e.target.value)} placeholder="Tesfaye" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Email">
              <input value={form.email} onChange={(e) => patch("email", e.target.value)} type="email" />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={(e) => patch("phone", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Prepared date">
              <input
                type="date"
                value={form.preparedDate}
                onChange={(e) => patch("preparedDate", e.target.value)}
              />
            </Field>
            <Field label="Time-to-buy bucket">
              <select
                value={form.timeToBuy}
                onChange={(e) => patch("timeToBuy", e.target.value as TimeToBuy)}
              >
                {Object.entries(BUCKET_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Group>

        <Group title="What they want">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Target timeline">
              <select value={form.timeline} onChange={(e) => patch("timeline", e.target.value)}>
                <option value="">Select</option>
                {TIMELINE_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="Home type">
              <select value={form.homeType} onChange={(e) => patch("homeType", e.target.value)}>
                <option value="">Select</option>
                {HOME_TYPE_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Beds">
              <input type="number" min={0} value={form.beds} onChange={(e) => patch("beds", e.target.value)} />
            </Field>
            <Field label="Baths">
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.baths}
                onChange={(e) => patch("baths", e.target.value)}
              />
            </Field>
            <Field label="Target areas">
              <input value={form.areas} onChange={(e) => patch("areas", e.target.value)} placeholder="Decatur" />
            </Field>
          </div>
          <div className="mb-2 text-[11.5px] font-semibold text-[#3c433a]">Must-have features</div>
          <div className="mb-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {FEATURE_OPTIONS.map((f) => (
              <label key={f} className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-[#3c433a]">
                <input
                  type="checkbox"
                  className="accent-[var(--brand)]"
                  checked={form.features.includes(f)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...form.features, f]
                      : form.features.filter((x) => x !== f);
                    patch("features", next);
                  }}
                />
                {f}
              </label>
            ))}
          </div>
          <Field label="Other features">
            <input
              value={form.featuresOther}
              onChange={(e) => patch("featuresOther", e.target.value)}
              placeholder="e.g. large backyard"
            />
          </Field>
        </Group>

        <Group title="The numbers" tag="auto-calculated">
          <Field label="Target price" suffix="$">
            <input
              type="number"
              value={form.price || ""}
              onChange={(e) => patch("price", Number(e.target.value) || 0)}
              placeholder="300000"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Down payment" suffix="%">
              <input
                type="number"
                step={0.5}
                value={form.downPct}
                onChange={(e) => patch("downPct", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Interest rate (assumption)" suffix="%">
              <input
                type="number"
                step={0.125}
                value={form.ratePct}
                onChange={(e) => patch("ratePct", Number(e.target.value) || 0)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Loan term">
              <select
                value={form.termYears}
                onChange={(e) => patch("termYears", Number(e.target.value))}
              >
                <option value={30}>30 years</option>
                <option value={20}>20 years</option>
                <option value={15}>15 years</option>
              </select>
            </Field>
            <Field label="Current savings" suffix="$">
              <input
                type="number"
                value={form.savings || ""}
                onChange={(e) => patch("savings", Number(e.target.value) || 0)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Property tax /yr" suffix="%">
              <input
                type="number"
                step={0.05}
                value={form.taxPct}
                onChange={(e) => patch("taxPct", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Insurance /yr" suffix="$">
              <input
                type="number"
                value={form.insuranceYr}
                onChange={(e) => patch("insuranceYr", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="HOA /mo" suffix="$">
              <input
                type="number"
                value={form.hoaMo}
                onChange={(e) => patch("hoaMo", Number(e.target.value) || 0)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Closing costs" suffix="%">
              <input
                type="number"
                step={0.5}
                value={form.closingPct}
                onChange={(e) => patch("closingPct", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="PMI /yr (if under 20%)" suffix="%">
              <input
                type="number"
                step={0.1}
                value={form.pmiPct}
                onChange={(e) => patch("pmiPct", Number(e.target.value) || 0)}
              />
            </Field>
          </div>

          <div className="mt-1 rounded-[11px] bg-[var(--brand)] px-4 py-3.5 text-[#eef2ea]">
            {outputs && form.price > 0 ? (
              <>
                <CalcLine label={`Down payment (${form.downPct}%)`} value={money(outputs.down)} />
                <CalcLine label="Est. closing costs" value={money(outputs.closingCosts)} />
                <CalcLine label="Cash to close" value={money(outputs.cashToClose)} />
                <CalcLine label="Covered (savings + assistance)" value={money(outputs.covered)} />
                <div className="mt-1.5 flex justify-between border-t border-white/20 pt-2 text-[13px]">
                  <span>Remaining cash gap</span>
                  <b className="font-display text-[19px] font-semibold text-[#f3d9a0]">
                    {outputs.cashGap > 0 ? money(outputs.cashGap) : "Fully covered"}
                  </b>
                </div>
                <div className="mt-1 flex justify-between text-[13px]">
                  <span>Est. monthly payment</span>
                  <b className="font-display text-[19px] font-semibold text-[#f3d9a0]">
                    {money(outputs.monthlyTotal)}/mo
                  </b>
                </div>
              </>
            ) : (
              <div className="text-xs text-[#cdd8cc]">Enter a target price to calculate.</div>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-[var(--muted)]">
            Assistance programs below reduce the cash gap. Rate, taxes, and insurance are editable estimates, not
            a quote.
          </p>
        </Group>

        <Group title="Credit today">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Score now">
              <input value={form.creditNow} onChange={(e) => patch("creditNow", e.target.value)} placeholder="640" />
            </Field>
            <Field label="Target">
              <input value={form.creditGoal} onChange={(e) => patch("creditGoal", e.target.value)} placeholder="700" />
            </Field>
            <Field label="By when">
              <input value={form.creditWhen} onChange={(e) => patch("creditWhen", e.target.value)} placeholder="90 days" />
            </Field>
          </div>
          <Field label="Income & documentation notes">
            <textarea
              value={form.incomeNotes}
              onChange={(e) => patch("incomeNotes", e.target.value)}
              placeholder="e.g. Self-employed. Coordinate with CPA…"
            />
          </Field>
        </Group>

        <Group title="Money they may qualify for">
          <Field label="Filter by county">
            <select value={form.county} onChange={(e) => patch("county", e.target.value)}>
              {GA_COUNTIES.map((c) => (
                <option key={c} value={c === "Statewide" ? "Statewide" : c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          {filteredDpa.length > 0 && (
            <div className="mb-3 space-y-1.5">
              <div className="text-[11px] font-semibold text-[var(--muted)]">Pick from catalog</div>
              {filteredDpa.map((p) => {
                const selected = form.dpaPrograms.some((d) => d.id === p.id || d.name === p.name);
                return (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--line)] bg-[#fbfaf6] px-3 py-2 text-[12.5px]"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-[var(--brand)]"
                      checked={selected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const withoutEmpty = form.dpaPrograms.filter((d) => d.name.trim() || d.amount);
                          patch("dpaPrograms", [
                            ...withoutEmpty.filter((d) => d.id !== p.id && d.name !== p.name),
                            { id: p.id, name: p.name, amount: p.amount, note: p.notes },
                          ]);
                        } else {
                          const next = form.dpaPrograms.filter((d) => d.id !== p.id && d.name !== p.name);
                          patch("dpaPrograms", next.length ? next : [{ name: "", amount: 0, note: "" }]);
                        }
                      }}
                    />
                    <span>
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-[var(--muted)]"> · {money(p.amount)}</span>
                      {p.county && <span className="text-[var(--muted)]"> · {p.county}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {form.dpaPrograms.map((d, i) => (
            <div key={i} className="relative mb-2 rounded-[9px] border border-[var(--line)] bg-[#fbfaf6] p-2.5">
              <button
                type="button"
                className="absolute top-1.5 right-2 border-0 bg-transparent text-base text-[#b04a3a] opacity-70 hover:opacity-100"
                onClick={() => {
                  const next = form.dpaPrograms.filter((_, idx) => idx !== i);
                  patch("dpaPrograms", next.length ? next : [{ name: "", amount: 0, note: "" }]);
                }}
              >
                ×
              </button>
              <Field label="Program name">
                <input
                  value={d.name}
                  onChange={(e) => {
                    const next = [...form.dpaPrograms];
                    next[i] = { ...d, name: e.target.value };
                    patch("dpaPrograms", next);
                  }}
                  placeholder="Georgia Dream"
                />
              </Field>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Dollar amount">
                  <input
                    type="number"
                    value={d.amount || ""}
                    onChange={(e) => {
                      const next = [...form.dpaPrograms];
                      next[i] = { ...d, amount: Number(e.target.value) || 0 };
                      patch("dpaPrograms", next);
                    }}
                  />
                </Field>
                <Field label="Short note">
                  <input
                    value={d.note}
                    onChange={(e) => {
                      const next = [...form.dpaPrograms];
                      next[i] = { ...d, note: e.target.value };
                      patch("dpaPrograms", next);
                    }}
                    placeholder="forgivable / grant"
                  />
                </Field>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="w-full cursor-pointer rounded-lg border border-dashed border-[var(--brand)] bg-transparent py-2 text-[12.5px] font-semibold text-[var(--brand)] hover:bg-[rgba(31,61,43,.05)]"
            onClick={() => patch("dpaPrograms", [...form.dpaPrograms, { name: "", amount: 0, note: "" }])}
          >
            + Add a program
          </button>
        </Group>

        <Group title="Their next moves">
          {form.moves.map((m, i) => (
            <div key={i} className="relative mb-2 rounded-[9px] border border-[var(--line)] bg-[#fbfaf6] p-2.5">
              <button
                type="button"
                className="absolute top-1.5 right-2 border-0 bg-transparent text-base text-[#b04a3a] opacity-70 hover:opacity-100"
                onClick={() => {
                  const next = form.moves.filter((_, idx) => idx !== i);
                  patch("moves", next.length ? next : [{ text: "", dueBy: "" }]);
                }}
              >
                ×
              </button>
              <Field label={`Move ${i + 1}`}>
                <input
                  value={m.text}
                  onChange={(e) => {
                    const next = [...form.moves];
                    next[i] = { ...m, text: e.target.value };
                    patch("moves", next);
                  }}
                  placeholder="Pay cards under 30% utilization"
                />
              </Field>
              <Field label="Due by">
                <input
                  value={m.dueBy}
                  onChange={(e) => {
                    const next = [...form.moves];
                    next[i] = { ...m, dueBy: e.target.value };
                    patch("moves", next);
                  }}
                  placeholder="Aug 15 or 30 days"
                />
              </Field>
            </div>
          ))}
          <button
            type="button"
            className="w-full cursor-pointer rounded-lg border border-dashed border-[var(--brand)] bg-transparent py-2 text-[12.5px] font-semibold text-[var(--brand)] hover:bg-[rgba(31,61,43,.05)]"
            onClick={() => patch("moves", [...form.moves, { text: "", dueBy: "" }])}
          >
            + Add a move
          </button>
        </Group>

        <Group title="Personal note (optional)">
          <Field label="A line in your voice">
            <textarea
              value={form.personalNote}
              onChange={(e) => patch("personalNote", e.target.value)}
              placeholder="e.g. Meron, this is fully doable on your timeline…"
            />
          </Field>
        </Group>

        <div className="sticky bottom-0 -mx-6 mt-6 space-y-2 bg-gradient-to-t from-[var(--app-panel)] via-[var(--app-panel)] to-transparent px-6 pt-4 pb-5">
          <button
            type="button"
            disabled={saving || pdfBusy}
            onClick={() => onSave(true)}
            className="w-full cursor-pointer rounded-[10px] border-0 bg-[var(--brand)] py-3 text-sm font-semibold text-white hover:bg-[#16301f] disabled:cursor-wait disabled:opacity-60"
          >
            {pdfBusy ? "Preparing PDF…" : saving ? "Saving…" : "Save & download PDF"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(false)}
            className="w-full cursor-pointer rounded-[10px] border border-[var(--brand)] bg-transparent py-2.5 text-[13px] font-semibold text-[var(--brand)] hover:bg-[rgba(31,61,43,.05)] disabled:opacity-60"
          >
            Save only
          </button>
          {status && <p className="text-center text-[11px] text-[var(--muted)]">{status}</p>}
        </div>
      </div>

      <div className="flex justify-center overflow-y-auto px-[30px] py-[34px] max-lg:h-auto lg:max-h-[calc(100vh-57px)]">
        <RoadmapPreview form={form} branding={branding} />
      </div>
    </div>
  );
}

function Group({
  title,
  tag,
  children,
}: {
  title: string;
  tag?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="mb-2.5 flex items-center justify-between border-b border-[var(--line)] pb-1.5 text-[11px] font-bold tracking-[0.09em] text-[var(--brand)] uppercase">
        <span>{title}</span>
        {tag && <span className="text-[11px] font-semibold tracking-normal text-[var(--muted)] normal-case">{tag}</span>}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  suffix,
}: {
  label: string;
  children: React.ReactNode;
  suffix?: string;
}) {
  return (
    <label className="mb-2.5 block">
      <span className="mb-1 block text-[11.5px] font-semibold text-[#3c433a]">{label}</span>
      <div className={`relative ${suffix ? "[&_input]:pr-7" : ""}`}>
        {children}
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-[var(--muted)]">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function CalcLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5 text-xs text-[#cdd8cc]">
      <span>{label}</span>
      <b className="font-semibold text-white tabular-nums">{value}</b>
    </div>
  );
}