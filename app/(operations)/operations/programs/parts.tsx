import { Ico } from "@/components/rift/icons";
import { STATUS_LABEL, READING_LABEL, type BuyerStatus, type LineTone } from "@/lib/core/program-view";
import type { CheckOutcome } from "@/lib/core/program-check";
import s from "./programs.module.css";

/* An icon per state as well as a colour and a word (rule 10), shared by the
   list and the detail page so one program never reads two ways. */
const STATUS: Record<BuyerStatus, { chip: string; Icon: (p: { size?: number }) => React.ReactNode }> = {
  shown: { chip: "chip-pos", Icon: Ico.checkCircle },
  overdue: { chip: "chip-warn", Icon: Ico.clock },
  unconfirmed: { chip: "chip-out", Icon: Ico.minus },
  withdrawn: { chip: "chip-neg", Icon: Ico.x },
};

export function StatusChip({ status }: { status: BuyerStatus }) {
  const { chip, Icon } = STATUS[status];
  return <span className={`chip ${chip}`}><Icon size={12} />{STATUS_LABEL[status]}</span>;
}

const LINE: Record<LineTone, { cls: string; Icon: (p: { size?: number }) => React.ReactNode }> = {
  quiet: { cls: s.lineQuiet!, Icon: Ico.clock },
  warn: { cls: s.lineWarn!, Icon: Ico.alert },
  neg: { cls: s.lineNeg!, Icon: Ico.alert },
};

export function CheckLineText({ text, tone }: { text: string; tone: LineTone }) {
  const { cls, Icon } = LINE[tone];
  return <span className={`${s.line} ${cls}`}><Icon size={13} />{text}</span>;
}

const READING: Record<CheckOutcome, { cls: string; Icon: (p: { size?: number }) => React.ReactNode }> = {
  baseline: { cls: "c-3", Icon: Ico.doc },
  unchanged: { cls: "c-pos", Icon: Ico.check },
  changed: { cls: "c-warn", Icon: Ico.alert },
  unreachable: { cls: "c-neg", Icon: Ico.x },
};

export function ReadingWord({ outcome }: { outcome: CheckOutcome }) {
  const { cls, Icon } = READING[outcome];
  return <span className={`${s.reading} ${cls}`}><Icon size={13} />{READING_LABEL[outcome]}</span>;
}
