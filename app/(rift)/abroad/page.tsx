import type { Metadata } from "next";
import { Suspense } from "react";
import { GA_COUNTIES } from "@/lib/core/registry";
import { parseAbroadParams } from "@/lib/core/abroad";
import { Landing } from "./Landing";

export const metadata: Metadata = {
  title: "Own property in Georgia from anywhere",
  description:
    "You do not need to be a U.S. citizen, hold a green card, or ever have lived in America to own property in Georgia. See what you would have to send, what it would rent for, and what comes back — free, before you talk to anyone.",
};

/* Rates move; the rest is arithmetic on published figures. An hour is short
   enough to stay honest about the rate and long enough to stay cheap. */
export const dynamic = "force-dynamic";

/* The readout links back here to change an answer. Without reading those
   answers back the link is a reset button: you return to the page having lost
   the four things you just told it, which is the same failure as being asked a
   question twice. */
export default async function AbroadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const initial = parseAbroadParams(one, GA_COUNTIES);

  return (
    <Suspense>
      <Landing counties={GA_COUNTIES} initial={initial} />
    </Suspense>
  );
}
