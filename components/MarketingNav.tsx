"use client";

import Link from "next/link";
import { useAuth } from "@/components/RequireAuth";
import { portalPathForRole } from "@/lib/auth/local";

export function MarketingNav() {
  const { user, ready } = useAuth();

  return (
    <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 px-5 py-4 md:px-10">
      <Link href="/" className="flex items-center gap-2.5 no-underline">
        <span className="font-display grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--brand)] text-lg font-semibold text-white shadow-sm">
          R
        </span>
        <span className="font-display text-xl font-semibold tracking-tight text-white drop-shadow-sm">
          Rift
        </span>
      </Link>
      <nav className="flex items-center gap-2 sm:gap-3">
        {ready && user ? (
          <Link
            href={portalPathForRole(user.role)}
            className="rounded-lg bg-white/95 px-3.5 py-2 text-[13px] font-semibold text-[var(--brand)] no-underline hover:bg-white"
          >
            Open portal
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-[13px] font-semibold text-white/90 no-underline hover:bg-white/10 hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-[13px] font-semibold text-[#1a1408] no-underline hover:brightness-110"
            >
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
