import { ImageResponse } from "next/og";
import { Card, OG_SIZE, OG_CONTENT_TYPE } from "@/components/rift/og";

export const alt = "Know what buying a home in Georgia actually takes";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * The buyer card.
 *
 * It leads with the correction rather than the offer, because the reader
 * already believes they know the number and the only reason to tap is being
 * told they do not. "Free readout" is what everyone else's card says.
 */
export default function Image() {
  return new ImageResponse(
    (
      <Card
        chip="For buyers"
        headline="The down payment is not the number."
        sub="Cash to close, the Georgia assistance you may qualify for, and how far away you actually are."
      />
    ),
    size,
  );
}
