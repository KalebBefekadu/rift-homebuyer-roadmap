import type { Metadata } from "next";
import { Noto_Sans_Ethiopic } from "next/font/google";
import "../styles/rift.css";
import { siteUrl } from "@/lib/core/site";
import { currentAgentPublic } from "@/lib/db/service";
import { AgentProvider } from "@/components/rift/site/Agent";
import { Fonts } from "@/components/rift/Fonts";

/**
 * Ethiopic, self-hosted.
 *
 * This used to be a <link> to fonts.googleapis.com, which is two round trips
 * before a single Amharic glyph can be painted: the stylesheet, then the font
 *: to a third party, on every page load. The readers who need this face are
 * the ones most likely to be on a slow connection a long way from the nearest
 * edge, so it is exactly the wrong thing to make them wait on. Next fetches it
 * at build time and serves it from our own origin.
 *
 * `swap`, deliberately. The alternative is a blank page while the font
 * arrives; a moment of fallback type is better than a moment of nothing, and
 * the fallback stack in lib/core/i18n.ts still carries the glyphs.
 */
const ethiopic = Noto_Sans_Ethiopic({
  subsets: ["ethiopic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ethiopic",
});

const base = siteUrl();

export const metadata: Metadata = {
  /* Without this every relative URL Next generates: the share card, the
     canonical link: resolves against localhost, and a card that points at
     localhost does not render in anybody's message. */
  ...(base ? { metadataBase: new URL(base) } : {}),
  title: { default: "Rift", template: "%s · Rift" },
  description:
    "Know the real number before you talk to anyone. A complete, computed readout of what buying actually takes. Free, and yours to keep.",
  /* Inherited by every page in the group, so a new page gets a real unfurl
     without having to remember to ask for one. Per-page titles and
     descriptions flow into these automatically; only the image is declared,
     and it comes from the opengraph-image beside each route. */
  openGraph: {
    type: "website",
    siteName: "Rift",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
};

/**
 * The public product shell.
 *
 * The stylesheet (app/styles/rift.css) is scoped under `.rift`, so nothing in
 * it collides with app/globals.css. It started as the September prototype's;
 * the prototype was deleted on 13 October 2026, once every screen had a live
 * replacement.
 */
export default async function RiftLayout({ children }: { children: React.ReactNode }) {
  /* Who the pages are from, once for all of them (D40). Cached five minutes
     per instance, and null rather than slow: the footer then says what it
     said before it read Settings. */
  const agent = await currentAgentPublic().catch(() => null);
  return (
    <AgentProvider agent={agent}>
    <div className={`rift ${ethiopic.variable}`}>
      {/* Third-party for now; see components/rift/Fonts.tsx. */}
      <Fonts preconnect />
      {children}
    </div>
    </AgentProvider>
  );
}
