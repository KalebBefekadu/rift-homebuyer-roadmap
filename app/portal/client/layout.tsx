"use client";

import { RequireAuth, useAuth } from "@/components/RequireAuth";
import { ClientNav } from "@/components/ClientNav";

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="client">
      <ClientInner>{children}</ClientInner>
    </RequireAuth>
  );
}

function ClientInner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      <ClientNav user={user} />
      {children}
    </div>
  );
}
