"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ico, Mark } from "@/components/rift/icons";
import { signOut } from "./actions";

/**
 * The sidebar on every Operations screen (Blueprint v5 §8.3), replacing the
 * top bar that barely fitted at 1280px.
 *
 * Built from the mock-up Kaleb reviewed (D15, three rounds): the six pages he
 * uses daily with icons, the rest smaller underneath under names that say what
 * they are ("Reviews and referrals", "Lead-form questions"), and one primary
 * button. On a phone it folds behind a Menu button.
 *
 * The page it marks is worked out from the address rather than passed in: a
 * page that forgot to say which it was would otherwise mark nothing, or the
 * wrong thing, as the journey page did ("search") for a year.
 *
 * Settings carries the count of decisions still his to make, on every screen:
 * until he has made them, this badge is the only thing that says so.
 */
const MAIN: { href: string; label: string; icon: keyof typeof Ico; match: RegExp }[] = [
  { href: "/operations", label: "Today", icon: "home", match: /^\/operations\/?$/ },
  { href: "/operations/clients", label: "Relationships", icon: "users", match: /^\/operations\/(clients|lead|journey|add)/ },
  { href: "/operations/search", label: "Search", icon: "search", match: /^\/operations\/search/ },
  { href: "/operations/offers", label: "Offers", icon: "scale", match: /^\/operations\/offers/ },
  { href: "/operations/calendar", label: "Calendar", icon: "cal", match: /^\/operations\/calendar/ },
];
const MORE: { href: string; label: string; match: RegExp }[] = [
  { href: "/operations/referrals", label: "Reviews and referrals", match: /^\/operations\/referrals/ },
  { href: "/operations/pilot", label: "Reports", match: /^\/operations\/pilot/ },
  { href: "/operations/questions", label: "Lead-form questions", match: /^\/operations\/questions/ },
  { href: "/operations/settings", label: "Settings", match: /^\/operations\/settings/ },
];

export function OpsNav({ agentName, undecided = 0 }: { agentName: string; undecided?: number }) {
  const path = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  /* A page change closes the phone menu; otherwise it covers the page it opened. */
  useEffect(() => { setOpen(false); }, [path]);

  return (
    <>
      <div className="opsx-top no-print">
        <button className="btn btn-g btn-sm" aria-expanded={open} aria-controls="opsx-side" onClick={() => setOpen((o) => !o)}>
          <Ico.filter size={14} aria-hidden /> Menu
        </button>
        <Link href="/operations" className="row gap-2" aria-label="Rift Operations, Today"><Mark size={17} /><span className="w6 t-sm">Operations</span></Link>
      </div>
      {open ? <div className="opsx-scrim" onClick={() => setOpen(false)} aria-hidden /> : null}
      <aside id="opsx-side" className={`opsx-side no-print ${open ? "is-open" : ""}`} aria-label="Operations">
        <Link href="/operations" className="opsx-brand" aria-label="Rift Operations, Today">
          <Mark size={18} /><span>Operations</span>
        </Link>
        <Link href="/operations/add" className="opsx-add"><Ico.plus size={14} aria-hidden />Add someone</Link>
        <nav aria-label="Pages" className="opsx-navgroup">
          {MAIN.map((n) => {
            const Icon = Ico[n.icon];
            const here = n.match.test(path);
            return (
              <Link key={n.href} href={n.href} className="opsx-nav" aria-current={here ? "page" : undefined}>
                <Icon size={15} aria-hidden />{n.label}
              </Link>
            );
          })}
        </nav>
        <nav aria-label="More pages" className="opsx-navgroup opsx-more">
          {MORE.map((n) => (
            <Link key={n.href} href={n.href} className="opsx-nav" aria-current={n.match.test(path) ? "page" : undefined}>
              {n.label}
              {n.href.endsWith("settings") && undecided ? (
                <span className="opsx-count" title="Decisions still yours to make">{undecided}<span className="sr-only"> decisions to make</span></span>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="opsx-foot">
          <span className="t-xs c-4 trunc">{agentName}</span>
          <form action={signOut}><button className="opsx-signout" type="submit">Sign out</button></form>
        </div>
      </aside>
    </>
  );
}
