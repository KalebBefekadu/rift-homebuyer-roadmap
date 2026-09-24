/**
 * Maps Supabase's /rest/v1 prefix onto a bare PostgREST.
 *
 * supabase-js builds every URL as `${SUPABASE_URL}/rest/v1/<table>`; PostgREST
 * serves at the root. Rewriting the path here rather than hand-writing URLs in
 * a test keeps the REAL query builder in the loop, which is the only version
 * worth verifying: building those URLs is the part that goes wrong.
 */
import http from "node:http";
import { createHmac } from "node:crypto";

const TARGET = process.env.PGRST_URL ?? "http://localhost:3001";
/* Supabase Storage (supabase/storage-api), started by up.sh on 5055: 5000 is
   often taken by macOS AirPlay. */
const STORAGE = process.env.STORAGE_URL ?? "http://localhost:5055";
const SECRET = "rift-local-test-secret-at-least-32-chars-long";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const SERVICE_TOKEN = (() => {
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ role: "service_role", iat: 1700000000, exp: 2000000000 });
  return `${h}.${p}.${createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
})();

/**
 * Locally the server's "service role key" is an anon token (env.sh), which is
 * all PostgREST needs here. Storage enforces roles, so for /storage/v1 that
 * exact token, anon with no user, is upgraded to the service role: what the
 * real service key is in production. A browser upload to a signed URL carries
 * no Authorization header and passes through as it is.
 */
function storageHeaders(headers) {
  const out = { ...headers };
  const token = String(out.authorization ?? "").replace(/^Bearer\s+/i, "");
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    if (claims.role === "anon" && !claims.sub) out.authorization = `Bearer ${SERVICE_TOKEN}`;
  } catch { /* no token: leave it */ }
  return out;
}
const PORT = Number(process.env.PROXY_PORT ?? 3002);

/**
 * A minimal stand-in for GoTrue's /auth/v1/user.
 *
 * Studio is the only surface behind a login, and without this it could never be
 * seen with real data locally: everything behind the session was unit- and
 * query-tested, and the rendering was not. That is the gap this closes.
 *
 * It answers with a fixed user whose id matches the agent row the local stack
 * creates. It verifies nothing, which is exactly why it is here and not
 * anywhere near production: `scripts/local/*` is development-only by
 * construction, and nothing imports it.
 */
const LOCAL_USER = {
  id: "cccc0000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "kaleb@example.com",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date(0).toISOString(),
};

http.createServer(async (req, res) => {
  const path = req.url ?? "";

  if (path.startsWith("/auth/v1/user")) {
    /* A forged token that carries `sub` and `email` claims answers as that
       user, so the buyer's signed-in pages (/app) can be rendered locally as
       somebody who is not the agent. Anything else is the seeded agent. */
    let user = LOCAL_USER;
    try {
      const token = String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      const claims = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
      if (claims.sub && claims.email) user = { ...LOCAL_USER, id: claims.sub, email: claims.email };
    } catch { /* not a JWT: the seeded agent */ }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(user));
    return;
  }
  if (path.startsWith("/auth/v1/")) {
    /* Everything else GoTrue would serve (token refresh, OTP) is not needed
       to render Studio, and answering it plausibly would invite somebody to
       trust this thing further than it deserves. */
    res.writeHead(501, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "local proxy implements /auth/v1/user only" }));
    return;
  }

  const storage = path.startsWith("/storage/v1/");
  /* In a Supabase project the API gateway (Kong) answers CORS for Storage,
     which is what lets a browser upload straight to a signed URL. The
     storage server itself does not, so this proxy stands in for the gateway. */
  const cors = {
    "access-control-allow-origin": req.headers.origin ?? "*",
    "access-control-allow-methods": "GET,HEAD,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": req.headers["access-control-request-headers"] ?? "authorization,apikey,content-type,x-upsert",
    "access-control-max-age": "3600",
  };
  if (storage && req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  const url = storage ? STORAGE + path.replace(/^\/storage\/v1/, "") : TARGET + path.replace(/^\/rest\/v1/, "");
  const chunks = [];
  for await (const c of req) chunks.push(c);

  const headers = storage ? storageHeaders(req.headers) : { ...req.headers };
  delete headers.host;
  delete headers["content-length"];

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method ?? "") ? undefined : Buffer.concat(chunks),
    });
    const out = Object.fromEntries(upstream.headers);
    /* The body is sent whole below, already decoded by fetch. */
    delete out["content-encoding"];
    delete out["content-length"];
    res.writeHead(upstream.status, storage ? { ...out, ...cors } : out);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: e instanceof Error ? e.message : "proxy failed" }));
  }
}).listen(PORT, () => console.log(`rift local proxy on ${PORT} → ${TARGET}`));
