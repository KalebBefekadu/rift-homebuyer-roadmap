import { describe, expect, it } from "vitest";
import { BUYER_DEFAULTS, cashGap, cashToClose, gapLevers, monthlyComputed } from "./compute";
import { affordability } from "./afford";
import { controllableCosts, preparePlan, sellerNet, type Finish, type Roof, type Systems } from "./seller";
import { lenderQuestions } from "./lender-questions";
import { GEORGIA_PROGRAMS, matchAssistance, type Occupation } from "./assistance";
import { firstTimeFrom, type Ownership } from "./funnel";
import { ABROAD_DEFAULTS, abroadReturns, statusById, type StatusId, type Use } from "./abroad";
import { VALUES, type InputKey } from "./values";
import { timelinePlan } from "./timeline";
import { unclaimedChecks, type UnclaimedAnswers } from "./unclaimed";

/**
 * Every question a value asks has to be able to change its answer.
 *
 * A question that changes nothing is worse than a question not asked. It costs
 * the person a step, and it tells them the answer was fitted to them when it
 * was not: the cash-to-close page asks the county, then says "on a $300,000
 * home in Fulton County", and the figure is the same in all 159 counties.
 * (docs/audit/value-depth-2026-10.md, finding F1.)
 *
 * Each probe below makes the same compute call the value's page makes, with
 * the person's answers, and returns what the page would show. An input is
 * "inert" when no answer it accepts moves that result away from a typical
 * baseline. KNOWN_INERT is the list as it stands today; it is a ratchet:
 *
 *   - a new inert input fails here, because a new question that does nothing
 *     is a regression;
 *   - an input that starts working also fails here, so it is taken off the
 *     list and cannot quietly go back.
 *
 * When a page changes the call it makes, change its probe in the same commit.
 */

type Answers = Record<string, string>;

const BASE: Answers = {
  county: "Fulton", ownership: "none", price: "300000", downPct: "3.5",
  savings: "10000", monthlySaving: "500", income: "70000", household: "3",
  occupation: "other", comfort: "2200", debts: "400",
  salePrice: "400000", payoff: "200000", commission: "5",
  roof: "10to20", systems: "working", finish: "lived", target: "24",
  homestead: "no", age65: "no", yearsOwned: "8", carrying: "2400",
  status: "foreign", use: "rent",
};

/** The answers each input accepts, or a spread across its range for amounts. */
const TRY: Partial<Record<InputKey, string[]>> = {
  county: ["DeKalb", "Cobb", "Gwinnett", "Clayton", "Cherokee", "Chatham", "Richmond", "Bibb"],
  ownership: ["primary", "investment"],
  price: ["150000", "450000", "900000"],
  downPct: ["3", "5", "10", "20"],
  savings: ["0", "40000", "200000"],
  monthlySaving: ["0", "150", "2000"],
  income: ["30000", "150000", "400000"],
  household: ["1", "2", "4", "6", "8"],
  occupation: ["educator", "safety", "health", "military"],
  comfort: ["1200", "3500", "8000"],
  debts: ["0", "1500"],
  salePrice: ["250000", "800000"],
  payoff: ["0", "450000"],
  commission: ["none", "2", "6"],
  roof: ["under10", "over20", "unsure"],
  systems: ["broken", "unsure"],
  finish: ["fresh", "worn"],
  status: ["citizen", "resident", "itin"],
  target: ["6", "12", "36", "exploring"],
  homestead: ["yes", "unsure"],
  carrying: ["0", "4000"],
  age65: ["yes"],
  yearsOwned: ["1", "3", "15"],
  use: ["live"],
};

const n = (a: Answers, k: string) => Number(a[k]);
const commission = (a: Answers) => (a.commission === "none" ? null : n(a, "commission"));
const RATE = 6.5;

function assistance(a: Answers) {
  return matchAssistance({
    county: a.county, firstTime: firstTimeFrom(a.ownership as Ownership), price: n(a, "price"),
    income: n(a, "income"), household: n(a, "household"), occupation: a.occupation as Occupation | "other",
  }, { today: new Date("2026-10-01T12:00:00Z"), windowDays: 36_500, programs: GEORGIA_PROGRAMS });
}

