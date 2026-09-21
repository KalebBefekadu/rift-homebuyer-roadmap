import { compare, spreadOf, chosen, daysLeft, KIND_LABEL, type Decision } from "@/lib/core/decision";
import { money } from "@/lib/core/compute";
import { Ico } from "@/components/rift/icons";

/**
 * A decision, as the client reads it.
 *
 * Shared by the client's plan page and the agent's preview, so that what he
 * approves is literally what they see rather than a second rendering of the
 * same data that drifts from it. The seller readout's disclosure notices
 * taught this the hard way: a fix applied to one surface did not travel to
 * four others saying the same thing.
 *
 * WHAT THIS COMPONENT REFUSES TO DO is as important as what it renders. It
 * does not order by amount, it does not mark one option as best, and it does
 * not compute a recommendation. The largest number is not the best option —
 * `headlineTrap` in lib/core/offers.ts exists because that is the single most
 * expensive misreading in this business — and a comparison that sorts by value
 * has made the choice on the reader's behalf without telling them.
 */
export function DecisionRoom({
  decision,
  agentFirst,
  today = new Date(),
}: {
  decision: Decision;
  agentFirst: string;
  today?: Date;
}) {
  const options = compare(decision.options);
  const spread = spreadOf(decision.options);
  const picked = chosen(decision);
  const days = daysLeft(decision, today);

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--line-3)" }}>
        <div className="row gap-2 wrap" style={{ alignItems: "center" }}>
          <span className="chip t-2xs">{KIND_LABEL[decision.kind]}</span>
          {picked ? <span className="chip chip-pos t-2xs">Decided</span> : null}
          {!picked && days !== null ? (
            <span className={`chip t-2xs ${days < 0 ? "chip-neg" : days <= 3 ? "chip-warn" : ""}`}>
              {days < 0
                ? `${Math.abs(days)} days past`
                : days === 0 ? "Due today" : `${days} days left`}
            </span>
          ) : null}
        </div>

        <h3 className="serif" style={{ fontSize: 20, lineHeight: 1.25, marginTop: 10 }}>
          {decision.question}
        </h3>

        {decision.context ? (
          <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6, maxWidth: 560 }}>
            {decision.context}
          </p>
        ) : null}

        {/* What is actually at stake. The sentence nobody works out for
            themselves: two offers whose headline prices differ by $9,000 may
            differ by $1,200 in what reaches the seller. Suppressed at zero
            because "a spread of nothing" is worth saying once, not as a
            headline. */}
        {spread && spread.rangeCents > 0 ? (
          <p className="t-sm c-2" style={{ marginTop: 10, lineHeight: 1.6 }}>
            <span className="w6">{money(spread.rangeCents / 100)}</span> separates these,{" "}
            {spread.label.toLowerCase()}.
          </p>
        ) : null}
      </div>

      <div>
        {options.map((o, i) => {
          const isPicked = picked?.id === o.id;
          return (
            <div
              key={o.id}
              style={{
                padding: "14px 18px",
                borderBottom: i === options.length - 1 ? 0 : "1px solid var(--line-3)",
                /* The only option ever highlighted is the one somebody CHOSE.
                   Never a computed best. */
                background: isPicked ? "var(--pos-wash)" : undefined,
              }}
            >
              <div className="between gap-3 wrap" style={{ alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row gap-2 wrap" style={{ alignItems: "center" }}>
                    <span className="t-md w6">{o.label}</span>
                    {isPicked ? (
                      <span className="chip chip-pos t-2xs">
                        <Ico.check size={10} />Chosen
                      </span>
                    ) : null}
                  </div>
                  {o.detail ? (
                    <p className="t-sm c-3" style={{ marginTop: 5, lineHeight: 1.6, maxWidth: 520 }}>
                      {o.detail}
                    </p>
                  ) : null}
                </div>

                {o.amountCents !== null ? (
                  <div style={{ textAlign: "right", flex: "none" }}>
                    <div className="num t-lg">{money(o.amountCents / 100)}</div>
                    <div className="t-2xs c-4">{o.amountLabel}</div>
                  </div>
                ) : null}
              </div>

              {/* Both sides or neither. `balanced()` warns the agent when an
                  option argues only one way, because an option with nothing
                  against it is a recommendation nobody admitted to making. */}
              {o.upside || o.downside ? (
                <div className="col gap-1" style={{ marginTop: 10 }}>
                  {o.upside ? (
                    <div className="row gap-2" style={{ alignItems: "flex-start" }}>
                      <Ico.plus size={11} className="c-pos" style={{ flex: "none", marginTop: 4 }} />
                      <span className="t-xs c-2" style={{ lineHeight: 1.55 }}>{o.upside}</span>
                    </div>
                  ) : null}
                  {o.downside ? (
                    <div className="row gap-2" style={{ alignItems: "flex-start" }}>
                      <Ico.minus size={11} className="c-4" style={{ flex: "none", marginTop: 4 }} />
                      <span className="t-xs c-3" style={{ lineHeight: 1.55 }}>{o.downside}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div style={{ padding: "12px 18px", background: "var(--sunk)" }}>
        {picked ? (
          <p className="t-xs c-3" style={{ lineHeight: 1.6 }}>
            <span className="w6">{picked.label}</span> was chosen
            {decision.decidedAt ? ` on ${new Date(decision.decidedAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : ""}.
            {decision.outcomeNote ? ` ${decision.outcomeNote}` : ""}
          </p>
        ) : decision.chosenOptionId ? (
          /* The database now refuses to delete an option a decision names, so
             this should not occur through the product. It is kept because the
             constraint is deferrable and because the alternative — rendering a
             decided room as undecided — is the kind of quiet wrongness this
             product exists to not produce. An impossible state that says so is
             better than an impossible state that lies. */
          <p className="t-xs c-3" style={{ lineHeight: 1.6 }}>
            A decision was recorded here, and the option it named is no longer listed.
            Ask {agentFirst} about it.
          </p>
        ) : (
          <p className="t-xs c-4" style={{ lineHeight: 1.6 }}>
            Nothing here is a recommendation. These are the options with their numbers and
            their trade-offs; which one is right is a conversation with {agentFirst}, and the
            answer gets written down here once you have had it.
          </p>
        )}
      </div>
    </div>
  );
}
