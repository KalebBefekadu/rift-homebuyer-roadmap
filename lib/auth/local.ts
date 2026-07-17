export type UserRole = "admin" | "client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

interface StoredAuthUser extends AuthUser {
  passwordHash: string;
}

const USERS_KEY = "rift-auth-users-v1";
const SESSION_KEY = "rift-auth-session-v1";

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function loadUsers(): StoredAuthUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredAuthUser[]) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredAuthUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getSession(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function setSession(user: AuthUser): void {
  const { id, email, name, role, createdAt } = user;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id, email, name, role, createdAt }));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function portalPathForRole(role: UserRole): string {
  return role === "admin" ? "/portal/admin/pipeline" : "/portal/client";
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<{ user: AuthUser } | { error: string }> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!name || !email || !input.password) return { error: "Name, email, and password are required." };
  if (input.password.length < 6) return { error: "Password must be at least 6 characters." };

  const users = loadUsers();
  if (users.some((u) => u.email === email)) return { error: "An account with that email already exists." };

  const user: StoredAuthUser = {
    id: crypto.randomUUID(),
    email,
    name,
    role: input.role,
    passwordHash: await hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  const session: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
  setSession(session);
  return { user: session };
}

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<{ user: AuthUser } | { error: string }> {
  const email = input.email.trim().toLowerCase();
  const users = loadUsers();
  const found = users.find((u) => u.email === email);
  if (!found) return { error: "No account found for that email." };
  const hash = await hashPassword(input.password);
  if (hash !== found.passwordHash) return { error: "Incorrect password." };
  const session: AuthUser = {
    id: found.id,
    email: found.email,
    name: found.name,
    role: found.role,
    createdAt: found.createdAt,
  };
  setSession(session);
  return { user: session };
}

export function signOut(): void {
  clearSession();
}
