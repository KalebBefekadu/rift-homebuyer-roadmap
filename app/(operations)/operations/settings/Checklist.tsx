import Link from "next/link";
import { Ico } from "@/components/rift/icons";
import { GROUP_LABEL, STATE_WORD, type SetupItem, type SetupState } from "@/lib/core/setup";
import { CheckEmail } from "./CheckEmail";
import s from "./settings.module.css";

/* An icon and a word for every state (rule 10): the colour is the third
   signal, never the only one. */
const MARK: Record<SetupState, { Icon: typeof Ico.alert; cls: string }> = {
  broken: { Icon: Ico.alert, cls: "c-neg" },
  todo: { Icon: Ico.arrowR, cls: "c-warn" },
  confirm: { Icon: Ico.info, cls: "c-warn" },
  waiting: { Icon: Ico.clock, cls: "c-3" },
  optional: { Icon: Ico.minus, cls: "c-4" },
  done: { Icon: Ico.checkCircle, cls: "c-pos" },
};

export function StateWord({ state }: { state: SetupState }) {
  const { Icon, cls } = MARK[state];
  return <span className={`${s.state} ${cls}`}><Icon size={12} />{STATE_WORD[state]}</span>;
}

/** One thing to set up: what it is, what it affects, its state and the way to do it. */
export function SetupRow({ item, showGroup = true }: { item: SetupItem; showGroup?: boolean }) {
  const { Icon, cls } = MARK[item.state];
  const a = item.action;
  return (
    <li className={s.item}>
      <Icon size={16} className={`${s.itemIco} ${cls}`} aria-hidden />
      <div>
        <div className={s.itemTitle}>
          <span>{item.title}</span>
          {showGroup ? <span className={s.itemGroup}>{GROUP_LABEL[item.group]}</span> : null}
        </div>
        <p className={s.itemText}>{item.affects}</p>
      </div>
      <div className={s.itemSide}>
        <StateWord state={item.state} />
        {a?.kind === "link" ? (
          <Link href={a.href} className="btn btn-s btn-sm">{a.label}</Link>
        ) : a?.kind === "check" ? (
          <CheckEmail label={a.label} />
        ) : null}
      </div>
      {a?.kind === "steps" ? (
        <details className={s.steps}>
          <summary><Ico.chevR size={12} />How to {item.state === "broken" ? "fix it" : item.state === "optional" ? "switch it on" : "do it"}</summary>
          <ol>{a.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        </details>
      ) : null}
    </li>
  );
}

/**
 * The open items, most urgent first, and the finished ones folded into a
 * count. A list that keeps showing what is done buries what is not.
 */
export function Checklist({ items }: { items: SetupItem[] }) {
  const open = items.filter((i) => i.state !== "done");
  const done = items.filter((i) => i.state === "done");
  return (
    <>
      {open.length ? (
        <ul className={s.list}>{open.map((i) => <SetupRow key={i.id} item={i} />)}</ul>
      ) : (
        <div className="ops-empty">
          <div className="ops-empty-title">Nothing left to set up</div>
          <p className="ops-empty-text">Every rule is decided, your profile is complete and every connection answers.</p>
        </div>
      )}
      {done.length ? (
        <details className={s.done}>
          <summary><Ico.chevR size={12} className={s.chev} /><Ico.checkCircle size={13} className="c-pos" />Done · {done.length}</summary>
          <ul className={s.doneList}>
            {done.map((i) => (
              <li key={i.id} className={s.doneRow}>
                <Ico.check size={12} className="c-pos" aria-hidden />
                <span className="c-2">{i.title}</span>
                <span className={s.itemGroup}>{GROUP_LABEL[i.group]}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