/** One per value, mirroring the call on the value's page. */
const PROBES: Record<string, (a: Answers) => unknown> = {
  assistance: (a) => {
    const r = assistance(a);
    return { m: r.matches.map((x) => [x.program.slug, x.amount, x.checks.map((c) => c.state)]), c: r.combination?.total ?? null };
  },
  cash: (a) => cashToClose({ ...BUYER_DEFAULTS, price: n(a, "price"), downPct: n(a, "downPct"), county: a.county, assistance: 0 }),
  monthly: (a) => monthlyComputed({ ...BUYER_DEFAULTS, price: n(a, "price"), downPct: n(a, "downPct"), county: a.county, ratePct: RATE, assistance: 0 }),
  timeline: (a) => {
    const i = { ...BUYER_DEFAULTS, price: n(a, "price"), downPct: n(a, "downPct"), savings: n(a, "savings"), monthlySaving: n(a, "monthlySaving"), assistance: 0 };
    return { g: cashGap(i), l: gapLevers(i), p: timelinePlan(i, a.target === "exploring" ? "exploring" : n(a, "target")) };
  },
  afford: (a) => affordability({ income: n(a, "income"), debts: n(a, "debts"), comfort: n(a, "comfort"), downPct: n(a, "downPct"), ratePct: RATE, savings: n(a, "savings") }),
  lender: (a) => lenderQuestions({ price: n(a, "price"), downPct: n(a, "downPct"), firstTime: firstTimeFrom(a.ownership as Ownership), matches: [], combination: null }),
  proceeds: (a) => sellerNet({ price: n(a, "salePrice"), payoff: n(a, "payoff"), county: a.county, commissionPct: commission(a) }),
  unclaimed: (a) => unclaimedChecks({ homestead: a.homestead as UnclaimedAnswers["homestead"], age65: a.age65 as UnclaimedAnswers["age65"], yearsOwned: n(a, "yearsOwned") }, new Date("2026-10-13T15:00:00Z")),
  costs: (a) => controllableCosts({ price: n(a, "salePrice"), payoff: 0, county: a.county, commissionPct: commission(a) }, n(a, "carrying")),
  prepare: (a) => preparePlan({ roof: a.roof as Roof, systems: a.systems as Systems, finish: a.finish as Finish }),
  eligibility: (a) => statusById(a.status as StatusId),
  "abroad-cost": (a) => abroadReturns({ price: n(a, "price"), county: a.county, status: a.status as StatusId, use: a.use as Use }),
  "abroad-return": (a) => abroadReturns({ price: n(a, "price"), county: ABROAD_DEFAULTS.county, status: a.status as StatusId, use: a.use as Use }),
};

/**
 * Inputs that are asked and change nothing, today. Shrink this list; never
 * grow it. Each entry names the finding that explains it.
 */
const KNOWN_INERT: Record<string, InputKey[]> = {
  /* F1: property tax is a flat 1% and insurance a flat $1,650 in every
     county, so the county is printed in the sentence and used nowhere. */
  cash: ["county"],
  monthly: ["county"],
  proceeds: ["county"],
  costs: ["county"],
};

function inert(id: string): InputKey[] {
  const def = VALUES.find((v) => v.id === id)!;
  const probe = PROBES[id];
  const base = JSON.stringify(probe(BASE));
  return def.asks.filter((k) => {
    const options = TRY[k];
    if (!options?.length) throw new Error(`No answers to try for "${k}": add them to TRY`);
    return options.every((v) => JSON.stringify(probe({ ...BASE, [k]: v })) === base);
  });
}

describe("value inputs", () => {
  it("has a probe for every value that asks anything", () => {
    const asking = VALUES.filter((v) => v.asks.length).map((v) => v.id).sort();
    expect(Object.keys(PROBES).sort()).toEqual(asking);
  });

  for (const v of VALUES.filter((x) => x.asks.length)) {
    it(`${v.id}: every question it asks can change its answer, apart from the known list`, () => {
      expect(inert(v.id), `${v.id} asks for an input its answer never reads`).toEqual(KNOWN_INERT[v.id] ?? []);
    });
  }
});
