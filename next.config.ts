import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Headers the platform does not set for you.
 *
 * None of these were here, which meant every one of them was whatever the
 * browser's default happened to be. Three are the ordinary hardening any site
 * handling somebody's finances should have; the fourth is specific to this
 * product and is the one worth reading.
 *
 * A Rift readout URL is a capability. `/r/<token>` is unguessable on purpose:
 * that is the whole security model for a document somebody can share, and a
 * URL that is a secret must not travel in a Referer header. The browser
 * default (`strict-origin-when-cross-origin`) sends only the origin to another
 * site, so the token does not leak today; but it sends the FULL URL to any
 * same-origin destination, and it is one policy change or one embedded
 * third-party widget away from sending the token somewhere. `no-referrer` on
 * the pages that carry a person's situation costs nothing: there is no
 * analytics here that wants a referrer, and removes the question.
 */
const SECURITY_HEADERS = [
  /* Trust the declared type. Without this a browser may sniff an uploaded or
     proxied response into something executable. */
  { key: "X-Content-Type-Options", value: "nosniff" },
  /* Nothing here should ever be framed; a booking form in an iframe on
     somebody else's page is a clickjacking surface with real consequences. */
  { key: "X-Frame-Options", value: "DENY" },
  /* The same rule for browsers that prefer CSP, plus two directives that are
     safe without a nonce: a form cannot be repointed at another origin, and a
     <base> tag cannot rewrite every relative URL on the page. A full CSP needs
     nonced inline scripts and is a separate, larger piece of work. */
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  /* Nothing in this product uses any of them. Asking for none is how it stays
     true when somebody adds a dependency that does. */
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

/** The pages whose URL is itself private information. `/plan` and `/app` were
 *  added with the blueprint v4 review (finding: "/plan/:token* is not in the
 *  no-referrer list"): a plan link and an invitation link are both credentials,
 *  and a buyer's signed-in pages name their journey in the path. */
const PRIVATE_PAGES = [
  "/r/:token*", "/buy/results", "/sell/results", "/abroad/results", "/book",
  "/plan/:token*", "/app/:path*", "/app",
];

const nextConfig: NextConfig = {
  /* Stop naming the framework and its major version on every response. It
     tells an attacker which advisories to try first and tells a visitor
     nothing. */
  poweredByHeader: false,

  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      ...PRIVATE_PAGES.map((source) => ({
        source,
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      })),
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Suppress non-CI output (Sentry Next.js skill default)
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Proxy envelope through the app to reduce ad-blocker drops
  tunnelRoute: "/monitoring",
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
