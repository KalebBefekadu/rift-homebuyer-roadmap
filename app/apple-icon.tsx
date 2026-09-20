import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * The home-screen icon, as a PNG.
 *
 * iOS ignores an SVG `apple-touch-icon` and falls back to a screenshot of the
 * page, so `app/icon.svg` — which every other browser is happy with — is not
 * enough on the one platform where somebody is most likely to save this to a
 * home screen and come back to it.
 *
 * Generated rather than committed as a binary: the mark is drawn once, here
 * and in `app/icon.svg`, and a checked-in PNG is the copy that silently stops
 * matching the other two.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          /* Opaque. iOS composites this onto the home screen with no backdrop
             of its own, and a transparent icon there renders as a black hole. */
          background: "#0d0e10",
        }}
      >
        <svg width="112" height="112" viewBox="0 0 24 24">
          <path
            d="M4 21V3h7.4c3.5 0 5.9 2 5.9 5.2 0 2.5-1.5 4.3-3.9 4.9L21 21h-4.3l-4.9-7.3h-3.4V21H4Z"
            fill="#ffffff"
          />
          <path
            d="M8.4 6.5v4.1h2.8c1.4 0 2.3-.8 2.3-2.05S12.6 6.5 11.2 6.5H8.4Z"
            fill="#0d0e10"
          />
        </svg>
      </div>
    ),
    size,
  );
}
