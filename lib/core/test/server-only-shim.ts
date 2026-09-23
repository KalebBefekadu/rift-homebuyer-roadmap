/**
 * A no-op stand-in for the `server-only` package, under test.
 *
 * The real package exists to make a bundler throw when a server module is
 * pulled into a client bundle. That protection is real and stays: it is
 * enforced by the Next build and by lib/core/layers.test.ts, which walks the
 * import graph and fails on any "use client" file that reaches lib/db.
 *
 * What it also did was make the data layer impossible to unit test in a Node
 * runtime, where there is no client boundary to violate. So the modules that
 * decide which retention window applies, or which programmes a buyer is shown,
 * could only ever be tested through a live Postgres, and mostly were not.
 *
 * Aliased in vitest.config.ts. Nothing imports this file directly.
 */
export {};
