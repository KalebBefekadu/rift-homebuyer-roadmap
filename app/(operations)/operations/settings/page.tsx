import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { Unavailable } from "../Unavailable";
import { readAgentRules } from "@/lib/db/settings";
import { DEFAULT_RULES, RULE_LABEL, RULE_REACH, type BusinessRules } from "@/lib/core/settings";
import { Ico } from "@/components/rift/icons";
import { Rules } from "./Rules";
import { OpsNav } from "../OpsNav";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The decisions that are not engineering's to make.
 *
 * Six of them, and every one sat in the product as a literal. The handoff
 * called them out as needing "the business owner, not engineering", and they
 * were then hard-coded, which is the worst of both worlds, because the owner
 * cannot change it and the engineer is not allowed to. A decision that lives
 * in a constant has been made by whoever typed the constant.
 *
 * The prototype had a settings page for these. It wrote to localStorage, on
 * one device, where nothing the server computes could read it, and it lives
 * at /prototype/studio/settings, which returns 404 in production. So in the
 * real product these have never been visible, let alone settable, including
 * `commissionPct`, which by its own note is the only number here that turns
 * pipeline into money.
 *
 * The page's real job is the distinction between "chosen" and "still on the
 * default". A settings screen that shows six values and no provenance lets a
 * default become a policy by being looked at a few times.
 */
export default async function SettingsPage() {
  const session = await agentSession();
  /* A blip is not an expired session. Redirecting on "unknown" shows the
     agent a sign-in form when his cookie is fine, which says something false
     about what just happened: see lib/db/session.ts. */
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const agent = session.agent;

  const read = await readAgentRules(agent.agentId);

  if (!read.ok) {
    return (
      <Frame agentName={agent.name} undecided={undecidedOf(read)}>
        <h1 className="serif" style={{ fontSize: 26 }}>Settings could not be loaded.</h1>
        <p className="t-sm c-3" style={{ marginTop: 10, lineHeight: 1.6, maxWidth: 560 }}>
          The database did not answer, so this page cannot tell a value you chose from a default;
          and showing you the defaults as though they were your settings is the one thing it must
          not do. Nothing has been changed. The error was: {read.error}
        </p>
        <Link href="/operations" className="btn btn-p" style={{ marginTop: 18 }}>Back to Operations</Link>
      </Frame>
    );
  }

  if ("skipped" in read) {
    return (
      <Frame agentName={agent.name} undecided={undecidedOf(read)}>
        <h1 className="serif" style={{ fontSize: 26 }}>Settings need a database.</h1>
        <p className="t-sm c-3" style={{ marginTop: 10, lineHeight: 1.6, maxWidth: 560 }}>
          {read.reason}. Until then every figure in the product runs on the defaults below, which
          are a defensible starting position and nobody&rsquo;s decision.
        </p>
        <Defaults />
        <Link href="/operations" className="btn btn-g" style={{ marginTop: 18 }}>Back to Operations</Link>
      </Frame>
    );
  }

  const { rules, undecided, decided } = read.data;

  return (
    <Frame agentName={agent.name} undecided={undecidedOf(read)}>
      <div className="between wrap gap-3" style={{ alignItems: "flex-start" }}>
        <div>
          <h1 className="serif" style={{ fontSize: "clamp(24px,3vw,32px)", letterSpacing: "-0.02em" }}>
            Your decisions
          </h1>
          <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6, maxWidth: 560 }}>
            Six things the product cannot decide for you. Each says what it changes and who owns
            it. Two of them are the broker&rsquo;s, not yours.
          </p>
        </div>
        {undecided.length ? (
          <span className="chip chip-warn" style={{ flex: "none" }}>
            <Ico.alert size={11} />
            {undecided.length} still on the default
          </span>
        ) : (
          <span className="chip chip-pos" style={{ flex: "none" }}>
            <Ico.check size={11} />All decided
          </span>
        )}
      </div>

      {undecided.length ? (
        <div className="card p-4" style={{ marginTop: 18, background: "var(--sunk)" }}>
          <div className="row-t gap-2">
            <Ico.info size={14} className="c-3" style={{ flex: "none", marginTop: 3 }} />
            <p className="t-sm c-3" style={{ lineHeight: 1.6 }}>
              A default is a starting position, not a recommendation, and the product cannot tell
              you apart from it. {undecided.map((k) => RULE_LABEL[k]).join(", ")}
              {undecided.length === 1 ? " is" : " are"} still ours rather than yours.
            </p>
          </div>
        </div>
      ) : null}

      <Rules
        rules={rules}
        undecided={undecided}
        decided={decided}
      />

      {(() => {
        const dormant = (Object.keys(DEFAULT_RULES) as (keyof BusinessRules)[])
          .filter((k) => !RULE_REACH[k].live);
        if (!dormant.length) return null;
        return (
          <div className="card p-4" style={{ marginTop: 20 }}>
            <div className="row-t gap-2">
              <Ico.info size={14} className="c-3" style={{ flex: "none", marginTop: 3 }} />
              <p className="t-sm c-3" style={{ lineHeight: 1.6 }}>
                {dormant.length} of these are recorded but not yet acting on anything: the
                screens they price or govern are not built. Your answer is kept with your name and
                the date, so when they are built the decision is already made rather than made
                again by whoever writes the code.
              </p>
            </div>
          </div>
        );
      })()}

      <p className="t-xs c-4" style={{ marginTop: 28, lineHeight: 1.6, maxWidth: 620 }}>
        Changing a value here changes every figure computed from it, from the next page load.
        Nothing already sent to anybody is rewritten.
      </p>
    </Frame>
  );
}

function Frame({ children, agentName, undecided }: { children: React.ReactNode; agentName: string; undecided: number }) {
  return (
    <>
      <OpsNav agentName={agentName} undecided={undecided} />
      <main className="shell-w sec" style={{ maxWidth: 760 }}>{children}</main>
    </>
  );
}

const undecidedOf = (read: Awaited<ReturnType<typeof readAgentRules>>) =>
  read.ok && "data" in read ? read.data.undecided.length : 0;

/** Read-only, for the degraded case. Never editable without somewhere to save. */
function Defaults() {
  const keys = Object.keys(DEFAULT_RULES) as (keyof BusinessRules)[];
  return (
    <div className="card" style={{ marginTop: 16 }}>
      {keys.map((k, n) => (
        <div key={k} style={{ padding: "13px 18px", borderBottom: n < keys.length - 1 ? "1px solid var(--line-3)" : undefined }}>
          <div className="between wrap gap-2">
            <span className="t-sm w6">{RULE_LABEL[k]}</span>
            <span className="chip">{String(DEFAULT_RULES[k].value)}</span>
          </div>
          <p className="t-xs c-3" style={{ marginTop: 5, lineHeight: 1.55 }}>{DEFAULT_RULES[k].affects}</p>
        </div>
      ))}
    </div>
  );
}
