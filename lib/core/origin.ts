/**
 * The address the browser used, for a redirect back to it.
 *
 * `request.url` can carry the server's own bind address (localhost behind a
 * proxy, or `next start --hostname 127.0.0.1` reached as either name). A
 * redirect there leaves the person on a host they are not signed in on, and
 * after a form post the browser refuses it outright: the site's CSP says
 * `form-action 'self'`, which Chrome applies to the redirect too. Sign out
 * did nothing at all for that reason, found by the real-auth suite (WS1.8).
 */
export function originOf(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}
