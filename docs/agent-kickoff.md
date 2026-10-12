# Kickoff prompt for an AI coding agent

Paste everything below the rule.

---

You have this repository. Read `AGENTS.md` first: it is the contract for working here and says
what to read next.

The product is built and live; nothing is waiting on a phase. What gets built next is decided
in `docs/blueprint-v5/README.md`, and the latest list of what is left is
`docs/audit/full-audit-2026-10-12.md`. If a task is not traceable to one of those, ask before
starting it: the product already has more surface than users.

Before you push:
- `npm run verify` passes (typecheck, `eslint .`, vitest, build);
- a change to a public page passes `npm run test:e2e`, and a new public page is on
  `e2e/phone.spec.ts`;
- anything ambiguous you built around is written down in the commit.

Report disagreement with the docs rather than implementing around it.
