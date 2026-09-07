# Kickoff prompt for the AI coding agent

The agent has the repository. This prompt does not restate the rules or the scope —
restating invites it to work from the summary instead of the source, and the source is
better written and will not drift. It points, constrains, and sets a deliverable.

Paste everything below the rule.

---

You have this repository. Read `AGENTS.md` first — it is the contract for working here and it
tells you what to read next and in what order.

Then **run the specification and use it**, before writing anything:

```bash
npm install && npm run dev
```

Complete the buyer assessment at `/prototype/buy`, read the readout it produces, then open
`/prototype/studio` and `/prototype/studio/queue`. The prototype is not a mockup of the
product — it *is* the product, in specification form, with the rules enforced in code.
Reading about an interaction model is not the same as feeling one, and several of the
decisions you will be asked to preserve only make sense once you have.

## Your scope

**`docs/handoff.md` §2.** Phases 1–3, buyers only. That section also names what is
deliberately deferred and the traffic gate that opens phase 4. Treat both as binding. If
you conclude that something outside the cut is genuinely required to make the MVP work,
**say so and stop** — do not widen scope on your own judgement. The cut was made against a
stated business priority, not an engineering one.

## What I need from you before you write code

Do not begin implementation until this has been reviewed. The third and fourth items are
the ones I weight highest. A capable agent handed a rich, confident specification will
implement around problems rather than report them. Asking for disagreement explicitly is
the cheapest defect-detection available.

1. **A phase-1 plan, broken into commits**, each naming the test that proves it. `npm test`
   already runs — 20 tests in `lib/prototype/compute.test.ts`. Match their style: each states
   the rule it protects and why that rule exists.

2. **The first Supabase migration, as SQL.** Including RLS policies and the constraints named
   in `docs/schema.md` §"Constraints worth writing into the schema". Those constraints are in
   the database rather than the application layer on purpose; if you think one belongs in
   application code instead, argue it rather than moving it.

3. **Everything you found ambiguous, contradictory, or wrong.** You are reading roughly 3,000
   lines of specification written over months, and some of it will not survive contact with
   implementation. When a document and the prototype disagree, **the prototype wins** — say
   which document to fix. When the prototype itself is silent, check `docs/handoff.md` §8
   before deciding: several of those are business decisions that are not the engineer's to
   make, and two are not even the agent's.

4. **Anything you would push back on.** This and item 3 are the ones I will read first. Each opinion in the specification has a reason
   written next to it — immutable snapshots, a first-touch trigger, telemetry in a separate
   table from answers, no LLM anywhere in the value path. If a reason does not hold up, I
   would rather hear it now than discover the workaround in review.

The tiebreaker is already named: the prototype wins, and §8 covers what is not your call.
Do not invent a third path.

## The one thing to hold onto

Almost every rule in `docs/handoff.md` §4 exists because breaking it produces **a wrong
number in front of a real person** rather than an error. A crash is embarrassing; somebody
planning their family's finances around a figure you quietly got wrong is the thing that
ends the product.

When a rule seems fussy, that is what it is protecting.

MVP acceptance is the "shipped" list in `docs/handoff.md` §2. `npx tsc --noEmit` clean,
`npm test` passing, `npm run build` compiling, `npx next lint` clean.
