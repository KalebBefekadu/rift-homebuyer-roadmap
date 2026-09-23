import type { Metadata } from "next";
import { Form } from "./Form";

export const metadata: Metadata = {
  title: "Submit an offer",
  description:
    "Submit an offer on any Georgia address, and see what it is actually worth to the seller before you send it. No account, nothing to install.",
  alternates: { canonical: "/offer" },
};

/**
 * Rift Offer, the public half.
 *
 * docs/vision.md lists this beside the assessment as one of the two things
 * that "work fully without an account", and docs/benchmark.md tracks
 * offer-sourced relationships at two a month. Studio could compare offers from
 * the day it shipped and there was no way for anybody to submit one, so that
 * channel produced nothing and the metric could only read zero.
 *
 * It follows the same rule as every other front door here: the value is
 * computed and handed over before anything is asked for. The reading happens
 * in the browser, from arithmetic, the moment there are enough numbers to do
 * it, and it is complete and correct whether or not the submitter ever
 * presses send.
 */
export default function OfferPage() {
  return (
    <div className="buy">
      <Form />
    </div>
  );
}
