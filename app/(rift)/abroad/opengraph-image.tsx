import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { Card, OG_SIZE, OG_CONTENT_TYPE } from "@/components/rift/og";

export const alt = "Own property in Georgia from anywhere";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * The card this page becomes when somebody pastes the link.
 *
 * This audience shares in WhatsApp and Telegram groups, where an unfurled card
 * is most of the decision to tap. Both scripts appear, because the person
 * forwarding it is usually vouching for it to someone who reads one of them.
 */
export default async function Image() {
  /* The image renderer ships no Ethiopic face, so Amharic arrives as tofu:
     empty boxes, in a card whose whole job is to say this page speaks your
     language. Bundled rather than fetched: this runs on every unfurl, and a
     card that depends on a third-party font request is a card that sometimes
     renders wrong in someone's group chat. */
  const ethiopic = await readFile(
    join(process.cwd(), "assets/fonts/NotoSansEthiopic-SemiBold.ttf"),
  );

  return new ImageResponse(
    (
      <Card
        chip={
          <>
            {/* The space is inside the string, as a non-breaking space. The
                two scripts need separate spans for the font switch, and
                satori does not apply `gap` between them: so relying on the
                layout to separate them renders "From abroad ·ከውጭ አገር". */}
            <span>{"From abroad ·\u00A0"}</span>
            <span style={{ fontFamily: "Noto Sans Ethiopic" }}>ከውጭ አገር</span>
          </>
        }
        headline="You don't need a green card to own property in Georgia."
        sub="See what you would have to send, what it would rent for, and what comes back."
        foot={
          <>
            <span>{"Free · no account · English &\u00A0"}</span>
            <span style={{ fontFamily: "Noto Sans Ethiopic" }}>አማርኛ</span>
          </>
        }
      />
    ),
    {
      ...size,
      fonts: [{ name: "Noto Sans Ethiopic", data: ethiopic, style: "normal", weight: 600 }],
    },
  );
}
