import type { Metadata } from "next";
import Link from "next/link";
import { CAUTION } from "@/lib/core/assistance";
import { programsToday } from "@/lib/db/program-checks";
import { GA_COUNTIES } from "@/lib/core/registry";
import { rulesOrDefaults } from "@/lib/db/settings";
import { currentAgentId } from "@/lib/db/service";
import { SiteHeader } from "@/components/rift/site/SiteHeader";
import { SiteFooter } from "@/components/rift/site/SiteFooter";
import { Ico } from "@/components/rift/icons";
import { ProgramTable } from "./ProgramTable";

export const metadata: Metadata = {
  title: "Georgia programs that help you buy a home",
  description:
    "Georgia down payment assistance programs from the state, counties, cities and banks, each with its official source and the date it was last checked. Filter and sort them yourself.",
};

export const revalidate = 3600;

/**
 * Georgia programs (Blueprint v5 §5.8, §6.7).
 *
 * The table is free (D14). What asks for details is the personal plan, and
 * the value that checks a person's own answers against every rule is one
 * click away and free too. A program past its review date is withheld here
 * as everywhere, and the page says how many.
 */
export default async function ProgramsPage() {
  const { rules } = await rulesOrDefaults(await currentAgentId());
  const today = new Date();
  const window = rules.registryDays.value;
  const t = await programsToday(today, window);
  const shown = t.shown;
  const withheld = t.stale.length + t.withdrawn.length;
  const found = t.found.length;

  return (
    <div className="buy">
      <SiteHeader side="buy" current="/buy/programs" />
      <main className="shell-w">
        <section className="sec-sm">
          <div className="kicker c-brand">Down payment help</div>
          <h1 className="serif d2 mt-2">Georgia programs</h1>
          <p className="lede mt-3 measure">
            Help from the state, counties, cities and banks, each checked against its official page.
          </p>
          <div className="card p-5 between wrap gap-3 mt-4" style={{ background: "var(--brand-wash)", borderColor: "var(--brand-line)" }}>
            <div className="measure">
              <div className="t-md w6">Which of these fit you?</div>
              <p className="t-sm c-2" style={{ marginTop: 4 }}>Six quick questions check your answers against every rule, and show what still needs confirming.</p>
            </div>
            <Link href="/buy/assistance" className="btn btn-brand btn-lg">See which programs fit me<Ico.arrowR size={15} /></Link>
          </div>
        </section>

        <section className="sec-sm">
          <ProgramTable programs={shown} counties={GA_COUNTIES} />
          <p className="t-xs c-4 mt-3 measure" style={{ lineHeight: 1.6 }}>
            {CAUTION} Amounts are the most each program offers; what you could receive depends on its rules.
            {withheld ? ` ${withheld} program${withheld === 1 ? " is" : "s are"} not shown because ${withheld === 1 ? "it is" : "they are"} due to be checked again.` : ""}
            {found ? ` ${found} more ${found === 1 ? "has" : "have"} been found but not yet confirmed from an official source, so ${found === 1 ? "is" : "are"} not listed.` : ""}
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
