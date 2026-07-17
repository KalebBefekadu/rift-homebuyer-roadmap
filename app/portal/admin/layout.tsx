"use client";

import { RequireAuth, useAuth } from "@/components/RequireAuth";
import { AdminNav } from "@/components/AdminNav";

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth role="admin">
      <AdminInner>{children}</AdminInner>
    </RequireAuth>
  );
}

function AdminInner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="min-h-screen bg-[var(--app-bg)]">
      <AdminNav user={user} />
      {children}
    </div>
  );
}
