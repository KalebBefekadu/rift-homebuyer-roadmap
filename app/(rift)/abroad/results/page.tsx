import type { Metadata } from "next";
import Link from "next/link";
import { GA_COUNTIES } from "@/lib/core/registry";
import { currentRate } from "@/lib/db/rates";
import {
  abroadReturns, breakEvenDownPct, parseAbroadParams, statusById, ASSUMPTIONS,
} from "@/lib/core/abroad";
import { money } from "@/lib/core/compute";
import { FALLBACK_RATE } from "@/lib/core/rate";
import { translator, ETHIOPIC_STACK, isLocale, type Locale } from "@/lib/core/i18n";
import { Ico, Mark } from "@/components/rift/icons";

/* The title follows the page. A tab that says one thing in English above a
   page written in Amharic is the same half-translated feeling this work was
   done to remove. */
export async function generateMetadata({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const raw = Array.isArray(sp.lang) ? sp.lang[0] : sp.lang;
  const t = translator(isLocale(raw) ? raw : "en");
  return { title: t("res.title"), robots: { index: false } };
}

export const dynamic = "force-dynamic";

/**
 * The readout for a buyer abroad.
 *
 * It exists because the buyer readout is the wrong document for this person.
 * That one is built around closing a cash gap by saving, and it names Georgia
 * Dream and the other assistance programmes throughout — every one of which
 * requires the buyer to occupy the house, and most of which require a Social
 * Security number. Sending a foreign national there was the same false promise
 * this page's hero was built to avoid, reintroduced one click later.
 *
 * No questions of its own. The landing page already asked the four that matter
 * and they travel in the URL, so this renders immediately — and, like every
 * other readout here, it is addressable, ungated, and keeps working if the
 * person never speaks to anyone.
 *
 * Bilingual on the SERVER, unlike the landing page, which switches in the
 * browser. That is not a stylistic difference: this page has no state to
 * preserve and nothing to hydrate, so reading the language out of the URL and
 * rendering it once is both simpler and better. It also means an Amharic
 * reader never sees a frame of English first.
 */
export default async function AbroadResults({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;

  const i = parseAbroadParams(one, GA_COUNTIES);
  const rate = await currentRate();

  /* Carried from the landing page's toggle. Until this read existed the
     language travelled in the URL and was then ignored, so switching to
     Amharic and tapping through landed on a wall of English — the click-through
     was the moment the product stopped speaking to them. */
  const langParam = one("lang");
  const locale: Locale = isLocale(langParam) ? langParam : "en";
  const t = translator(locale);
  const am = locale === "am";
  const script: React.CSSProperties = am ? { fontFamily: ETHIOPIC_STACK } : {};
  /* Ethiopic needs more room between lines than Latin at the same size. */
  const body: React.CSSProperties = am ? { ...script, lineHeight: 1.85 } : {};

  /* The recorded rate, not the module's starting assumption. Showing one rate
     and computing with another is the class of defect this product cannot
     survive, and it is the one the hardcoded figure here was heading for. */
  const a = { ...ASSUMPTIONS, baseRatePct: rate.pct };
  const r = abroadReturns(i, a);
  const s = statusById(i.status);
  const breakEven = breakEvenDownPct(i, a);

  const q = `s=${i.status}&u=${i.use}&p=${i.price}&c=${encodeURIComponent(i.county)}&d=${i.downPct}`;
  const back = `/abroad?${q}&lang=${locale}`;

  /* Which of the four blockers applies. Worked out once so the heading and the
     sentence under it cannot disagree — they are two halves of one claim. */
  const blocker = i.use === "live" ? "live"
    : r.cashFlow >= 0 ? "tenant"
      : breakEven !== null ? "under" : "never";

  const blockerBody = {
    live: t("res.block.live.body", {
      monthly: money(r.monthly.total), principal: money(r.year1.principal),
    }),
    tenant: t("res.block.tenant.body", {
      flow: money(r.cashFlow), worse: money(r.cashFlow - r.rent / 12),
    }),
    under: t("res.block.under.body", {
      breakEven: breakEven ?? 0,
      needed: money((i.price * (breakEven ?? 0)) / 100),
      have: money(r.down),
    }),
    never: t("res.block.never.body", { price: money(i.price), county: i.county }),
  }[blocker];

  return (
    /* `lang` on the subtree rather than on <html>, which a nested server
       component cannot reach. A screen reader switches voice on the element,
       so this is the correct scope rather than a workaround. */
    <div className="buy" lang={locale}>
      <header style={{ borderBottom: "1px solid var(--line-2)" }}>
        <div className="shell-w between" style={{ height: 58 }}>
          <Link href={`/abroad?lang=${locale}`} className="row gap-2">
            <Mark size={20} />
            <span className="mark-name" style={{ fontSize: 19 }}>Rift</span>
            <span className="chip chip-brand hide-sm" style={script}>{t("nav.abroad")}</span>
          </Link>
          <Link href={back} className="t-sm c-2" style={script}>{t("res.change")}</Link>
        </div>
      </header>

      <main className="shell-w" style={{ paddingTop: "clamp(26px,4vw,48px)" }}>
        <div className="kicker c-brand" style={script}>
          {t("res.kicker", {
            price: money(i.price), county: i.county,
            use: i.use === "rent" ? t("res.kicker.rent") : t("res.kicker.live"),
          })}
        </div>
        <h1 className={am ? "" : "serif"} style={{
          fontSize: am ? "clamp(24px,3.3vw,38px)" : "clamp(28px,4vw,46px)",
          lineHeight: am ? 1.4 : 1.08,
          letterSpacing: am ? "0" : "-0.026em",
          marginTop: 12, maxWidth: 760, ...script,
        }}>
          {r.cashFlow >= 0 && i.use === "rent"
            ? t("res.h1.covers")
            : i.use === "rent"
              ? t("res.h1.short", { amount: money(Math.abs(r.cashFlow)), pct: r.returnPct.toFixed(1) })
              : t("res.h1.live", { amount: money(r.cashIn) })}
        </h1>

        {/* What leaves the account. The first thing anyone abroad wants. */}
        <section className="sec">
          <div className="g2 gap-4">
            <div className="card" style={{ overflow: "hidden", alignSelf: "start" }}>
              <div className="between" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-2)" }}>
                <span className="t-md w6" style={script}>{t("res.send.title")}</span>
                <span className="num t-sm c-4" style={script}>{t("res.send.downChip", { pct: r.downPct })}</span>
              </div>
              {[
                [t("res.send.down"), r.down, t("res.send.down.note", { pct: r.downPct })],
                [t("res.send.closing"), r.closing, t("res.send.closing.note", { pct: ASSUMPTIONS.closingPct })],
              ].map(([l, v, n]) => (
                <div key={l as string} className="between" style={{ padding: "12px 18px", borderBottom: "1px solid var(--line-3)", gap: 12 }}>
                  <div className="grow">
                    <div className="t-sm w5" style={script}>{l as string}</div>
                    <div className="t-xs c-4" style={{ marginTop: 1, ...body }}>{n as string}</div>
                  </div>
                  <span className="num t-sm">{money(v as number)}</span>
                </div>
              ))}
              <div className="between" style={{ padding: "15px 18px", background: "var(--sunk)" }}>
                <span className="t-md w6" style={script}>{t("res.send.total")}</span>
                <span className="num" style={{ fontSize: 21 }}>{money(r.cashIn)}</span>
              </div>
            </div>

            <div className="card" style={{ overflow: "hidden", alignSelf: "start" }}>
              <div className="between" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-2)" }}>
                <span className="t-md w6" style={script}>{t("res.month.title")}</span>
                <span className="num t-sm c-4">{rate.pct.toFixed(2)}% + {s.ratePremium}</span>
              </div>
              {[
                [t("res.month.pi"), r.monthly.pi],
                [t("res.month.tax"), r.monthly.tax],
                [t("res.month.ins"), r.monthly.insurance],
              ].map(([l, v]) => (
                <div key={l as string} className="between" style={{ padding: "11px 18px", borderBottom: "1px solid var(--line-3)" }}>
                  <span className="t-sm w5" style={script}>{l as string}</span>
                  <span className="num t-sm c-neg">−{money(v as number)}</span>
                </div>
              ))}
              {i.use === "rent" ? (
                <>
                  <div className="between" style={{ padding: "11px 18px", borderBottom: "1px solid var(--line-3)" }}>
                    <span className="t-sm w5" style={script}>{t("out.rent")}</span>
                    <span className="num t-sm">{money(r.rent)}</span>
                  </div>
                  {[
                    [t("res.month.mgmt"), r.operating.management, t("res.month.mgmt.note", { pct: ASSUMPTIONS.managementPct })],
                    [t("res.month.vac"), r.operating.vacancy, t("res.month.vac.note", { pct: ASSUMPTIONS.vacancyPct })],
                    [t("res.month.maint"), r.operating.maintenance, t("res.month.maint.note", { pct: ASSUMPTIONS.maintenancePct })],
                  ].map(([l, v, n]) => (
                    <div key={l as string} className="between" style={{ padding: "11px 18px", borderBottom: "1px solid var(--line-3)", gap: 12 }}>
                      <div className="grow">
                        <div className="t-sm w5" style={script}>{l as string}</div>
                        <div className="t-xs c-4" style={{ marginTop: 1, ...body }}>{n as string}</div>
                      </div>
                      <span className="num t-sm c-neg">−{money(v as number)}</span>
                    </div>
                  ))}
                  <div className="between" style={{ padding: "15px 18px", background: r.cashFlow >= 0 ? "var(--brand-wash)" : "var(--sunk)" }}>
                    <span className="t-md w6" style={script}>
                      {r.cashFlow >= 0 ? t("res.month.left") : t("res.month.short")}
                    </span>
                    <span className="num" style={{ fontSize: 21, color: r.cashFlow >= 0 ? "var(--brand-2)" : undefined }}>
                      {r.cashFlow < 0 ? "−" : ""}{money(Math.abs(r.cashFlow))}
                    </span>
                  </div>
                </>
              ) : (
                <div className="between" style={{ padding: "15px 18px", background: "var(--sunk)" }}>
                  <span className="t-md w6" style={script}>{t("res.month.costs")}</span>
                  <span className="num" style={{ fontSize: 21 }}>{money(r.monthly.total)}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* The part nobody counts. */}
        <section className="sec">
          <h2 className={am ? "" : "serif"} style={{
            fontSize: am ? "clamp(20px,2.3vw,27px)" : "clamp(22px,2.6vw,32px)",
            letterSpacing: am ? "0" : "-0.02em", lineHeight: am ? 1.45 : undefined,
            maxWidth: 560, ...script,
          }}>
            {t("res.year.h2")}
          </h2>
          <p className="t-md c-3" style={{ marginTop: 12, maxWidth: 560, lineHeight: 1.65, ...body }}>
            {t("res.year.lede")}
          </p>
          <div className="g3 gap-3" style={{ marginTop: 22 }}>
            {[
              [t("res.year.flow"), r.year1.cashFlow, t("res.year.flow.note")],
              [t("res.year.principal"), r.year1.principal, t("res.year.principal.note")],
              [
                t("res.year.appreciation", { pct: ASSUMPTIONS.appreciationPct }),
                r.year1.appreciation,
                t("res.year.appreciation.note", { price: money(i.price) }),
              ],
            ].map(([ttl, v, n]) => (
              <div key={ttl as string} className="card p-4">
                <div className="t-xs c-4" style={script}>{ttl as string}</div>
                <div className="num" style={{ fontSize: 26, marginTop: 6, color: (v as number) < 0 ? "var(--neg)" : undefined }}>
                  {(v as number) < 0 ? "−" : ""}{money(Math.abs(v as number))}
                </div>
                <p className="t-xs c-3" style={{ marginTop: 6, lineHeight: 1.55, ...body }}>{n as string}</p>
              </div>
            ))}
          </div>
          <div className="card p-4" style={{ marginTop: 14, background: "var(--sunk)" }}>
            <div className="between wrap gap-3">
              <div>
                <div className="t-md w6" style={script}>{t("res.year.total")}</div>
                <p className="t-sm c-3" style={{ marginTop: 4, lineHeight: 1.6, ...body }}>
                  {t("res.year.total.note", { cash: money(r.cashIn) })}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="num" style={{ fontSize: 28 }}>{money(r.year1.total)}</div>
                <div className="t-sm c-3" style={script}>{t("res.year.of", { pct: r.returnPct.toFixed(1) })}</div>
              </div>
            </div>
          </div>
        </section>

        {/* The one thing in the way, named plainly. */}
        <section className="sec">
          <div className="g2 gap-4">
            <div className="card p-5">
              <div className="kicker c-brand" style={script}>{t("res.block.kicker")}</div>
              <div className="t-lg w6" style={{ marginTop: 10, ...script, lineHeight: am ? 1.5 : undefined }}>
                {blocker === "under"
                  ? t("res.block.under", { pct: r.downPct })
                  : t(`res.block.${blocker}`)}
              </div>
              <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.65, ...body }}>{blockerBody}</p>
            </div>
            <div className="card p-5">
              <div className="kicker c-brand" style={script}>{t("lender.title")}</div>
              {/* Written out in the dictionary rather than derived from the
                  first-person label with a regex, which used to render
                  "You'm a U.S. citizen living abroad". */}
              <div className="t-lg w6" style={{ marginTop: 10, ...script, lineHeight: am ? 1.5 : undefined }}>
                {t(`status.${i.status}.you`)}
              </div>
              <p className="t-sm c-3" style={{ marginTop: 8, lineHeight: 1.65, ...body }}>
                {t(`status.${i.status}.asks`)}
              </p>
              <p className="t-xs c-4" style={{ marginTop: 10, lineHeight: 1.6, ...body }}>
                {t("res.lender.rate", {
                  rate: rate.pct.toFixed(2), premium: s.ratePremium,
                  /* A recorded source is an institution's name and stays as it
                     is in either language. Our own fallback sentence does not. */
                  source: rate.source === FALLBACK_RATE.source
                    ? t("res.rate.assumption")
                    : rate.source,
                })}
              </p>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="card" style={{ padding: "clamp(24px,3vw,40px)", background: "var(--ink)", borderColor: "var(--ink)" }}>
            <h3 className={am ? "" : "serif"} style={{
              fontSize: am ? "clamp(19px,2.2vw,26px)" : "clamp(21px,2.6vw,30px)",
              color: "#fff", letterSpacing: am ? "0" : "-0.02em",
              maxWidth: 520, lineHeight: am ? 1.5 : 1.15, ...script,
            }}>
              {t("res.keep.h3")}
            </h3>
            <p style={{ marginTop: 12, color: "rgba(255,255,255,.62)", fontSize: 15, lineHeight: am ? 1.85 : 1.6, maxWidth: 520, ...script }}>
              {t("res.keep.body")}
            </p>
            <div className="row gap-2 wrap" style={{ marginTop: 22 }}>
              <Link href={`/book?v=abroad&lang=${locale}`} className="btn btn-lg" style={{ background: "#fff", color: "var(--ink)" }}>
                <span style={script}>{t("res.keep.cta")}</span> <Ico.arrowR size={15} />
              </Link>
              <Link href={back} className="btn btn-lg" style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.24)" }}>
                <span style={script}>{t("res.change")}</span>
              </Link>
            </div>
          </div>
        </section>

        <p className="t-xs c-4 sec" style={{ maxWidth: 720, lineHeight: 1.6, paddingBottom: 60, ...body }}>
          {t("res.disc")}
        </p>
      </main>
    </div>
  );
}
