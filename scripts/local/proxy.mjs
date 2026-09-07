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

http.createServer(async (req, res) => {
  const url = TARGET + (req.url ?? "").replace(/^\/rest\/v1/, "");
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
