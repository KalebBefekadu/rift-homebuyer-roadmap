import type { Metadata } from "next";
import { GA_COUNTIES } from "@/lib/core/registry";
import { Landing } from "./Landing";

export const metadata: Metadata = {
  title: "Own property in Georgia from anywhere",
  description:
    "You do not need to be a U.S. citizen, hold a green card, or ever have lived in America to own property in Georgia. See what you would have to send, what it would rent for, and what comes back — free, before you talk to anyone.",
};

/* Rates move; the rest is arithmetic on published figures. An hour is short
   enough to stay honest about the rate and long enough to stay cheap. */
export const revalidate = 3600;

export default function AbroadPage() {
  return <Landing counties={GA_COUNTIES} />;
}
