# 04. Calculation Spec

The smart core. Exact math for the roadmap engine. Implement as a pure, unit-tested module (`lib/roadmap/calc.ts`). This is the source of truth. The prototype JS matches this.

## Inputs

```ts
interface RoadmapInputs {
  price: number;          // target purchase price, dollars
  downPct: number;        // down payment percent, e.g. 3.5
  ratePct: number;        // annual interest rate percent, e.g. 6.5 (an assumption, not a quote)
  termYears: number;      // 30 | 20 | 15
  taxPct: number;         // annual property tax as percent of price, e.g. 1.0
  insuranceYr: number;    // homeowners insurance, dollars per year
  hoaMo: number;          // HOA, dollars per month
  closingPct: number;     // estimated closing costs as percent of price, e.g. 3
  pmiPct: number;         // annual PMI as percent of loan, applied only if downPct < 20
  savings: number;        // client current savings, dollars
  dpaTotal: number;       // sum of selected assistance program amounts, dollars
}
```

## Outputs

```ts
interface RoadmapOutputs {
  down: number;           // down payment dollars
  loan: number;           // financed amount
  monthlyPI: number;      // principal + interest
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyPMI: number;     // 0 if downPct >= 20 or pmiPct <= 0
  monthlyHOA: number;
  monthlyTotal: number;   // full PITI + PMI + HOA
  closingCosts: number;
  cashToClose: number;    // down + closing
  covered: number;        // savings + dpaTotal
  cashGap: number;        // max(cashToClose - covered, 0)
  fullyCovered: boolean;  // covered >= cashToClose
}
```

## Formulas

Down payment and loan:
```
down = price * downPct / 100
loan = max(price - down, 0)
```

Monthly principal and interest (standard amortization):
```
r = (ratePct / 100) / 12         // monthly rate
n = termYears * 12               // number of payments
monthlyPI =
  loan <= 0 ? 0
  : r === 0 ? loan / n
  : loan * r * (1 + r)^n / ((1 + r)^n - 1)
```

Monthly escrow and fees:
```
monthlyTax       = price * taxPct / 100 / 12
monthlyInsurance = insuranceYr / 12
monthlyPMI       = (downPct < 20 && pmiPct > 0) ? loan * pmiPct / 100 / 12 : 0
monthlyHOA       = hoaMo
monthlyTotal     = monthlyPI + monthlyTax + monthlyInsurance + monthlyPMI + monthlyHOA
```

Cash to close and the gap (the money moment):
```
closingCosts = price * closingPct / 100
cashToClose  = down + closingCosts
covered      = savings + dpaTotal
cashGap      = max(cashToClose - covered, 0)
fullyCovered = covered >= cashToClose
```

## Reference implementation

```ts
export function computeRoadmap(i: RoadmapInputs): RoadmapOutputs {
  const down = i.price * i.downPct / 100;
  const loan = Math.max(i.price - down, 0);
  const r = (i.ratePct / 100) / 12;
  const n = i.termYears * 12;
  const monthlyPI =
    loan <= 0 ? 0
    : r === 0 ? loan / n
    : loan * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  const monthlyTax = i.price * i.taxPct / 100 / 12;
  const monthlyInsurance = i.insuranceYr / 12;
  const monthlyPMI = (i.downPct < 20 && i.pmiPct > 0) ? loan * i.pmiPct / 100 / 12 : 0;
  const monthlyHOA = i.hoaMo;
  const monthlyTotal = monthlyPI + monthlyTax + monthlyInsurance + monthlyPMI + monthlyHOA;
  const closingCosts = i.price * i.closingPct / 100;
  const cashToClose = down + closingCosts;
  const covered = i.savings + i.dpaTotal;
  const cashGap = Math.max(cashToClose - covered, 0);
  return {
    down, loan, monthlyPI, monthlyTax, monthlyInsurance, monthlyPMI, monthlyHOA,
    monthlyTotal, closingCosts, cashToClose, covered, cashGap,
    fullyCovered: covered >= cashToClose,
  };
}
```

## Advanced: affordability solver (V2)

Reverse the payment. Given a monthly budget the client can afford, return the max price. Solve for price such that `monthlyTotal(price) <= budget`. Because tax, insurance-as-flat, and PMI all scale differently with price, solve numerically (binary search on price between 0 and a ceiling until monthlyTotal is within a dollar of budget). Keep it in the same module as `maxPriceForBudget(budget, assumptions)`.

## Test cases (seed the unit tests)

Use these to lock behavior. Round to nearest dollar.

1. `price=300000, downPct=3.5, ratePct=6.5, termYears=30, taxPct=1.0, insuranceYr=1400, hoaMo=0, closingPct=3, pmiPct=0.6, savings=8000, dpaTotal=10000`
   - down = 10500, loan = 289500
   - monthlyPI approx 1830
   - PMI applies (down < 20%)
   - cashToClose = 10500 + 9000 = 19500
   - covered = 18000, cashGap = 1500, fullyCovered = false
2. Same but `downPct=20`: monthlyPMI = 0, fullyCovered depends on new higher down.
3. `price=0`: all zeros, no NaN, fullyCovered = true (covered >= 0).
4. `ratePct=0`: monthlyPI = loan / n exactly.

## Rounding and display

- Compute in full precision. Round only at display (`Math.round`, `toLocaleString('en-US')`).
- Never show negative gap. Below zero flips to "Fully covered."

## Non-negotiable framing

- Every figure is a planning estimate under the stated assumptions. Not a loan approval, quote, or commitment. The PDF footer states this. The lender is the authority on real numbers.
