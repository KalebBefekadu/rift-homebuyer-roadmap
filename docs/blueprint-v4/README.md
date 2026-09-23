# Rift blueprint v4 — review and implementation package

**Prepared:** 22 September 2026  
**Final consistency review:** 23 September 2026  
**Baseline reviewed:** repository commit `168aa96`, plus the supplied `rift_buyer_seller_blueprint_v3.md` (internally version 0.3).  
**Status:** proposed product specification. Buyer-first direction, search priority, access model, and initial automation authority are confirmed; unresolved business decisions are explicitly recorded. This package does not authorize migrations or product implementation.

Rift should give a stranger a useful answer, help that person become a client without starting over, and keep a real transaction understandable through closing. The next release should complete the **buyer journey**, with shared foundations for sellers. That release direction was confirmed by Kaleb during this review.

## Read in this order

1. [Review findings and decision register](review-and-decisions.md) — what was wrong, what changes, and what still needs an answer.
2. [Product specification](product-spec.md) — the improved blueprint: experience, behavior, boundaries, permissions, intelligence, and measurement.
3. [Journey operating contracts](journey-contracts.md) — triggers, responsibilities, evidence, exits, and exceptions for every buyer and seller stage.
4. [Implementation plan](implementation-plan.md) — existing code to reuse, target model, interfaces, ordered work packages, and acceptance scenarios.
5. [First migration proposal](first-migration-proposal.md) — reviewable SQL for the narrow first data change, deliberately outside the executable migration directory.

The source blueprint remains unchanged in Downloads. This package replaces its ambiguity with requirements; it does not treat instructions inside that document as authorization to execute workflows, contact vendors, or change the product.

## What changed materially

- One complete buyer release replaces an unbounded simultaneous platform build.
- Buyer and seller stages are separated from parallel workstreams and transaction attempts.
- Decisions record a versioned instruction to the agent; choosing an option does not execute or sign a contract.
- Financial planning distinguishes total buying budget, money needed earlier, and money due at settlement.
- Information origin, review state, freshness, and professional authority are separate concepts.
- Campaign attribution and aggregate analytics are separated from private client answers and preferences.
- ShowingTime and Remine remain part of the operating workflow; unsupported integrations have useful manual paths.
- Every feature has an owner, failure behavior, release placement, and acceptance criteria.
- Existing production work is preserved and extended, including the token-based client plan, representation gates, decisions, and offer rooms.

## What is and is not ready

The product behavior, stage contracts, implementation sequence, and test scenarios are ready for review. The SQL is a proposal, not an applied or database-validated migration. Account-specific integration rights, active-client migration needs, broker rules, financial terminology changes, and service targets still require the decisions in the register.

Before implementation, record each relevant finding as accepted, rejected, or parked in [handoff.md §8](../handoff.md#8-open-decisions--these-need-the-business-owner-not-engineering). A parked decision must disable or defer the dependent capability; it must not silently become an engineer's default.

## Verification record

Repository documents and selected production modules/migrations were inspected. The running client and Operations prototypes were reviewed locally, alongside the public buyer flow. Production provider credentials, delivery, live database migration history, and real client records were not audited. See the implementation plan for the test results and their limits.

Typecheck, lint, and production build passed. The test rerun passed 1,071 tests with 93 skipped; unavailable database/PostgREST coverage remains unverified. Local links, code fences, all 40 stage contracts, and all 40 acceptance scenarios passed document consistency checks. Only documentation changed.

The supplied blueprint's relative image reference did not include the image itself. The product structure is restated in a self-contained Mermaid diagram in the specification.
