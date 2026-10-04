/**
 * The full Content-Security-Policy, and what a violation report may keep.
 *
 * Shipped as Content-Security-Policy-Report-Only beside the small policy that
 * is enforced (frame-ancestors, base-uri, form-action in next.config.ts). A
 * wrong directive in an enforced policy breaks sign-in or a document link for
 * real people with nothing in the logs; in report-only it breaks nothing and
 * says what it would have blocked. Once the reports are quiet it can be
 * enforced by moving it to the other header.
 *
 * No nonce, so inline scripts are allowed: Next's own bootstrap is inline,
 * and a nonce makes every page dynamic, which would cost the public funnel
 * its static first byte. What this still buys is the origin list. A script or
 * a request to anywhere not named here is reported (and, once enforced,
 * refused), which is what stops an injected tag sending somebody's finances
 * elsewhere.
 *
 * Pure: next.config.ts and the report route both import it.
 */

export function contentSecurityPolicy(i: { supabaseUrl?: string | null; dev?: boolean }): string {
  const supabase = originOf(i.supabaseUrl ?? "");
  const connect = ["'self'"];
  if (supabase) connect.push(supabase, supabase.replace(/^http/, "ws"));
  if (i.dev) connect.push("ws:", "http://localhost:*");

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${i.dev ? " 'unsafe-eval'" : ""}`,
    /* Fontshare's stylesheet and files: the one third party, until the
       fonts are self-hosted (platform audit #29). */
    "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
    "font-src 'self' data: https://cdn.fontshare.com",
    "img-src 'self' data: blob:",
    `connect-src ${connect.join(" ")}`,
    "frame-src 'none'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "report-uri /api/csp-report",
  ].join("; ");
}

const originOf = (url: string) => {
  try { return url ? new URL(url).origin : null; } catch { return null; }
};

/**
 * The part of a violation report worth keeping: which directive, and the
 * origin (or keyword) that was blocked. Never the page's address, never a
 * path, never a query: on a plan or readout page the address IS the secret
 * (a capability link), and a report carries it in full.
 *
 * Accepts both shapes browsers send: the legacy `{"csp-report": {...}}` and
 * the Reporting API's `[{type: "csp-violation", body: {...}}]`.
 */
export function cspViolation(raw: unknown): { directive: string; blocked: string } | null {
  const report = Array.isArray(raw)
    ? (raw.find((r) => r && typeof r === "object" && (r as Record<string, unknown>).type === "csp-violation") as Record<string, unknown> | undefined)?.body
    : raw && typeof raw === "object" ? (raw as Record<string, unknown>)["csp-report"] : null;
  if (!report || typeof report !== "object") return null;
  const r = report as Record<string, unknown>;

  const directive = String(r["effective-directive"] ?? r.effectiveDirective ?? r["violated-directive"] ?? "").split(" ")[0];
  if (!/^[a-z-]{3,40}$/.test(directive)) return null;

  const uri = String(r["blocked-uri"] ?? r.blockedURL ?? "");
  const keyword = /^(inline|eval|data|blob|self|wasm-eval|trusted-types-policy)$/.test(uri) ? uri : null;
  const blocked = keyword ?? originOf(uri) ?? (uri ? "other" : "unknown");
  return { directive, blocked };
}
