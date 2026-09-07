# Rift Calculation Contract

`lib/core/compute.ts` is the source of truth for every customer-facing figure. It must
stay framework-free, I/O-free, and unit-tested. Components display its outputs; they never
duplicate the maths.

`lib/core/compute.test.ts` is the executable half of this document. **Change them in the
same commit.** A contract that only exists in prose is a suggestion.

> This document previously specified `lib/roadmap/calc.ts`, which has been retired. That
> engine computed cash to close as *down payment plus closing costs* — an understatement of
> roughly 35% for a typical first-time buyer, and precisely the misconception the product now
> exists to correct.

---

## The rule the whole engine serves

**Every figure carries its assumptions and its failure mode.** The `Computed` type requires
`assumptions` and `couldBeWrong`, and this is enforced in the type rather than in review:

```ts
export interface Computed {
  value: number;
  assumptions: Assumption[];
  couldBeWrong: string;
}
```

A figure that renders without them is a defect whether or not it is arithmetically correct.
Someone acting on a number they cannot interrogate is worse off than someone with no number.

---

## Buyer inputs

| Input | Meaning |
| --- | --- |
| `price` | Target purchase price |
| `downPct` | Down payment percentage, e.g. `3.5` |
| `ratePct` | Annual interest-rate assumption |
| `termYears` | Mortgage term in years |
| `taxPct` | Annual property tax as a percentage of price |
| `insuranceYr` | Annual homeowners insurance |
| `hoaMo` | Monthly HOA |
| `closingPct` | Closing-cost estimate as a percentage of price |
| `pmiPct` | Annual PMI as a percentage of the loan |
| `savings` | Current savings |
| `monthlySaving` | Monthly saving rate — drives the timeline |
| `assistance` | Assistance applied. **See the assistance rule below** |
| `county` | Drives programme matching |
| `currentRent` | For the rent-versus-buy comparison |

## Monthly cost — `monthlyCost(i)`

```text
down  = price * downPct / 100
loan  = max(price - down, 0)

r = ratePct / 100 / 12
n = termYears * 12
pi =
  loan <= 0 ? 0
  : r === 0 ? loan / n
  : loan * r * (1 + r)^n / ((1 + r)^n - 1)

tax       = price * taxPct / 100 / 12
insurance = insuranceYr / 12
pmi       = downPct < 20 && pmiPct > 0 ? loan * pmiPct / 100 / 12 : 0
hoa       = hoaMo
total     = pi + tax + insurance + pmi + hoa
```

## Cash to close — `cashToClose(i)`

The figure that misleads almost every first-time buyer, because they have only ever been
quoted the down payment. Seven lines, one of which is credited back:

```text
down       = price * downPct / 100
closing    = price * closingPct / 100
prepaids   = insuranceYr + (price * taxPct / 100 / 12) * 3
inspection = 550
appraisal  = 650
moving     = 1400
earnest    = round(price * 0.01 / 100) * 100      -- credited back at closing

total = sum of every line that is NOT credited
```

**Earnest money is shown and excluded from the total.** Both halves are load-bearing: omitting
the line understates what they need on the day, and including it in the total overstates what
the purchase actually costs them. It is the only `credited: true` line.

The three lines nobody quotes — inspection, appraisal, moving — are held as constants rather
than percentages because they do not scale with price. Moving is the cost buyers forget most
often.

## The gap — `cashGap(i)`

```text
covered       = savings + assistance
gap           = max(total - covered, 0)
monthsToClose = gap <= 0        ? 0
              : monthlySaving > 0 ? ceil(gap / monthlySaving)
              : null                                  -- unknown, NOT zero
fullyCovered  = covered >= total
```

Two rules that fail as wrong numbers rather than errors:

- **The gap floors at zero.** A covered buyer is described as `fullyCovered`, never as having
  a negative gap.
- **An unknown timeline is `null`, never `0`.** Zero renders as *ready today* on the readout,
  which is the opposite of what "we do not know their saving rate" means.

## The assistance rule — the most important line in the engine

`buyerReadout()` in `lib/core/results.ts` **requires `assistance: 0`.**

The headline gap, the timeline, and the readiness status are computed on savings alone.
Matched assistance is displayed beside them as conditional upside, with the lender named as
the party who decides.

Folding an unapproved programme midpoint into the headline tells somebody they are ready to
buy when they are not. In testing this produced a buyer with $9,000 saved against a $380,000
home being told *"you already have the cash to close."* It is the single most damaging thing
this product could say to a person, and the arithmetic does it by default unless something
stops it.

## Seller

`netProceeds(s)` subtracts commission, concessions, Georgia transfer tax
(**$1.00 per $500 of consideration — 0.2%**), settlement, prorated tax, payoff admin,
repairs, and moving from the price, then the mortgage payoff. `repairTriage()` ranks repairs
by payback, and `unclaimedValue()` finds homestead and age-65 exemptions the owner has not
filed.

---

## Expected behaviour

- Compute in full precision; round only for display.
- PMI is zero at 20% down or more, or when the PMI assumption is zero.
- A zero rate uses `loan / n` and never produces `NaN`.
- A zero loan produces zero principal and interest.
- The gap never goes below zero.
- An unknown timeline is `null`.

## Reference case

`BUYER_DEFAULTS` — `price=325000`, `downPct=3.5`, `ratePct=6.5`, `termYears=30`, `taxPct=1.0`,
`insuranceYr=1650`, `hoaMo=0`, `closingPct=3`, `pmiPct=0.6`, `savings=9000`,
`monthlySaving=650`, `assistance=0`:

| Figure | Value |
| --- | --- |
| Down payment | `$11,375` |
| Loan | `$313,625` |
| Monthly principal and interest | `$1,982.32` |
| Monthly total (PITI + PMI) | `$2,547.47` |
| Closing costs | `$9,750` |
| Prepaids and escrow | `$2,462.50` |
| Earnest money (credited back) | `$3,300` |
| **Cash to close** | **`$26,187.50`** |
| Covered | `$9,000` |
| **Gap** | **`$17,187.50`** |
| Months to close the gap | `27` |
| `fullyCovered` | `false` |

Note the shape of it: the down payment is **$11,375** and the cash actually needed is
**$26,187.50**. A buyer told only the first number is short by more than the number they
were told.

These values are pinned in `lib/core/compute.test.ts`. Update the test, this table, and
the engine together, or not at all.

## Product framing

Every number is a planning estimate based on stated assumptions — never a loan approval, a
rate quote, a valuation, or a lending commitment. That disclaimer travels with the figures
onto every surface that displays them, including anything exported or shared. A lender is the
authority on live underwriting and final numbers.
