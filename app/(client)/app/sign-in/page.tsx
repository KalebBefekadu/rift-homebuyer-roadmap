import type { Metadata } from "next";
import { Mark } from "@/components/rift/icons";
import { SignInForm } from "./SignInForm";
import { LangSwitch } from "@/components/rift/LangSwitch";
import { ETHIOPIC_STACK } from "@/lib/core/i18n";
import { portalT } from "../lang";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

/* Why they are back here, by the reason the confirm route gave (pt.si.* in lib/core/i18n.ts). */
const WHY: Record<string, string> = {
  expired: "pt.si.expired",
  missing_code: "pt.si.missing",
  other_device: "pt.si.otherDevice",
  unconfigured: "pt.si.unconfigured",
};

/**
 * The buyer's sign-in: a password, or a link by email. Never an account for
 * an address nobody invited (app/api/app/route.ts): passwords are created from
 * an invitation or from the account page, not here.
 */

/* Back to where they were going, but only within the client's own pages. */
const safeNext = (n: string | undefined) => (n && /^\/app(\/|$|\?)/.test(n) && !n.startsWith("//") ? n : "/app");
export default async function ClientSignIn({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const { locale, t } = await portalT();
  const reason = q.error ? t(WHY[q.error] ?? WHY.expired!) : q.out ? t("pt.si.out") : null;
  return (
    <main lang={locale} className="shell-w sec" style={{ maxWidth: 460, ...(locale === "am" ? { fontFamily: ETHIOPIC_STACK } : {}) }}>
      <div className="between gap-2" style={{ marginBottom: 22 }}>
        <span className="row gap-2">
          <Mark size={20} />
          <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
        </span>
        <LangSwitch locale={locale} label={t("pt.lang")} />
      </div>
      <div className="card p-5">
        <h1 className="serif" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>{t("pt.si.title")}</h1>
        <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.6 }}>{t("pt.si.lede")}</p>
        {reason ? <p className="t-xs c-3" style={{ marginTop: 10 }}>{reason}</p> : null}
        <SignInForm next={safeNext(q.next)} locale={locale} />
      </div>
      {/* Blueprint v5 §7.3. The form sends nothing to an address nobody
          invited, and cannot say so without revealing who is a client, so the
          way in is explained here instead, for everyone. */}
      <div className="t-sm c-3" style={{ marginTop: 18, lineHeight: 1.6, paddingInline: 4 }}>
        <div className="w6 c-2">{t("pt.si.first")}</div>
        <p style={{ marginTop: 4 }}>{t("pt.si.firstBody")}</p>
      </div>
    </main>
  );
}
