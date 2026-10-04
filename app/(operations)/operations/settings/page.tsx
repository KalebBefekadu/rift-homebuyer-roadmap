import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { agentSession } from "@/lib/db/session";
import { readAgentRules } from "@/lib/db/settings";
import { agentProfile, profileHistory, type ProfileChange } from "@/lib/db/profile";
import { jobsHealth } from "@/lib/db/jobs";
import { envFacts } from "@/lib/db/setup";
import { DEFAULT_RULES, RULE_LABEL, type BusinessRules } from "@/lib/core/settings";
import { PROFILE } from "@/lib/core/profile";
import { setupCounts, setupItems, type SetupItem } from "@/lib/core/setup";
import type { JobHealth, JobId, JobState } from "@/lib/core/jobs";
import { RETENTION, CONTACT_EMAIL } from "@/lib/core/privacy";
import { showDay, showTime } from "@/lib/core/day";
import { Ico } from "@/components/rift/icons";
import { Unavailable } from "../Unavailable";
import { PageHead, Section, Notice } from "../ui";
import { signOut } from "../actions";
import { Rules } from "./Rules";
import { ProfileForm } from "./ProfileForm";
import { RateForm } from "./RateForm";
import { currentRate } from "@/lib/db/rates";
import { georgiaDay } from "@/lib/core/day";
import { Checklist, SetupRow, StateWord } from "./Checklist";
import s from "./settings.module.css";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

const NAV = [
  { id: "todo", label: "To do" },
  { id: "profile", label: "Profile" },
  { id: "rules", label: "Business rules" },
  { id: "programs", label: "Programs" },
  { id: "rate", label: "Mortgage rate" },
  { id: "email", label: "Email and follow-ups" },
  { id: "integrations", label: "Integrations" },
  { id: "privacy", label: "Data and privacy" },
  { id: "account", label: "Account" },
] as const;

/* A job's last outcome, as a word and a mark (rule 10). */
const JOB_WORD: Record<JobState, { word: string; Icon: typeof Ico.alert; cls: string }> = {
  ok: { word: "Ran on schedule", Icon: Ico.checkCircle, cls: "c-pos" },
  running: { word: "Running now", Icon: Ico.clock, cls: "c-3" },
  never: { word: "No run recorded yet", Icon: Ico.info, cls: "c-warn" },
  missed: { word: "Missed its schedule", Icon: Ico.alert, cls: "c-neg" },
  failed: { word: "Last run failed", Icon: Ico.alert, cls: "c-neg" },
};

/**
 * Settings, organised by what needs doing.
 *
 * Kaleb's note on the first version: it "needs a lot of things more, it
 * should be organized based on what needs to be done". It had six business
 * rules under its own old top bar, and nothing about what was still unset.
 * The product knew: /api/health, the environment, the rules and the agent
 * row between them say what is missing. So the page opens with that list
 * (lib/core/setup.ts), and below it every section is what one kind of
 * setting governs.
 *
 * The rule it is built on is RULE_REACH's: a control that reaches nothing is
 * worse than none. Only what the product stores and reads is editable here;
 * everything else is its status and the exact steps to change it where it
 * lives, which for most integrations is an environment variable in Vercel.
 * No secret's value is ever rendered: set, not set, or what the provider said.
 *
 * The rules still carry the first version's job: the distinction between
 * "chosen" and "still on the default". A settings screen that shows values
 * with no provenance lets a default become a policy by being looked at a few
 * times.
 */
