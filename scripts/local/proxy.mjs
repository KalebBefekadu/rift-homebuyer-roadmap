/**
 * Maps Supabase's /rest/v1 prefix onto a bare PostgREST.
 *
 * supabase-js builds every URL as `${SUPABASE_URL}/rest/v1/<table>`; PostgREST
 * serves at the root. Rewriting the path here rather than hand-writing URLs in
 * a test keeps the REAL query builder in the loop, which is the only version
 * worth verifying — building those URLs is the part that goes wrong.
 */
import http from "node:http";

const TARGET = process.env.PGRST_URL ?? "http://localhost:3001";
const PORT = Number(process.env.PROXY_PORT ?? 3002);

/**
 * A minimal stand-in for GoTrue's /auth/v1/user.
 *
 * Studio is the only surface behind a login, and without this it could never be
 * seen with real data locally — everything behind the session was unit- and
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
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(LOCAL_USER));
    return;
  }
  if (path.startsWith("/auth/v1/")) {
    /* Everything else GoTrue would serve — token refresh, OTP — is not needed
       to render Studio, and answering it plausibly would invite somebody to
       trust this thing further than it deserves. */
    res.writeHead(501, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "local proxy implements /auth/v1/user only" }));
    return;
  }

  const url = TARGET + path.replace(/^\/rest\/v1/, "");
  const chunks = [];
  for await (const c of req) chunks.push(c);

  const headers = { ...req.headers };
  delete headers.host;
  delete headers["content-length"];

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method ?? "") ? undefined : Buffer.concat(chunks),
    });
    res.writeHead(upstream.status, Object.fromEntries(upstream.headers));
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: e instanceof Error ? e.message : "proxy failed" }));
  }
}).listen(PORT, () => console.log(`rift local proxy on ${PORT} → ${TARGET}`));
