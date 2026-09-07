"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Ico, Mark } from "./icons";
import { Palette, usePalette } from "./Palette";

/* ---------------- demo bar ---------------- */

const SURFACES = [
  { href: "/prototype/kaleb", label: "Kaleb" },
  { href: "/prototype/buy", label: "Buy" },
  { href: "/prototype/sell", label: "Sell" },
  { href: "/prototype/app", label: "Client" },
  { href: "/prototype/studio", label: "Studio" },
];

export function DemoBar() {
  const path = usePathname();
  return (
    <div style={{
      position: "fixed", bottom: 14, left: "50%", transform: "translateX(-50%)",
      zIndex: 90, display: "flex", alignItems: "center", gap: 3,
      background: "rgba(13,14,16,.92)", backdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,.11)", borderRadius: 999,
      padding: 3, boxShadow: "0 12px 40px -8px rgba(0,0,0,.5)",
    }}>
      {SURFACES.map((s) => {
        const on = path === s.href || path.startsWith(s.href + "/");
        return (
          <Link key={s.href} href={s.href} style={{
            height: 28, padding: "0 13px", borderRadius: 999, display: "flex", alignItems: "center",
            fontSize: 12, fontWeight: 550, letterSpacing: "-0.005em",
            color: on ? "#0d0e10" : "rgba(255,255,255,.62)",
            background: on ? "#fff" : "transparent", transition: "background .14s, color .14s",
          }}>{s.label}</Link>
        );
      })}
    </div>
  );
}

/* ---------------- client app ---------------- */

const CLIENT_NAV = [
  { href: "/prototype/app", label: "Overview", icon: Ico.home },
  { href: "/prototype/app/plan", label: "Plan", icon: Ico.layers },
  { href: "/prototype/app/money", label: "Money", icon: Ico.wallet },
  { href: "/prototype/app/docs", label: "Documents", icon: Ico.doc },
];

