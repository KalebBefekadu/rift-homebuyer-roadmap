import { NextResponse } from "next/server";
import { limited, readJson } from "@/lib/db/guard";
import { SCOPES, type Role, type Scope, type Side } from "@/lib/core/journey";
import { CADENCE_LABEL, EMPTY_FACTS, type Cadence, type PropertyFacts, type SearchBrief } from "@/lib/core/search";
import {
  startJourney, relabelJourney, saveBrief, approveSearch, confirmSearchSetUp, pauseSearch,
  inviteMember, newInviteLink, withdrawAccess, addShortlistHome, takeHomeOff,
  requestShowing, recordShowingStep, recordShowingAnswer,
  moveStage, setJourneyStatus, openContract, closeContract, updateWork,
} from "@/app/(studio)/studio/journey/ops";
import { TOUR_STATUSES, type TourStatus } from "@/lib/core/tour";
import {
  JOURNEY_STATUSES, STAGES, WORKSTREAMS, WORK_STATES,
  type JourneyStatus, type Owner, type Stage, type WorkState, type Workstream,
} from "@/lib/core/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Every write on the Operations journey page, and starting a journey from the
 * lead record. Why a route and not server actions is on journey/ops.ts.
 *
 * Each op re-checks the agent's session itself (ops.ts `gate`). This file
 * only checks that the request came from Rift's own pages and that every
 * field is the type the op expects: the browser supplies ids and words,
 * never identity.
 */

type Body = Record<string, unknown>;
const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : -1);
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

const SIDES: Side[] = ["buy", "sell"];
const ROLES: Role[] = ["buyer", "co-buyer", "viewer"];
const CADENCES = Object.keys(CADENCE_LABEL) as Cadence[];

/**
 * Server actions refuse a request whose Origin is another site; this route
 * does the same. The session cookie is SameSite=Lax, so a cross-site POST
 * carries no session anyway; this is the second lock.
 */
function foreign(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "cross-site";
  try {
    return new URL(origin).host !== req.headers.get("host");
  } catch {
    return true;
  }
}

function brief(v: unknown): SearchBrief | null {
  const b = v as Partial<SearchBrief> | null;
  if (!b || typeof b !== "object" || !Array.isArray(b.criteria) || !Array.isArray(b.questions)) return null;
  return { criteria: b.criteria, questions: b.questions.filter((q): q is string => typeof q === "string") } as SearchBrief;
}

function facts(v: unknown): PropertyFacts {
  /* Only the known facts, whatever else was posted: this becomes jsonb. */
  const given = (v ?? {}) as Record<string, unknown>;
  return Object.fromEntries((Object.keys(EMPTY_FACTS) as (keyof PropertyFacts)[]).map((k) => [k, given[k] ?? null])) as unknown as PropertyFacts;
}

