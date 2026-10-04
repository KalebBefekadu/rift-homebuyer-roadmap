import { createHmac } from "node:crypto";
import type { BrowserContext } from "@playwright/test";

/**
 * The local agent's session cookie, as supabase-js writes it. Signed with the
 * local stand-in's secret, for the user the local proxy answers as: it opens
 * nothing anywhere else.
 */
const SECRET = "rift-local-test-secret-at-least-32-chars-long";
const USER = { id: "cccc0000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "kaleb@example.com", app_metadata: {}, user_metadata: {}, created_at: "1970-01-01T00:00:00.000Z" };

export async function signIn(context: BrowserContext, port: number) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ sub: USER.id, aud: "authenticated", role: "authenticated", email: USER.email, iat: now, exp: now + 3600 });
  const access = `${h}.${p}.${createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
  const session = { access_token: access, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "local", user: USER };
  await context.addCookies([{
    name: "sb-localhost-auth-token",
    value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`,
    domain: "127.0.0.1", path: "/", httpOnly: false, secure: false, sameSite: "Lax",
    expires: now + 3600,
  }]);
  void port;
}
