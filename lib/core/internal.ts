/**
 * Which surfaces exist only for the people building this.
 *
 * Two routes were reachable by anybody who typed them:
 *
 *   `/dev` is the build index. It says, in plain English, which parts of the
 *   product are real and which are specification. That is the right thing to
 *   tell a contributor and the wrong thing to tell a stranger who is deciding
 *   whether to hand this site their finances.
 *
 *   `/prototype/*` is the specification: forty screens of invented clients,
 *   invented offers and an invented budget, on the same host and in the same
 *   typeface as the real product. Someone who lands there cannot tell that the
 *   names are fiction, and nothing on the page says so.
 *
 * `robots.txt` already disallowed both. A disallow is a request to crawlers,
 * not access control — it keeps a page out of an index while leaving it served
 * to anybody with the URL, which is the weaker half of the problem.
 *
 * This is the same shape as the refusal in `app/api/dev/email-preview`, which
 * had it right first: closed in production, open everywhere else, with one
 * documented way to open it deliberately.
 */

export interface InternalEnv {
  NODE_ENV?: string;
  /** Set to "1" to serve the internal surfaces from a production build. */
  RIFT_INTERNAL?: string;
}

/**
 * True when `/dev` and `/prototype/*` should answer 404.
 *
 * Deliberately closed by default rather than gated on an opt-out: a surface
 * that leaks when a variable is *missing* leaks on the first deployment that
 * forgets it, and nobody notices, because a page that renders looks exactly
 * like a page that is supposed to render.
 */
export function internalHidden(env: InternalEnv): boolean {
  if (env.RIFT_INTERNAL === "1") return false;
  /* Note the direction: this asks whether we are positively somewhere these
     pages belong, not whether we are positively in production. An environment
     nobody anticipated — an unset NODE_ENV, a preview runner, a new host —
     lands on "hidden", which is dull. The other direction lands on "served",
     and a page that renders looks exactly like a page that is meant to. */
  return env.NODE_ENV !== "development" && env.NODE_ENV !== "test";
}
