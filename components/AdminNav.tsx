"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, type AuthUser } from "@/lib/auth/local";
import { useAuth } from "@/components/RequireAuth";

const links = [
  { href: "/portal/admin/pipeline", label: "Pipeline" },
  { href: "/portal/admin/roadmap/new", label: "New roadmap" },
  { href: "/portal/admin/settings", label: "Settings" },
];

export function AdminNav({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const { refresh } = useAuth();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-black/10 bg-[var(--app-panel)] px-5 py-3">
      <Link href="/portal/admin/pipeline" className="flex items-center gap-2.5 no-underline">
        <span className="font-display grid h-8 w-8 place-items-center rounded-lg bg-[var(--brand)] text-base font-semibold text-white">
          R
        </span>
        <div>
          <div className="font-display text-[17px] font-semibold leading-tight text-[var(--brand)]">
            Admin portal
          </div>
          <div className="text-[10px] text-[var(--muted)]">{user.name}</div>
        </div>
      </Link>
      <nav className="flex flex-wrap items-center gap-1">
        {links.map((l) => {
          const active =
            pathname === l.href ||
            (l.href.includes("/roadmap") && pathname.includes("/roadmap"));
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold no-underline ${
                active
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)]"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
        <Link
          href="/"
          className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-[var(--muted)] no-underline hover:bg-black/5"
        >
          Site
        </Link>
        <button
          type="button"
          onClick={() => {
            signOut();
            refresh();
            router.push("/");
          }}
          className="cursor-pointer rounded-lg border-0 bg-transparent px-3 py-1.5 text-[13px] font-semibold text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)]"
        >
          Log out
        </button>
      </nav>
    </header>
  );
}
