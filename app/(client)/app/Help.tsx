/**
 * Help, on every client page (Blueprint v5 §7.2): how to reach the agent and
 * what happens next. Calm and specific; never a form or a chatbot (§3.13).
 */
export function Help({ agentName, agentEmail, next }: {
  agentName: string;
  agentEmail: string | null;
  /** What happens next, in a sentence, when the page knows. */
  next?: string | null;
}) {
  const first = agentName.trim().split(/\s+/)[0] || "your agent";
  return (
    <section id="help" className="card p-4" style={{ marginTop: 18, background: "var(--sunk)" }} aria-labelledby="help-h">
      <h2 id="help-h" className="t-md w6">Help</h2>
      {next ? <p className="t-sm c-2" style={{ marginTop: 6, lineHeight: 1.6 }}><span className="w6">What happens next:</span> {next}</p> : null}
      <p className="t-sm c-2" style={{ marginTop: 6, lineHeight: 1.6 }}>
        Questions, or something here looks wrong? {agentEmail
          ? <>Email {first} at <a className="u" href={`mailto:${agentEmail}`}>{agentEmail}</a>, or reply to any email from Rift.</>
          : <>Reply to any email from Rift and it reaches {first}.</>}
        {" "}On business days you hear back the same day.
      </p>
    </section>
  );
}
