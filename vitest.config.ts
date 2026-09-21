import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      /**
       * `server-only` is a build-time guard, not a runtime one.
       *
       * Its whole implementation is a throw that fires when a bundler resolves
       * the browser condition — which is exactly what protects lib/db from
       * being imported into a client component, and is enforced separately and
       * properly by lib/core/layers.test.ts and by the build itself.
       *
       * Under vitest there is no client boundary to cross, so the throw only
       * means the data layer cannot be unit tested at all. Until now it was
       * not: every lib/db suite talks to Postgres through raw `pg` and asserts
       * the schema, leaving the module's own logic — which window it applies,
       * what it does with a nonsense value — untested. That is how a settings
       * dial ends up connected to nothing.
       */
      "server-only": resolve(__dirname, "lib/core/test/server-only-shim.ts"),
    },
  },
  test: {
    /**
     * Database suites run one file at a time.
     *
     * `lib/db/schema.test.ts` and `lib/db/flow.test.ts` each rebuild the public
     * schema from the migration, which is the right way to test constraints —
     * but run in parallel they drop the schema out from under each other, and
     * the symptom is not a failure. It is a silent skip, because each suite
     * treats an unreachable database as "no Postgres here" and moves on.
     *
     * Silent skips are the worst possible outcome for tests whose whole job is
     * to prove the constraints bite. The whole suite runs in about a second,
     * so serialising it costs nothing worth having.
     */
    fileParallelism: false,

    /**
     * Vitest owns `*.test.ts`; Playwright owns `e2e/*.spec.ts`.
     *
     * Stated rather than left to the default, because vitest's default glob
     * picks up `.spec.ts` too — and a Playwright file collected by vitest does
     * not fail in a way that reads as a boundary problem. It fails with
     * "Playwright Test did not expect test.describe() to be called here",
     * three files red, and every one of the 649 real tests still passing
     * underneath it.
     */
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "components/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
});
