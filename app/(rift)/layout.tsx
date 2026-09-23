import type { Metadata } from "next";
import { Noto_Sans_Ethiopic } from "next/font/google";
import "../prototype/rift.css";
import { siteUrl } from "@/lib/core/site";

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
 * Shares the design system with the specification rather than forking it. The
 * stylesheet is scoped under `.rift`, so the two can coexist while screens are
 * migrated one at a time, which is the migration rule in docs/architecture.md:
 * a prototype screen is deleted when its production replacement is live and has
 * been checked against it, never as a tree.
 */
export default function RiftLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`rift ${ethiopic.variable}`}>
      {/* Switzer and Zodiak are not on Google Fonts, so this one stays a
          third-party request. The preconnects buy back the DNS lookup and TLS
          handshake, which is most of what it costs on a cold connection. */}
      <link rel="preconnect" href="https://api.fontshare.com" />
      <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://api.fontshare.com/v2/css?f%5B%5D=switzer@400,500,600,700&f%5B%5D=zodiak@300,400,500&display=swap"
      />
      {children}
    </div>
  );
}
