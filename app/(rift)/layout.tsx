import type { Metadata } from "next";
import "../prototype/rift.css";

export const metadata: Metadata = {
  title: { default: "Rift", template: "%s · Rift" },
  description:
    "Know the real number before you talk to anyone. A complete, computed readout of what buying actually takes — free, and yours to keep.",
};

/**
 * The public product shell.
 *
 * Shares the design system with the specification rather than forking it. The
 * stylesheet is scoped under `.rift`, so the two can coexist while screens are
 * migrated one at a time — which is the migration rule in docs/architecture.md:
 * a prototype screen is deleted when its production replacement is live and has
 * been checked against it, never as a tree.
 */
export default function RiftLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rift">
      <link
        rel="stylesheet"
        href="https://api.fontshare.com/v2/css?f%5B%5D=switzer@400,500,600,700&f%5B%5D=zodiak@300,400,500&display=swap"
      />
      {children}
    </div>
  );
}
