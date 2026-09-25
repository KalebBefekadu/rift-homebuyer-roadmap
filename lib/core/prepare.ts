/**
 * Value: should I fix it first? (Blueprint v5 §5.3, D20 fourth on the seller side).
 *
 * Sorts the usual pre-listing work into worth doing now, maybe, and not yet,
 * from three condition questions and the price. It gives reasons, never a
 * dollar return: MONEY-06 forbids a generated repair ROI, and a cost figure
 * for work nobody has quoted would be exactly that with a different label.
 * `repairTriage` in compute.ts, which still feeds the older readout, carries
 * invented costs and "pays back" verdicts; this replaces it for the values.
 *
 * The advice is the ordinary, uncontroversial kind an agent gives at a first
 * walkthrough: clean, paint what is worn, deal with what an inspection will
 * find, and do not renovate a kitchen to sell a house. It is a starting list
 * for a walkthrough, and says so.
 *
 * Pure: no React, no I/O.
 */

export type Interior = "fresh" | "worn" | "tired";
export type KitchenAge = "updated" | "dated" | "original";
export type Systems = "fine" | "issues" | "unsure";
export type PrepVerdict = "now" | "maybe" | "later";

export interface PrepInputs {
  price: number;
  interior: Interior;
  kitchen: KitchenAge;
  systems: Systems;
}

export interface PrepItem {
  item: string;
  verdict: PrepVerdict;
  why: string;
}

/** Above this, buyers expect a finished interior; below it, a credit often does. */
export const FINISHED_INTERIOR_PRICE = 600_000;

export function prepTriage(i: PrepInputs) {
  const upper = i.price >= FINISHED_INTERIOR_PRICE;
  const items: PrepItem[] = [
    { item: "Deep clean and declutter", verdict: "now",
      why: "The least it costs and the most it changes how the home feels, in person and in photos." },
    { item: "Front door, entry and yard tidy", verdict: "now",
      why: "The first thing every buyer sees, and the first photo on the listing." },
  ];

  if (i.interior === "fresh") {
    items.push({ item: "Interior paint", verdict: "later", why: "You said the inside is in good shape. Touch up marks rather than repaint." });
  } else {
    items.push({ item: "Paint the main rooms in a light neutral", verdict: "now",
      why: i.interior === "tired" ? "Worn walls make buyers wonder what else was left, and paint is the cheapest way to answer that." : "Scuffed walls photograph badly and fresh paint is quick." });
  }

  if (i.interior === "tired") {
    items.push({ item: "Worn carpet or damaged flooring", verdict: upper ? "now" : "maybe",
      why: upper ? "At this price buyers expect floors they will not have to replace." : "Worth it if it shows badly in photos. Otherwise a credit at closing is often simpler." });
  }

  if (i.systems === "issues") {
    items.push({ item: "The known problem: roof, heating and cooling, plumbing or electrical", verdict: "now",
      why: "A buyer's inspection will find it. Get a quote now so you can choose between fixing it and offering a credit, instead of deciding under a deadline." });
  } else if (i.systems === "unsure") {
    items.push({ item: "A pre-listing inspection", verdict: "maybe",
      why: "You are not sure how the roof and systems are. An inspection tells you before a buyer's does, when you still have time to choose." });
  }

  if (i.kitchen !== "updated") {
    items.push({ item: "Small kitchen and bathroom updates: hardware, lighting, caulk", verdict: "maybe",
      why: "Cheap and quick, and they make a dated room read as looked-after." });
    items.push({ item: "Kitchen or bathroom renovation", verdict: "later",
      why: "Rarely worth doing to sell. Buyers weigh a dated kitchen at less than a renovation costs, so price for the kitchen you have." });
  }

  const count = (v: PrepVerdict) => items.filter((x) => x.verdict === v).length;
  return {
    items,
    counts: { now: count("now"), maybe: count("maybe"), skip: count("later") },
    assumptions: [
      { label: "Price", value: i.price.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) },
      { label: "Inside", value: i.interior === "fresh" ? "Good shape" : i.interior === "worn" ? "Some wear" : "Tired" },
      { label: "Kitchen and baths", value: i.kitchen === "updated" ? "Updated" : i.kitchen === "dated" ? "Dated" : "Original" },
      { label: "Roof and systems", value: i.systems === "fine" ? "No known problems" : i.systems === "issues" ? "A known problem" : "Not sure" },
      { label: "Not given", value: "Cost or return on any item: nobody has quoted the work" },
    ],
    couldBeWrong:
      "This is a starting list from three answers, not a walkthrough. What a buyer in your area expects, what the work would actually cost, and what an inspection finds can all change it. A local contractor's quote is the number to trust.",
  };
}
