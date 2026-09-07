#!/usr/bin/env node
/**
 * Creates Brevo normal/text attributes used by lib/brevo/sync.ts:
 * STAGE, TIME_TO_BUY, RIFT_CLIENT_ID, RIFT_EVENT
 *
 * Usage: node --env-file=.env.local scripts/ensure-brevo-attributes.mjs
 *
 * If Brevo returns 401 about an unrecognised IP, whitelist this machine at:
 * https://app.brevo.com/security/authorised_ips
 */

const ATTRS = ["STAGE", "TIME_TO_BUY", "RIFT_CLIENT_ID", "RIFT_EVENT"];

async function main() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("BREVO_API_KEY is not set");
    process.exit(1);
  }

  const headers = {
    accept: "application/json",
    "content-type": "application/json",
    "api-key": apiKey,
  };

  const listRes = await fetch("https://api.brevo.com/v3/contacts/attributes", { headers });
  const listBody = await listRes.text();
  if (!listRes.ok) {
    console.error(`List attributes failed (${listRes.status}): ${listBody.slice(0, 400)}`);
    process.exit(1);
  }

  const parsed = JSON.parse(listBody);
  const existing = new Set(
    (parsed.attributes || []).map((a) => String(a.name || "").toUpperCase()),
  );

  for (const name of ATTRS) {
    if (existing.has(name)) {
      console.log(`OK exists: ${name}`);
      continue;
    }
    const res = await fetch(`https://api.brevo.com/v3/contacts/attributes/normal/${name}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "text" }),
    });
    const body = await res.text();
    if (res.ok || res.status === 204) {
      console.log(`CREATED: ${name}`);
    } else if (res.status === 400 && body.toLowerCase().includes("already")) {
      console.log(`OK exists: ${name}`);
    } else {
      console.error(`FAILED ${name} (${res.status}): ${body.slice(0, 400)}`);
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
