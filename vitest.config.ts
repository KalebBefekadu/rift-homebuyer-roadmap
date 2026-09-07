import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
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
  },
});
