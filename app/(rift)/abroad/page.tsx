import type { Metadata } from "next";
import { Suspense } from "react";
import { GA_COUNTIES } from "@/lib/core/registry";
import { parseAbroadParams } from "@/lib/core/abroad";
import { isLocale, type Locale } from "@/lib/core/i18n";
import { AgentSchema } from "@/components/rift/Agent";
import { Landing } from "./Landing";

export const metadata: Metadata = {
  title: "Own property in Georgia from anywhere",
  description:
    "You do not need to be a U.S. citizen, hold a green card, or ever have lived in America to own property in Georgia. See what you would have to send, what it would rent for, and what comes back. Free, before you talk to anyone.",
  /* The Amharic pass is a real, addressable version of this page, not a widget
     on top of the English one. Declaring it means a search engine can offer it
     to somebody searching in Amharic, which is most of the point of having
     written it. */
  alternates: {
    canonical: "/abroad",
    languages: { en: "/abroad", am: "/abroad?lang=am", "x-default": "/abroad" },
  },
  openGraph: { locale: "en_US", alternateLocale: ["am_ET"] },
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

  /* Resolved here rather than in the browser. When the toggle was the only way
     in, the server always rendered English and the switch happened after
     hydration, so a crawler saw no Amharic at all, and an Amharic reader
     watched the page load in English and then change under them. */
  const langParam = one("lang");
  const pinned = isLocale(langParam);
  const locale: Locale = pinned ? langParam : "en";

  return (
    <Suspense>
      {/* The entity, on the page most likely to be found by somebody who has
          never heard of the agent and is searching in another language. */}
      <AgentSchema />
      <Landing
        counties={GA_COUNTIES}
        initial={initial}
        initialLocale={locale}
        localePinned={pinned}
      />
    </Suspense>
  );
}
