import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Own property in Georgia from anywhere";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card this page becomes when somebody pastes the link.
 *
 * This audience shares in WhatsApp and Telegram groups, where an unfurled card
 * is most of the decision to tap. Without one the product arrives as a bare
 * URL among forwarded messages. Both scripts appear, because the person
 * forwarding it is usually vouching for it to someone who reads one of them.
 */
export default async function Image() {
  /* The image renderer ships no Ethiopic face, so Amharic arrives as tofu —
     empty boxes, in a card whose whole job is to say this page speaks your
     language. Bundled rather than fetched: this runs on every unfurl, and a
     card that depends on a third-party font request is a card that sometimes
     renders wrong in someone's group chat. */
  const ethiopic = await readFile(
    join(process.cwd(), "assets/fonts/NotoSansEthiopic-SemiBold.ttf"),
  );

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", background: "#fbfaf8", padding: 72,
        fontFamily: "sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, background: "#111",
            color: "#fff", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 21, fontWeight: 700,
          }}>R</div>
          <div style={{ fontSize: 27, fontWeight: 600, color: "#111" }}>Rift</div>
          <div style={{
            marginLeft: 8, fontSize: 17, color: "#b4402a", display: "flex", gap: 6,
            border: "1px solid #e8d9d4", borderRadius: 999, padding: "4px 14px",
          }}>
            <span>From abroad ·</span>
            <span style={{ fontFamily: "Noto Sans Ethiopic" }}>ከውጭ አገር</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 62, lineHeight: 1.08, color: "#111", letterSpacing: -1.5, maxWidth: 940 }}>
            You don&apos;t need a green card to own property in Georgia.
          </div>
          <div style={{ fontSize: 30, color: "#5c5852", maxWidth: 880 }}>
            See what you would have to send, what it would rent for, and what comes back.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 22, color: "#7a756e", display: "flex", gap: 6 }}>
            <span>Free · no account · English &amp;</span>
            <span style={{ fontFamily: "Noto Sans Ethiopic" }}>አማርኛ</span>
          </div>
          <div style={{ fontSize: 22, color: "#7a756e" }}>Kaleb Befekadu · Georgia</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Noto Sans Ethiopic", data: ethiopic, style: "normal", weight: 600 }],
    },
  );
}