export async function POST(req: Request) {
  if (foreign(req)) return json({ ok: false, error: "Refused." }, 403);
  const refused = limited(req, "app");
  if (refused) return refused;

  const body = await readJson(req);
  if (!body.ok) return body.res;
  const b = (body.body ?? {}) as Body;
  const journeyId = str(b.journeyId, 40);

  switch (str(b.op, 40)) {
    case "start": {
      const side = str(b.side, 8) as Side;
      if (!SIDES.includes(side)) return json({ ok: false, error: "Choose buying or selling." }, 400);
      return json(await startJourney(str(b.leadId, 40), side, str(b.label, 200)));
    }
    case "relabel":
      return json(await relabelJourney(journeyId, str(b.label, 200)));
    case "save-brief": {
      const given = brief(b.brief);
      if (!given) return json({ ok: false, error: "The brief is malformed. Reload and try again" }, 400);
      return json(await saveBrief(journeyId, given, num(b.expectedLatest), str(b.note, 2000) || null));
    }
    case "approve": {
      const cadence = str(b.cadence, 10) as Cadence;
      if (!CADENCES.includes(cadence)) return json({ ok: false, error: "Choose how often it runs." }, 400);
      return json(await approveSearch(journeyId, str(b.revisionId, 40), cadence, str(b.requestId, 40)));
    }
    case "confirm-setup":
      return json(await confirmSearchSetUp(
        journeyId, str(b.packageId, 40), str(b.ref, 200), str(b.url, 500), str(b.note, 1000), str(b.requestId, 40),
      ));
    case "pause":
      return json(await pauseSearch(journeyId, str(b.packageId, 40), b.paused === true));
    case "invite": {
      const role = str(b.role, 12) as Role;
      if (!ROLES.includes(role)) return json({ ok: false, error: "Choose what they are to the journey." }, 400);
      const scopes = (Array.isArray(b.scopes) ? b.scopes : []).filter((s): s is Scope => SCOPES.includes(s as Scope));
      return json(await inviteMember(journeyId, { email: str(b.email, 254), name: str(b.name, 200), role, scopes }));
    }
    case "new-link":
      return json(await newInviteLink(journeyId, str(b.memberId, 40)));
    case "withdraw":
      return json(await withdrawAccess(journeyId, str(b.memberId, 40)));
    case "add-home": {
      const h = (b.home ?? {}) as Body;
      return json(await addShortlistHome(journeyId, {
        address: str(h.address, 200), url: str(h.url, 500), facts: facts(h.facts),
        factsSource: str(h.factsSource, 200), factsAsOf: str(h.factsAsOf, 10),
      }));
    }
    case "tour-request":
      return json(await requestShowing(journeyId, str(b.homeId, 40), str(b.availability, 300) || null, str(b.requestId, 40)));
    case "tour-step": {
      const to = str(b.to, 30) as TourStatus;
      if (!TOUR_STATUSES.includes(to)) return json({ ok: false, error: "That is not a step a showing can take." }, 400);
      return json(await recordShowingStep(journeyId, str(b.stopId, 40), {
        to, startsAt: str(b.startsAt, 40) || null, endsAt: str(b.endsAt, 40) || null,
        ref: str(b.ref, 200) || null, note: str(b.note, 500) || null,
      }, num(b.expectedSeq), str(b.requestId, 40)));
    }
    case "tour-feedback": {
      const offer = str(b.offer, 10);
      if (!["yes", "maybe", "no"].includes(offer)) return json({ ok: false, error: "Choose an answer." }, 400);
      return json(await recordShowingAnswer(journeyId, str(b.stopId, 40), {
        offer: offer as "yes" | "maybe" | "no", reason: str(b.reason, 500) || null, searchChange: str(b.searchChange, 500) || null,
      }, str(b.onBehalfOf, 120)));
    }
    case "stage": {
      const to = str(b.to, 20) as Stage;
      if (!STAGES.includes(to)) return json({ ok: false, error: "Choose a stage." }, 400);
      return json(await moveStage(journeyId, to, str(b.reason, 500), str(b.evidence, 300) || null, num(b.expectedSeq), str(b.requestId, 40)));
    }
    case "status": {
      const to = str(b.to, 20) as JourneyStatus;
      if (!JOURNEY_STATUSES.includes(to)) return json({ ok: false, error: "Choose a status." }, 400);
      return json(await setJourneyStatus(journeyId, to, str(b.reason, 500), num(b.expectedSeq), str(b.requestId, 40)));
    }
    case "contract": {
      const financing = str(b.financing, 10);
      if (financing !== "financed" && financing !== "cash") return json({ ok: false, error: "Say whether it is financed or cash." }, 400);
      return json(await openContract(journeyId, { homeId: str(b.homeId, 40), financing, evidence: str(b.evidence, 300) },
        num(b.expectedSeq), str(b.requestId, 40)));
    }
    case "end-contract": {
      const outcome = str(b.outcome, 12);
      if (outcome !== "closed" && outcome !== "terminated") return json({ ok: false, error: "Say whether it closed or was terminated." }, 400);
      const backTo = str(b.backTo, 20) as Stage;
      return json(await closeContract(journeyId, str(b.contractId, 40), outcome, str(b.reason, 500),
        STAGES.includes(backTo) ? backTo : null, num(b.expectedSeq), str(b.requestId, 40)));
    }
    case "work": {
      const workstream = str(b.workstream, 20) as Workstream;
      const state = str(b.state, 20) as WorkState;
      const owner = str(b.owner, 10) as Owner;
      if (!WORKSTREAMS.includes(workstream) || !WORK_STATES.includes(state) || !["client", "agent", "other"].includes(owner)) {
        return json({ ok: false, error: "That update could not be read. Reload and try again." }, 400);
      }
      return json(await updateWork(journeyId, str(b.contractId, 40), workstream, {
        state, owner, ownerName: str(b.ownerName, 160) || null, source: str(b.source, 160) || null,
        confirmedOn: str(b.confirmedOn, 10) || null, note: str(b.note, 500) || null,
      }, num(b.expectedSeq), str(b.requestId, 40)));
    }
    case "take-off":
      return json(await takeHomeOff(journeyId, str(b.homeId, 40), str(b.reason, 500)));
    default:
      return json({ ok: false, error: "Unknown action." }, 400);
  }
}
