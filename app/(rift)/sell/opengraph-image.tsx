import { ImageResponse } from "next/og";
import { Card, OG_SIZE, OG_CONTENT_TYPE } from "@/components/rift/og";

export const alt = "Know what selling a home in Georgia actually leaves you";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** The seller card. Same move as the buyer's, mirrored: the figure they are
 *  carrying around is a list price, and it is not what reaches them. */
export default function Image() {
  return new ImageResponse(
    (
      <Card
        chip="For sellers"
        headline="Every valuation you've been given is a list price."
        sub="See what actually reaches you after payoff, commission, concessions and transfer tax."
      />
    ),
    size,
  );
}