export function ClientShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  return (
    <>
      <header style={{ position: "sticky", top: 0, zIndex: 40, background: "var(--paper)", borderBottom: "1px solid var(--line)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 clamp(16px,3vw,28px)", height: 56 }} className="between">
          <div className="row gap-4" style={{ minWidth: 0 }}>
            <Link href="/prototype/app"><Mark size={21} /></Link>
            <nav className="row railscroll" style={{ gap: 1 }}>
              {CLIENT_NAV.map((n) => {
                const on = path === n.href;
                return (
                  <Link key={n.href} href={n.href} className="row" style={{
                    height: 32, padding: "0 11px", borderRadius: 7, gap: 7, whiteSpace: "nowrap",
                    fontSize: 13.2, fontWeight: on ? 600 : 500,
                    color: on ? "var(--ink)" : "var(--ink-3)", background: on ? "var(--sunk)" : "transparent",
                  }}>
                    <n.icon size={15} />{n.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="row gap-2 rel">
            <Link href="/prototype/app/messages" className="btn btn-g btn-ico" aria-label="Messages"><Ico.mail size={16} /></Link>
            <button className="av" style={{ background: "#2f5480" }} onClick={() => setMenu(!menu)} aria-label="Account">ME</button>
            {menu ? (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 55 }} onClick={() => setMenu(false)} />
                <div className="sheet" style={{ right: 0, top: 42 }}>
                  <div style={{ padding: "7px 9px 9px" }}>
                    <div className="t-sm w6">Maya Ellison</div>
                    <div className="t-xs c-4">maya.ellison@example.com</div>
                  </div>
                  <div className="hr" style={{ margin: "2px 0 4px" }} />
                  <Link href="/prototype/app/share" className="sheet-row" onClick={() => setMenu(false)}><Ico.share size={14} />Share my plan</Link>
                  <Link href="/prototype/app/docs" className="sheet-row" onClick={() => setMenu(false)}><Ico.doc size={14} />Documents</Link>
                  <Link href="/prototype/kaleb" className="sheet-row" onClick={() => setMenu(false)}><Ico.arrowUpR size={14} />Sign out</Link>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "26px clamp(16px,3vw,28px) 110px" }}>{children}</main>
    </>
  );
}

/* ---------------- agent studio ---------------- */

const STUDIO_NAV = [
  { href: "/prototype/studio", label: "Today", icon: Ico.bolt, badge: 8 },
  { href: "/prototype/studio/offers", label: "Offers", icon: Ico.scale, badge: 2 },
  { href: "/prototype/studio/clients", label: "Clients", icon: Ico.users },
  { href: "/prototype/studio/queue", label: "Queue", icon: Ico.layers, badge: 6 },
  { href: "/prototype/studio/calendar", label: "Calendar", icon: Ico.cal },
  { href: "/prototype/studio/settings", label: "Settings", icon: Ico.set },
];

export function StudioShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { open, setOpen } = usePalette();
  const [menu, setMenu] = useState(false);
  const isOn = (h: string) => path === h || (h !== "/prototype/studio" && path.startsWith(h));

  return (
    <div className="studio">
      <Palette open={open} onClose={() => setOpen(false)} />

      {/* mobile top bar */}
      <div className="studio-top" style={{
        position: "sticky", top: 0, zIndex: 45, background: "var(--paper)", borderBottom: "1px solid var(--line)",
      }}>
        <div className="between" style={{ height: 52, padding: "0 14px" }}>
          <Link href="/prototype/studio" className="row gap-2"><Mark size={19} /><span className="mark-name" style={{ fontSize: 17 }}>Rift</span></Link>
          <div className="row gap-1">
            <button className="btn btn-g btn-ico" onClick={() => setOpen(true)} aria-label="Search"><Ico.search size={16} /></button>
            <div className="av av-sm" style={{ background: "var(--accent)" }}>K</div>
          </div>
        </div>
        <div className="railscroll row" style={{ gap: 2, padding: "0 10px 8px" }}>
          {STUDIO_NAV.map((n) => (
            <Link key={n.href} href={n.href} className="row" style={{
              height: 30, padding: "0 11px", borderRadius: 7, gap: 6, whiteSpace: "nowrap", fontSize: 13,
              fontWeight: isOn(n.href) ? 600 : 500,
              color: isOn(n.href) ? "var(--ink)" : "var(--ink-3)",
              background: isOn(n.href) ? "var(--sunk)" : "transparent",
            }}>
              <n.icon size={14} />{n.label}
              {n.badge ? <span className="num t-2xs c-4">{n.badge}</span> : null}
            </Link>
          ))}
        </div>
      </div>

      {/* desktop rail */}
      <aside className="studio-rail" style={{
        background: "var(--paper)", borderRight: "1px solid var(--line)",
        position: "sticky", top: 0, height: "100vh", padding: "14px 10px", display: "flex", flexDirection: "column",
      }}>
        <Link href="/prototype/studio" className="row gap-2" style={{ padding: "4px 8px 14px" }}>
          <Mark size={20} />
          <span className="mark-name" style={{ fontSize: 18 }}>Rift</span>
          <span className="chip chip-out t-2xs" style={{ height: 17, padding: "0 5px" }}>Studio</span>
        </Link>

        <button onClick={() => setOpen(true)} className="row" style={{
          height: 32, padding: "0 9px", borderRadius: 7, border: "1px solid var(--line)",
          background: "var(--canvas)", color: "var(--ink-4)", fontSize: 12.5, marginBottom: 12, gap: 7,
        }}>
          <Ico.search size={14} />
          <span className="grow" style={{ textAlign: "left" }}>Search</span>
          <span className="kbd">⌘K</span>
        </button>

        <nav className="col" style={{ gap: 1 }}>
          {STUDIO_NAV.map((n) => {
            const on = isOn(n.href);
            return (
              <Link key={n.href} href={n.href} className="row" style={{
                height: 31, padding: "0 9px", borderRadius: 7, gap: 9,
                fontSize: 13.2, fontWeight: on ? 600 : 500,
                color: on ? "var(--ink)" : "var(--ink-3)", background: on ? "var(--sunk)" : "transparent",
              }}>
                <n.icon size={15} />
                <span className="grow">{n.label}</span>
                {n.badge ? (
                  <span className="num t-2xs" style={{
                    minWidth: 17, height: 17, borderRadius: 5, display: "grid", placeItems: "center",
                    background: on ? "var(--ink)" : "var(--line-2)", color: on ? "#fff" : "var(--ink-3)",
                    fontWeight: 600, padding: "0 4px",
                  }}>{n.badge}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="spacer" />
        <div className="rel">
          {menu ? (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 55 }} onClick={() => setMenu(false)} />
              <div className="sheet" style={{ bottom: 44, left: 0, right: 0 }}>
                <Link href="/prototype/studio/settings" className="sheet-row" onClick={() => setMenu(false)}><Ico.set size={14} />Settings</Link>
                <Link href="/prototype/app" className="sheet-row" onClick={() => setMenu(false)}><Ico.users size={14} />View as client</Link>
                <Link href="/prototype/kaleb" className="sheet-row" onClick={() => setMenu(false)}><Ico.arrowUpR size={14} />Public site</Link>
              </div>
            </>
          ) : null}
          <button className="row gap-2" onClick={() => setMenu(!menu)} style={{
            width: "100%", padding: "8px", borderTop: "1px solid var(--line-2)", borderRadius: 0,
          }}>
            <div className="av av-sm" style={{ background: "var(--accent)" }}>K</div>
            <div className="grow col" style={{ textAlign: "left" }}>
              <span className="t-xs w55">Kaleb Befekadu</span>
              <span className="t-2xs c-4">Peachtree Cardinal</span>
            </div>
            <Ico.chevD size={13} className="c-4" />
          </button>
        </div>
      </aside>

      <div className="grow" style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function StudioHead({ title, sub, actions, back, tabs }: {
  title: string; sub?: string; actions?: React.ReactNode; back?: { href: string; label: string }; tabs?: React.ReactNode;
}) {
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 30, background: "rgba(251,250,248,.88)",
      backdropFilter: "blur(12px)", borderBottom: "1px solid var(--line)",
      padding: "0 clamp(16px,2.6vw,28px)",
    }}>
      {back ? (
        <Link href={back.href} className="row gap-1 t-xs c-4" style={{ paddingTop: 11 }}>
          <Ico.chevL size={13} />{back.label}
        </Link>
      ) : null}
      <div className="between wrap gap-2" style={{ minHeight: back ? 48 : 58, paddingTop: back ? 2 : 0, paddingBottom: back ? 10 : 0 }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="t-xl w6 trunc">{title}</h1>
          {sub ? <p className="t-xs c-4" style={{ marginTop: 1 }}>{sub}</p> : null}
        </div>
        <div className="row gap-2">{actions}</div>
      </div>
      {tabs ? <div className="row railscroll" style={{ gap: 2 }}>{tabs}</div> : null}
    </header>
  );
}

export function StudioBody({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "22px clamp(16px,2.6vw,28px) 110px" }}>{children}</div>;
}

export function Tab({ href, label, count, on }: { href: string; label: string; count?: number; on: boolean }) {
  return (
    <Link href={href} className="row gap-2" style={{
      height: 36, padding: "0 11px", fontSize: 13, whiteSpace: "nowrap",
      fontWeight: on ? 600 : 500, color: on ? "var(--ink)" : "var(--ink-3)",
      borderBottom: `2px solid ${on ? "var(--ink)" : "transparent"}`, marginBottom: -1,
    }}>
      {label}
      {count !== undefined ? <span className="num t-2xs c-4">{count}</span> : null}
    </Link>
  );
}
