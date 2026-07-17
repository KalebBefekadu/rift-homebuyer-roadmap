"use client";

import { useEffect, useState } from "react";
import { DEFAULT_BRANDING, DEFAULT_CALC } from "@/lib/roadmap/constants";
import type { AgentBranding, CalcDefaults } from "@/lib/roadmap/types";
import { getBranding, getCalcDefaults, saveSettings } from "@/lib/store/local";

export default function SettingsPage() {
  const [branding, setBranding] = useState<AgentBranding>(DEFAULT_BRANDING);
  const [calc, setCalc] = useState<CalcDefaults>(DEFAULT_CALC);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBranding(getBranding());
    setCalc(getCalcDefaults());
  }, []);

  const onSave = () => {
    saveSettings(branding, calc);
    document.documentElement.style.setProperty("--brand", branding.brandColor);
    document.documentElement.style.setProperty("--accent", branding.accentColor);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <h1 className="font-display mb-1 text-3xl font-semibold text-[var(--app-panel)]">Settings</h1>
      <p className="mb-6 text-sm text-[#a8aea4]">Branding and calc defaults — set once, reuse every intake.</p>

      <div className="rounded-xl bg-[var(--app-panel)] p-6">
        <h2 className="mb-3 text-[11px] font-bold tracking-[0.09em] text-[var(--brand)] uppercase">
          Your branding
        </h2>
        <label className="mb-2.5 block">
          <span className="mb-1 block text-[11.5px] font-semibold">Your name</span>
          <input
            value={branding.displayName}
            onChange={(e) => setBranding({ ...branding, displayName: e.target.value })}
          />
        </label>
        <label className="mb-2.5 block">
          <span className="mb-1 block text-[11.5px] font-semibold">Brand / company</span>
          <input
            value={branding.brandName}
            onChange={(e) => setBranding({ ...branding, brandName: e.target.value })}
          />
        </label>
        <label className="mb-2.5 block">
          <span className="mb-1 block text-[11.5px] font-semibold">Role line</span>
          <input
            value={branding.roleLine}
            onChange={(e) => setBranding({ ...branding, roleLine: e.target.value })}
          />
        </label>
        <div className="mb-2.5 grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold">Phone</span>
            <input value={branding.phone} onChange={(e) => setBranding({ ...branding, phone: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold">Email</span>
            <input value={branding.email} onChange={(e) => setBranding({ ...branding, email: e.target.value })} />
          </label>
        </div>
        <label className="mb-2.5 block">
          <span className="mb-1 block text-[11.5px] font-semibold">Mark letter</span>
          <input
            maxLength={2}
            value={branding.markLetter}
            onChange={(e) => setBranding({ ...branding, markLetter: e.target.value })}
          />
        </label>
        <div className="mb-5 flex gap-2.5">
          <label className="block flex-1">
            <span className="mb-1 block text-[11.5px] font-semibold">Brand color</span>
            <input
              type="color"
              className="h-[38px] cursor-pointer p-1"
              value={branding.brandColor}
              onChange={(e) => setBranding({ ...branding, brandColor: e.target.value })}
            />
          </label>
          <label className="block flex-1">
            <span className="mb-1 block text-[11.5px] font-semibold">Accent color</span>
            <input
              type="color"
              className="h-[38px] cursor-pointer p-1"
              value={branding.accentColor}
              onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
            />
          </label>
        </div>

        <h2 className="mb-3 text-[11px] font-bold tracking-[0.09em] text-[var(--brand)] uppercase">
          Calc defaults
        </h2>
        <div className="mb-2.5 grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold">Default rate %</span>
            <input
              type="number"
              step={0.125}
              value={calc.defaultRate}
              onChange={(e) => setCalc({ ...calc, defaultRate: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold">Default tax %</span>
            <input
              type="number"
              step={0.05}
              value={calc.defaultTaxPct}
              onChange={(e) => setCalc({ ...calc, defaultTaxPct: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold">Insurance /yr $</span>
            <input
              type="number"
              value={calc.defaultInsuranceYr}
              onChange={(e) => setCalc({ ...calc, defaultInsuranceYr: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold">Closing %</span>
            <input
              type="number"
              step={0.5}
              value={calc.defaultClosingPct}
              onChange={(e) => setCalc({ ...calc, defaultClosingPct: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold">PMI %</span>
            <input
              type="number"
              step={0.1}
              value={calc.defaultPmiPct}
              onChange={(e) => setCalc({ ...calc, defaultPmiPct: Number(e.target.value) || 0 })}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={onSave}
          className="mt-2 w-full cursor-pointer rounded-[10px] border-0 bg-[var(--brand)] py-3 text-sm font-semibold text-white hover:bg-[#16301f]"
        >
          {saved ? "Saved" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