export default async function SettingsPage() {
  const session = await agentSession();
  /* A blip is not an expired session. Redirecting on "unknown" shows the
     agent a sign-in form when the cookie is fine, which says something false
     about what just happened: see lib/db/session.ts. */
  if (session.state === "unknown") return <Unavailable reason={session.reason} />;
  if (session.state === "signed-out") redirect("/operations/sign-in");
  const agent = session.agent;

  const [rulesRead, profileRead, historyRead, jobsRead, rate] = await Promise.all([
    readAgentRules(agent.agentId),
    agentProfile(agent.agentId),
    profileHistory(agent.agentId),
    jobsHealth().catch(() => null),
    currentRate(),
  ]);

  const ruleData = rulesRead.ok && "data" in rulesRead ? rulesRead.data : null;
  const profile = profileRead.ok && "data" in profileRead ? profileRead.data : null;
  const jobs = jobsRead && jobsRead.ok && "data" in jobsRead ? jobsRead.data : null;
  /* null: the history table is not there yet, so a save would be refused. */
  const history = historyRead.ok && "data" in historyRead ? historyRead.data : undefined;

  const env = envFacts();
  const items = setupItems({ ...env, undecided: ruleData?.undecided ?? null, profile, jobs });
  const counts = setupCounts(items);
  const byId = new Map(items.map((i) => [i.id, i]));
  const job = (id: JobId) => jobs?.find((j) => j.job === id) ?? null;

  return (
    <main className="shell-w">
      <PageHead
        title="Settings"
        lede="What is left to set up comes first. Below it, everything is grouped by what it governs."
        meta={<Summary counts={counts} />}
      />

      <div className={s.layout}>
        <nav className={s.nav} aria-label="Settings sections">
          {NAV.map((n) => (
            /* No count here: the sidebar's badge and the chips above already
               say how many, and a third number that differed from both (it
               would count failures the badge cannot see) is a puzzle. */
            <a key={n.id} href={`#${n.id}`} className={s.navLink}>{n.label}</a>
          ))}
        </nav>

        <div className={s.body}>
          <Section id="todo" title="To do" hint="Computed from what the product can see right now: your rules, your profile, the environment and the scheduled jobs. Failing things first.">
            <Checklist items={items} />
          </Section>

          <Section id="profile" title="Profile" hint="How you appear to clients, and where the product reaches you.">
            {!profile ? (
              <Notice tone="neg" title="Your profile did not load">
                {!profileRead.ok ? profileRead.error : "skipped" in profileRead ? profileRead.reason : "The agent record is missing."}. Nothing has been changed.
              </Notice>
            ) : (
              <>
                {history === null ? (
                  <Notice tone="warn" title="Changes cannot be saved yet">
                    The database update that records profile changes (20260929410000) has not been applied here, so a save will be refused rather than made without a record.
                  </Notice>
                ) : null}
                <ProfileForm profile={profile} />
                {history && history.length ? <History changes={history} /> : null}
              </>
            )}
          </Section>

          <Section id="rules" title="Business rules" hint="Six things the product cannot decide for you. Each says what it changes, who owns it, and whether anything acts on it yet. Two are the broker's, not yours.">
            {!rulesRead.ok ? (
              <Notice tone="neg" title="The rules did not load">
                The database did not answer, so this cannot tell a value you chose from a default, and showing you the defaults as though they were your settings is the one thing it must not do. Nothing has been changed. {rulesRead.error}
              </Notice>
            ) : "skipped" in rulesRead ? (
              <Notice tone="info" title="Rules need a database">{rulesRead.reason}. Every figure runs on the defaults, which are a starting position and nobody&rsquo;s decision.</Notice>
            ) : (
              <>
                <Rules rules={ruleData!.rules} undecided={ruleData!.undecided} decided={ruleData!.decided} />
                <p className="t-xs c-4" style={{ marginTop: 10, lineHeight: 1.6 }}>
                  A change here applies to every figure computed from it from the next page load. Nothing already sent to anybody is rewritten.
                </p>
              </>
            )}
          </Section>

          <Section id="programs" title="Programs" hint="How long an assistance program may go unchecked before buyers stop being shown it, and who checks."
            actions={<Link href="/operations/programs" className="btn btn-s btn-sm">Open Programs<Ico.arrowR size={12} /></Link>}>
            <div className={s.card}>
              <RuleFact k="registryDays" data={ruleData} show={(v) => `${v} days`}
                text="A program not verified within this many days is withheld from buyers until it is. The weekly program check renews the ones whose official page has not changed." />
              <RuleFact k="registryOwner" data={ruleData} show={(v) => String(v)}
                text="Named against every program that is overdue, so the task has a person on it." />
              <JobRow job={job("program-check")} jobsKnown={Boolean(jobs)} title="Weekly program check"
                text="Reads each program's official page on Mondays and flags the changed ones for you on Programs." />
            </div>
          </Section>

          <Section id="rate" title="Mortgage rate" hint="The one assumption every monthly figure shares. Read from Freddie Mac's weekly survey on Fridays; record it here when that fails.">
            <div className={s.card}>
              <div className={s.row}>
                <div className={s.rowHead}>
                  <div style={{ minWidth: 0, flex: "1 1 300px" }}>
                    <div className={s.rowTitle}>{rate.pct.toFixed(2)}%, {rate.freshness === "fresh" ? "current" : rate.freshness}</div>
                    <p className={s.rowText}>{rate.label}.</p>
                  </div>
                  <div className={s.rowControl}>
                    <span className={`${s.state} ${rate.freshness === "fresh" ? "c-pos" : "c-warn"}`}>
                      {rate.freshness === "fresh" ? <Ico.checkCircle size={12} /> : <Ico.alert size={12} />}
                      {rate.freshness === "fresh" ? "Fresh" : rate.freshness === "ageing" ? "Ageing" : "Stale"}
                    </span>
                  </div>
                </div>
              </div>
              <JobRow job={job("rates-refresh")} jobsKnown={Boolean(jobs)} title="Weekly rate refresh"
                text="Reads Freddie Mac's published survey file on Friday mornings, the day after it comes out." />
              <div className={s.row}>
                <div className={s.rowTitle} style={{ marginBottom: 8 }}>Record it by hand</div>
                <RateForm today={georgiaDay()} />
              </div>
            </div>
          </Section>

          <Section id="email" title="Email and follow-ups" hint="Who sends, where your own alerts go, and whether the daily jobs that send are running."
            actions={<Link href="/operations/outbox" className="btn btn-s btn-sm">Open Outbox<Ico.arrowR size={12} /></Link>}>
            <div className={s.card}>
              <div className={s.row}>
                <div className={s.rowHead}>
                  <div style={{ minWidth: 0, flex: "1 1 300px" }}>
                    <div className={s.rowTitle}>Sending address</div>
                    <p className={s.rowText}>
                      {env.email.sender ? <>Messages go out from <strong className="w6">{process.env.BREVO_FROM_EMAIL}</strong>, through Brevo, with replies coming back to the same address.</> : "Not set, so Brevo refuses every message."}
                    </p>
                  </div>
                  <div className={s.rowControl}><StateWord state={byId.get("email")!.state} /></div>
                </div>
              </div>
              <div className={s.row}>
                <div className={s.rowHead}>
                  <div style={{ minWidth: 0, flex: "1 1 300px" }}>
                    <div className={s.rowTitle}>Your alerts</div>
                    <p className={s.rowText}>
                      New leads, saved plans and the morning summary go to {profile?.email ? <strong className="w6">{profile.email}</strong> : "your profile address"}. <a href="#profile" className="u">Change it in Profile</a>.
                    </p>
                  </div>
                </div>
              </div>
              <JobRow job={job("daily-summary")} jobsKnown={Boolean(jobs)} title="Morning summary"
                text="Weekday mornings, to the address above, when there is something to report: an empty one is not sent. There is no switch for it; it stops when email sending does." />
              <JobRow job={job("nurture-run")} jobsKnown={Boolean(jobs)} title="Follow-ups"
                text="Automatic steps go out once a day. Calls and anything marked as needing you wait on Today, and a sequence stops the moment somebody replies." />
              <RuleFact k="autoEmailReadout" data={ruleData} show={(v) => (v ? "On" : "Off")}
                text="Whether a readout is emailed the moment it is finished, or only when somebody asks for it." />
            </div>
          </Section>

          <Section id="integrations" title="Integrations" hint="Each one's state, from its outcome where there is one. Keys live in Vercel's environment variables; this page shows whether they are set, never what they are.">
            <ul className={s.list}>
              {items.filter((i) => i.group === "connections").sort(byPageOrder).map((i) => <SetupRow key={i.id} item={i} showGroup={false} />)}
            </ul>
          </Section>

          <Section id="privacy" title="Data and privacy" hint="What is kept, for how long, and how a person removes theirs. The periods are the ones the privacy page and every readout promise."
            actions={<Link href="/privacy" className="btn btn-s btn-sm">Privacy page<Ico.arrowUpR size={12} /></Link>}>
            <div className={s.card} style={{ overflowX: "auto" }}>
              <table className={s.table}>
                <thead><tr><th scope="col">What</th><th scope="col">Kept for</th></tr></thead>
                <tbody>
                  {RETENTION.map((r) => <tr key={r.id}><td>{r.what}</td><td>{r.keptFor}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div className={s.card} style={{ marginTop: 12 }}>
              <JobRow job={job("retention-sweep")} jobsKnown={Boolean(jobs)} title="Deleting expired records"
                text="Runs daily and deletes outright what has passed its period. It does not touch client records or consent records, and says so in its own output." />
              <RuleFact k="clientRetentionYears" data={ruleData} show={(v) => `${v} years`}
                text="How long a client's record is kept after closing. The deletion job leaves client records alone until this is the broker's confirmed number and wired in." />
              <div className={s.row}>
                <div className={s.rowTitle}>&ldquo;Delete all of it&rdquo;</div>
                <p className={s.rowText}>
                  Anyone can delete their own record from their readout or their saved plan, with no account and no reply from you. Somebody who became a client keeps only what licence law requires; their sign-in and links are closed.
                  {CONTACT_EMAIL ? <> Written requests go to {CONTACT_EMAIL}, the address the privacy page gives.</> : null}
                </p>
              </div>
              <div className={s.row}>
                <div className={s.rowTitle}>Trying things out</div>
                <p className={s.rowText}>
                  There is no test mode. A person you add to try something is a real record: it shows in lists and reports, and it can be sent follow-ups. Use an address you read, and archive the record from its page when you are done; archiving takes it off the board and keeps it.
                </p>
              </div>
            </div>
          </Section>

          <Section id="account" title="Account">
            <div className={s.card}>
              <div className={s.row}>
                <div className={s.rowHead}>
                  <div style={{ minWidth: 0, flex: "1 1 300px" }}>
                    <div className={s.rowTitle}>Signed in as {agent.loginEmail || agent.name}</div>
                    <p className={s.rowText}>
                      You sign in with a link emailed to this address. It is the login&rsquo;s address, kept by Supabase, and separate from the alert address in your profile; changing it is done in Supabase under Authentication, then Users.
                    </p>
                  </div>
                  <form action={signOut} className={s.rowControl}>
                    <button type="submit" className="btn btn-s btn-sm">Sign out</button>
                  </form>
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}

const PAGE_ORDER = ["email", "calendar", "scheduler", "monitoring", "site", "ai"];
const byPageOrder = (a: SetupItem, b: SetupItem) => PAGE_ORDER.indexOf(a.id) - PAGE_ORDER.indexOf(b.id);

function Summary({ counts }: { counts: ReturnType<typeof setupCounts> }) {
  if (!counts.open) return <span className="chip chip-pos"><Ico.checkCircle size={11} />Everything is set up</span>;
  return (
    <div className={s.summary}>
      {counts.broken ? <span className="chip chip-neg"><Ico.alert size={11} />{counts.broken} not working</span> : null}
      {counts.todo ? <span className="chip chip-warn"><Ico.arrowR size={11} />{counts.todo} to do</span> : null}
      {counts.confirm ? <span className="chip"><Ico.info size={11} />{counts.confirm} to confirm</span> : null}
      {counts.waiting ? <span className="chip"><Ico.clock size={11} />{counts.waiting} waiting on someone</span> : null}
      <span className="chip chip-out"><Ico.check size={11} />{counts.done} of {counts.total} done</span>
    </div>
  );
}

/** A rule shown where it acts, with the way back to the one place it is changed. */
function RuleFact<K extends keyof BusinessRules>({ k, data, show, text }: {
  k: K;
  data: { rules: BusinessRules; undecided: (keyof BusinessRules)[] } | null;
  show: (v: BusinessRules[K]["value"]) => string;
  text: string;
}) {
  const value = data ? data.rules[k].value : DEFAULT_RULES[k].value;
  const mine = data ? !data.undecided.includes(k) : false;
  return (
    <div className={s.row}>
      <div className={s.rowHead}>
        <div style={{ minWidth: 0, flex: "1 1 300px" }}>
          <div className={s.rowTitle}>
            {RULE_LABEL[k]}: {show(value)}
            {!data ? <span className="chip t-2xs"><Ico.info size={10} />Not read</span>
              : mine ? <span className="chip chip-pos t-2xs"><Ico.check size={10} />Yours</span>
                : <span className="chip chip-warn t-2xs"><Ico.alert size={10} />Default</span>}
          </div>
          <p className={s.rowText}>{text}</p>
        </div>
        <div className={s.rowControl}><a href={`#rule-${k}`} className="btn btn-g btn-sm">Change</a></div>
      </div>
    </div>
  );
}

function JobRow({ job, jobsKnown, title, text }: { job: JobHealth | null; jobsKnown: boolean; title: string; text: string }) {
  const w = job ? JOB_WORD[job.state] : null;
  return (
    <div className={s.row}>
      <div className={s.rowHead}>
        <div style={{ minWidth: 0, flex: "1 1 300px" }}>
          <div className={s.rowTitle}>{title}</div>
          <p className={s.rowText}>{text}</p>
          {job?.lastSuccess ? <p className={s.rowNote}>Last good run {showTime(job.lastSuccess)}.</p> : null}
          {job?.problem ? <p className={`${s.rowNote} c-neg`}><Ico.alert size={11} /><span>{job.problem}</span></p> : null}
        </div>
        <div className={s.rowControl}>
          {w ? <span className={`${s.state} ${w.cls}`}><w.Icon size={12} />{w.word}</span>
            : <span className={`${s.state} c-4`}><Ico.info size={12} />{jobsKnown ? "Not tracked" : "Runs could not be read"}</span>}
        </div>
      </div>
    </div>
  );
}

function History({ changes }: { changes: ProfileChange[] }) {
  return (
    <>
      <div className={s.historyHead}>Recent changes</div>
      <ul className={s.history}>
        {changes.map((c, i) => (
          <li key={i}>
            <span className="w6 c-2">{PROFILE[c.field]?.label ?? c.field}</span>
            <span className={s.historyChange}>
              {c.before ?? <em className="c-4">empty</em>}<Ico.arrowR size={10} aria-label="changed to" />{c.after ?? <em className="c-4">empty</em>}
            </span>
            <span className={s.historyWhen}>{c.by}{c.at ? `, ${showDay(c.at, { day: "numeric", month: "short", year: "numeric" })}` : ""}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
