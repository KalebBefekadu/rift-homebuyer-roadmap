"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, type AuthUser } from "@/lib/auth/local";
import { useAuth } from "@/components/RequireAuth";

export function ClientNav({ user }: { user: AuthUser }) {
  const router = useRouter();
  const { refresh } = useAuth();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-black/10 bg-[var(--app-panel)] px-5 py-3">
      <Link href="/portal/client" className="flex items-center gap-2.5 no-underline">
        <span className="font-display grid h-8 w-8 place-items-center rounded-lg bg-[var(--brand)] text-base font-semibold text-white">
          R
        </span>
        <div>
          <div className="font-display text-[17px] font-semibold leading-tight text-[var(--brand)]">
            Your portal
          </div>
          <div className="text-[10px] text-[var(--muted)]">{user.name}</div>
        </div>
      </Link>
      <nav className="flex items-center gap-1">
        <Link
          href="/portal/client"
          className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-[13px] font-semibold text-white no-underline"
        >
          Roadmap
        </Link>
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
          className="cursor-pointer rounded-lg border-0 bg-transparent px-3 py-1.5 text-[13px] font-semibold text-[var(--muted)] hover:bg-black/5"
        >
          Log out
        </button>
      </nav>
    </header>
  );
}
