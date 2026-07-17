"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSession,
  portalPathForRole,
  type AuthUser,
  type UserRole,
} from "@/lib/auth/local";

const AuthContext = createContext<{
  user: AuthUser | null;
  ready: boolean;
  refresh: () => void;
}>({ user: null, ready: false, refresh: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = () => setUser(getSession());

  useEffect(() => {
    refresh();
    setReady(true);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, refresh }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function RequireAuth({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(portalPathForRole(role))}`);
      return;
    }
    if (user.role !== role) {
      router.replace(portalPathForRole(user.role));
    }
  }, [ready, user, role, router]);

  if (!ready || !user || user.role !== role) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--app-bg)] text-[#c5cbc0]">
        Checking access…
      </div>
    );
  }

  return <>{children}</>;
}
