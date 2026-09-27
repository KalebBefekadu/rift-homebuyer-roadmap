import { describe, it, expect } from "vitest";
import { BACK_TO, SELL_STAGES, TERMINAL, contractError, endContractError, initialWork, progressOf, stageError, stageStrip, statusError, type Progress } from "./progress";

const at = (stage: Progress["stage"]): Progress => ({ ...progressOf([]), stage });
const ctx = { covered: true, coverageNote: "", openContract: false };

describe("seller stages (STATE-03)", () => {
  it("a seller moves through their own stages and never a buyer's", () => {
    expect(SELL_STAGES).toEqual(["prepare", "price-launch", "market", "offers", "under-contract", "close", "continue"]);
    expect(stageError(at("prepare"), "price-launch", { reason: "Pricing agreed" }, ctx, "sell")).toBeNull();
    expect(stageError(at("prepare"), "search", { reason: "x y z" }, ctx, "sell")).toMatch(/Choose a stage/);
    expect(stageError(at("prepare"), "market", { reason: "x y z" }, ctx, "buy")).toMatch(/Choose a stage/);
  });

  it("marketing needs a listing agreement; Continue comes only from closing the contract", () => {
    expect(stageError(at("price-launch"), "market", { reason: "Launching" }, { ...ctx, covered: false, coverageNote: "None on file." }, "sell"))
      .toMatch(/signed listing agreement/);
    expect(stageError(at("close"), "continue", { reason: "Done" }, ctx, "sell")).toMatch(/Record the contract as closed/);
    expect(TERMINAL.sell).toBe("continue");
  });

  it("a terminated sale goes back to marketing or offers, and a closed one can be completed", () => {
    expect(BACK_TO.sell).toEqual(["market", "offers"]);
    expect(endContractError("terminated", "Buyer walked", "search", [], "sell")).toMatch(/Market & show or Review offers/);
    expect(endContractError("terminated", "Buyer walked", "market", [], "sell")).toBeNull();
    expect(statusError(at("continue"), "completed", "Sold", "sell")).toBeNull();
    expect(statusError(at("close"), "completed", "Sold", "sell")).toMatch(/sale is completed once it has closed/);
  });

  it("a sale's contract needs the property, and its workstreams start with the buyer's side named", () => {
    expect(contractError(at("offers"), { homeId: "h", financing: "financed", evidence: "Executed agreement" }, { ...ctx, homeOnList: false }, "sell"))
      .toMatch(/Record the property first/);
    const work = initialWork("financed", "sell");
    expect(work.find((w) => w.workstream === "financing")!.input).toMatchObject({ owner: "other", ownerName: "The buyer's lender" });
    expect(work.find((w) => w.workstream === "insurance")!.input.state).toBe("not-applicable");
    expect(work.find((w) => w.workstream === "possession")!.input.owner).toBe("client");
  });

  it("the stage strip is the seller's", () => {
    expect(stageStrip(at("market"), ["prepare", "price-launch", "market"], "sell").map((s) => s.label))
      .toEqual(["Prepare", "Price & launch", "Market & show", "Review offers", "Under contract", "Close", "Continue"]);
  });
});
