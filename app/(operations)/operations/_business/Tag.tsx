import { Ico } from "@/components/rift/icons";
import s from "./kit.module.css";

/**
 * A state as a word with its own mark (rule 10): colour alone never says it.
 * The business pages draw every state through this so "waiting" looks the same
 * on Offers, Advocacy and Transactions.
 */
const MARK = {
  pos: Ico.checkCircle,
  warn: Ico.clock,
  neg: Ico.alert,
  acc: Ico.bolt,
  info: Ico.info,
  none: Ico.minus,
} as const;

export type TagTone = keyof typeof MARK;

export function Tag({ tone = "none", children, title }: { tone?: TagTone; children: React.ReactNode; title?: string }) {
  const Mark = MARK[tone];
  const cls = tone === "pos" ? s.pos : tone === "warn" ? s.warn : tone === "neg" ? s.neg : tone === "acc" ? s.acc : "";
  return (
    <span className={`${s.tag} ${cls}`} title={title}>
      <Mark size={12} aria-hidden />
      {children}
    </span>
  );
}
