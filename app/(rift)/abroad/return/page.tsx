import type { Metadata } from "next";
import { hasAll, parseAnswers } from "@/lib/core/asks";
import { valueById, type InputKey } from "@/lib/core/values";
import { ValueFlow } from "@/components/rift/value/ValueFlow";
import { ValueLayout } from "@/components/rift/value/parts";
import AbroadResults from "../results/page";

export const metadata: Metadata = {
  title: "What would a U.S. home earn if I rented it out?",
  description: "Rent, costs and what is left each month and in year one, for a Georgia home owned from abroad. The rent is marked as an estimate.",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

/**
 * Value: the return (Blueprint v5 §5.4, D20 third).
 *
 * Asks what is missing, one question at a time, then renders the existing
 * abroad readout with the answers under its own parameter names. One page
 * computes the return, in English and Amharic, with the rent estimate labelled
 * as an estimate until real county rent ratios arrive (§12). Linking straight
 * to /abroad/results would have shown a sample buyer's figures to somebody
 * who had not answered anything.
 */
export default async function AbroadReturn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const def = valueById("abroad-return")!;
  const a = parseAnswers(one);
  const ask = one("ask") as InputKey | undefined;

  if (!hasAll(a, def.asks) || (ask && def.asks.includes(ask))) {
    return (
      <ValueLayout def={def}>
        <ValueFlow tool={def.id} side="abroad" href={def.href} asks={def.asks} given={a} only={ask && def.asks.includes(ask) ? ask : undefined} />
      </ValueLayout>
    );
  }

  return AbroadResults({
    searchParams: Promise.resolve({ s: String(a.status), u: "rent", p: String(a.price), c: String(a.county), lang: one("lang") }),
  });
}
