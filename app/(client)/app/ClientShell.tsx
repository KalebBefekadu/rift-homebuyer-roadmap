import Link from "next/link";
import { Mark } from "@/components/rift/icons";
import { LangSwitch } from "@/components/rift/LangSwitch";
import { ETHIOPIC_STACK } from "@/lib/core/i18n";
import { portalT } from "./lang";

/**
 * The bar across the buyer's pages: where they are, whose, a way out, and
 * the language (manual review WS11.6). The whole page takes the language's
 * `lang` and face, so a screen reader switches voice and Ethiopic renders.
 */
export async function ClientShell({ agentName, preview, children }: { agentName: string | null; preview?: boolean; children: React.ReactNode }) {
  const { locale, t } = await portalT();
  return (
    <div lang={locale} style={locale === "am" ? { fontFamily: ETHIOPIC_STACK } : undefined}>
      <header style={{ borderBottom: "1px solid var(--line-2)", background: "var(--paper)" }}>
        <div className="shell-w between" style={{ height: 56 }}>
          <Link href="/app" className="row gap-2">
            <Mark size={19} />
            <span className="mark-name" style={{ fontSize: 18 }}>Rift</span>
          </Link>
          <div className="row gap-2">
            {agentName ? <span className="t-xs c-4 hide-sm">{t("pt.with", { agent: agentName })}</span> : null}
            {/* The agent's preview has no account and must not sign the agent out. */}
            {preview ? <span className="chip t-2xs">Preview</span> : (
              <>
                <LangSwitch locale={locale} label={t("pt.lang")} />
                {agentName ? <Link href="/app/account" className="btn btn-g btn-sm">{t("pt.account")}</Link> : null}
                <form action="/app/sign-out" method="post">
                  <button className="btn btn-g btn-sm" type="submit">{t("pt.signout")}</button>
                </form>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="shell-w" style={{ paddingTop: 24, paddingBottom: 60, maxWidth: 760 }}>{children}</main>
    </div>
  );
}
