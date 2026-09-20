import { ImageResponse } from "next/og";
import { Card, OG_SIZE, OG_CONTENT_TYPE } from "@/components/rift/og";

export const alt = "Know the real number before you talk to anyone";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/**
 * The default card for everything under the public shell.
 *
 * Sitting at the route-group root means a page that never thinks about its own
 * card still gets a real one, rather than the bare URL every page but /abroad
 * was unfurling as. Buyers, sellers and buyers abroad override it with a
 * promise specific to them.
 */
export default function Image() {
  return new ImageResponse(
    (
      <Card
        headline="Know the real number before you talk to anyone."
        sub="What buying or selling a home in Georgia actually takes, computed from your own situation."
      />
    ),
    size,
  );
}
