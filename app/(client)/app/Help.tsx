import { portalT } from "./lang";

/**
 * Help, on every client page (Blueprint v5 §7.2): how to reach the agent and
 * what happens next. Calm and specific; never a form or a chatbot (§3.13).
 */
export async function Help({ agentName, agentEmail, next }: {
  agentName: string;
  agentEmail: string | null;
  /** What happens next, in a sentence, when the page knows. */
  next?: string | null;
}) {
  const { t } = await portalT();
  const first = agentName.trim().split(/\s+/)[0] || "your agent";
  return (
    <section id="help" className="card p-4" style={{ marginTop: 18, background: "var(--sunk)" }} aria-labelledby="help-h">
      <h2 id="help-h" className="t-md w6">{t("pt.help.h")}</h2>
      {next ? <p className="t-sm c-2" style={{ marginTop: 6, lineHeight: 1.6 }}><span className="w6">{t("pt.help.next")}</span> <span lang="en">{next}</span></p> : null}
      <p className="t-sm c-2" style={{ marginTop: 6, lineHeight: 1.6 }}>
        {t("pt.help.q")} {agentEmail
          ? <>{t("pt.help.emailAt", { agent: first })} <a className="btn-link" href={`mailto:${agentEmail}`}>{agentEmail}</a>, {t("pt.help.orReply")}</>
          : <>{t("pt.help.reply", { agent: first })}</>}
        {" "}{t("pt.help.sameDay")}
      </p>
    </section>
  );
}
