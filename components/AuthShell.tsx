import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-5 py-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 20% 0%, rgba(184,134,47,.25), transparent), radial-gradient(ellipse 60% 40% at 90% 100%, rgba(31,61,43,.5), transparent)",
        }}
      />
      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 no-underline">
          <span className="font-display grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--brand)] text-lg font-semibold text-white">
            R
          </span>
          <span className="font-display text-xl font-semibold text-[var(--app-panel)]">Rift</span>
        </Link>
        <div className="rounded-2xl bg-[var(--app-panel)] px-6 py-8 shadow-xl">
          <h1 className="font-display text-2xl font-semibold text-[var(--brand)]">{title}</h1>
          <p className="mt-1 mb-6 text-[13px] text-[var(--muted)]">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
