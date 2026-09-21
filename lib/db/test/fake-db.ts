/**
 * A PostgREST-shaped fake, for testing what the data layer DOES.
 *
 * `lib/db/degradation.test.ts` proves every function degrades when there is no
 * database. That is the contract, and it is not the behaviour: which rows a
 * function asks for, in what order it writes them, and what it does with a
 * nonsense answer are all untested by it. Those are where the defects have
 * been — `forget()` went on reporting success while leaving the person's name,
 * email and phone in place, because a migration changed a foreign key under it
 * and the docblock still described the old behaviour.
 *
 * This is deliberately NOT a database. It does not filter, sort or join; it
 * records every call and returns whatever the test told it to return. What it
 * tests is the caller's reasoning — the order of operations, which table is
 * touched with which filters, whether a failure stops the sequence — not
 * Postgres. The real schema and its constraints are tested against real
 * Postgres in schema.test.ts and flow.test.ts, which is the right layer for
 * that and the wrong layer for this.
 */

export interface Call {
  table: string;
  /** "select" | "insert" | "update" | "upsert" | "delete" */
  verb: string;
  /** Filters in the order they were applied: `eq:agent_id=x`, `in:id=[1,2]`. */
  filters: string[];
  /** The row or rows handed to insert/update/upsert. */
  payload?: unknown;
}

type Answer = {
  data?: unknown;
  /* `code` matters: claimStep distinguishes a unique violation (23505 — the
     constraint doing its job) from any other failure, and that branch is the
     difference between skipping a step and reporting an incident. */
  error?: { message: string; code?: string } | null;
  count?: number;
};

/** What a caller actually receives — count is always present, as PostgREST has it. */
type Settled = { data: unknown; error: { message: string; code?: string } | null; count: number | null };

/**
 * What the fake should answer.
 *
 * Keyed `"<verb> <table>"`, e.g. `"select rift_leads"`. A function receives the
 * call and may answer differently per invocation, which is how a test says "the
 * second delete fails".
 */
export type Answers = Record<string, Answer | ((call: Call, nth: number) => Answer)>;

export interface Fake {
  from(table: string): unknown;
  /** Every call, in the order they were made. */
  calls: Call[];
  /** Calls to one table, or one `"verb table"` key. */
  to(key: string): Call[];
}

export function fakeDb(answers: Answers = {}): Fake {
  const calls: Call[] = [];
  const counts: Record<string, number> = {};

  const answerFor = (call: Call): Answer => {
    const key = `${call.verb} ${call.table}`;
    const a = answers[key] ?? answers[call.table];
    const nth = (counts[key] = (counts[key] ?? 0) + 1);
    if (typeof a === "function") return a(call, nth);
    /* An unconfigured answer is an empty result, never an error. A test that
       has not said what a table returns is a test that does not care, and
       failing it there would make every suite assert things it is not about. */
    return a ?? { data: [], error: null };
  };

  function builder(table: string) {
    const call: Call = { table, verb: "select", filters: [] };

    /* PostgREST's builder is a thenable, not a promise. Every method returns
       `this`, and awaiting it runs the query — which is why lib/db wraps each
       one in Promise.resolve before racing it against a deadline. */
    const self: Record<string, unknown> = {
      select(cols?: string, opts?: { count?: string; head?: boolean }) {
        if (call.verb === "select") {
          call.filters.push(`select:${cols ?? "*"}`);
          /* `{ count: "exact", head: true }` asks for a number and no rows.
             The sweep counts before it deletes, so a fake that dropped this
             would make every count read zero and the job would report having
             removed nothing while removing everything. */
          if (opts?.count) call.filters.push(`count:${opts.count}${opts.head ? " head" : ""}`);
        }
        return self;
      },
      insert(rows: unknown) { call.verb = "insert"; call.payload = rows; return self; },
      update(row: unknown) { call.verb = "update"; call.payload = row; return self; },
      upsert(rows: unknown, opts?: unknown) { call.verb = "upsert"; call.payload = rows; if (opts) call.filters.push(`opts:${JSON.stringify(opts)}`); return self; },
      delete() { call.verb = "delete"; return self; },

      eq(col: string, v: unknown) { call.filters.push(`eq:${col}=${String(v)}`); return self; },
      neq(col: string, v: unknown) { call.filters.push(`neq:${col}=${String(v)}`); return self; },
      in(col: string, v: unknown[]) { call.filters.push(`in:${col}=[${v.join(",")}]`); return self; },
      is(col: string, v: unknown) { call.filters.push(`is:${col}=${String(v)}`); return self; },
      not(col: string, op: string, v: unknown) { call.filters.push(`not:${col}.${op}=${String(v)}`); return self; },
      lt(col: string, v: unknown) { call.filters.push(`lt:${col}=${String(v)}`); return self; },
      lte(col: string, v: unknown) { call.filters.push(`lte:${col}=${String(v)}`); return self; },
      gt(col: string, v: unknown) { call.filters.push(`gt:${col}=${String(v)}`); return self; },
      gte(col: string, v: unknown) { call.filters.push(`gte:${col}=${String(v)}`); return self; },
      or(expr: string) { call.filters.push(`or:${expr}`); return self; },
      order(col: string, o?: { ascending?: boolean }) { call.filters.push(`order:${col}${o?.ascending === false ? " desc" : ""}`); return self; },
      limit(n: number) { call.filters.push(`limit:${n}`); return self; },
      range(a: number, b: number) { call.filters.push(`range:${a}-${b}`); return self; },
      single() { call.filters.push("single"); return self; },
      maybeSingle() { call.filters.push("maybeSingle"); return self; },

      then(resolve: (v: Settled) => unknown, reject?: (e: unknown) => unknown) {
        try {
          calls.push(call);
          const a = answerFor(call);
          let data = a.data;
          /* `single` and `maybeSingle` return a row, not an array. Getting this
             wrong in the fake would make every caller that unwraps `.data[0]`
             look broken. */
          if ((call.filters.includes("single") || call.filters.includes("maybeSingle")) && Array.isArray(data)) {
            data = data[0] ?? null;
          }
          return Promise.resolve({ data: data ?? null, error: a.error ?? null, count: a.count ?? (Array.isArray(a.data) ? a.data.length : null) }).then(resolve, reject);
        } catch (e) {
          return Promise.reject(e).then(resolve, reject);
        }
      },
    };
    return self;
  }

  return {
    from: (table: string) => builder(table),
    calls,
    to(key: string) {
      return key.includes(" ")
        ? calls.filter((c) => `${c.verb} ${c.table}` === key)
        : calls.filter((c) => c.table === key);
    },
  };
}
