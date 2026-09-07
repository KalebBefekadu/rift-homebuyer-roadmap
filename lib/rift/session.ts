"use client";

/**
 * The visitor's session id.
 *
 * One id per browser session, stored in sessionStorage so it dies with the tab.
 * It is not an identity and must never become one: it exists so that "how many
 * people reached question four" counts people rather than page views, and so an
 * abandoned assessment can be resumed on the same device.
 *
 * Deliberately NOT a cookie and deliberately not persistent. A durable
 * cross-session identifier for anonymous visitors is a tracking decision, and
 * this product has not made one.
 */

const KEY = "rift.sid";

export function sessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let s = window.sessionStorage.getItem(KEY);
    if (!s) {
      s = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(KEY, s);
    }
    return s;
  } catch {
    /* Private mode, or storage disabled. A per-page id still lets a single
       assessment hang together; it just cannot survive a reload. */
    return "anon";
  }
}
