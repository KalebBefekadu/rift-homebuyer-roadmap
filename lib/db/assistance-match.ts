import "server-only";
import { matchAssistance, type AssistanceResult, type Occupation } from "@/lib/core/assistance";
import { firstTimeFrom, type Ownership } from "@/lib/core/funnel";
import { hasAll, type Answers } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { rulesOrDefaults } from "./settings";
import { currentAgentId } from "./service";
import { currentPrograms } from "./program-checks";

/** The answers the assistance value needs, in its order. */
export const ASSISTANCE_KEYS = valueById("assistance")!.asks as InputKey[];

/**
 * The assistance match for a set of answers, the same way the assistance
 * value works it out: the agent's registry window and the programs as
 * reviewed. Null unless every assistance answer is there, so another value
 * never guesses a match from part of a profile.
 */
export async function matchFromAnswers(a: Answers): Promise<AssistanceResult | null> {
  if (!hasAll(a, ASSISTANCE_KEYS)) return null;
  const [{ rules }, programs] = await Promise.all([rulesOrDefaults(await currentAgentId()), currentPrograms()]);
  return matchAssistance({
    county: String(a.county),
    firstTime: firstTimeFrom(String(a.ownership) as Ownership),
    price: Number(a.price),
    income: Number(a.income),
    household: Number(a.household),
    occupation: String(a.occupation) as Occupation | "other",
  }, { today: new Date(), windowDays: rules.registryDays.value, programs });
}
