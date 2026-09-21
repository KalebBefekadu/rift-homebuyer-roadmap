#!/usr/bin/env node
/**
 * Is this address a sender Brevo will actually send from — and if not, ask
 * Brevo to verify it.
 *
 * Usage:
 *   node --env-file=.env.local scripts/brevo-sender.mjs <email> [name]
 *
 * Exists because BREVO_FROM_EMAIL being SET is not the same as email WORKING.
 * /api/health reported "configured" the moment the variable existed, and Brevo
 * refuses to send from any address that has not been verified in the account.
 * That is the exact shape of this codebase's recurring bug — a check that
 * asserts configuration rather than outcome — so this script asks Brevo the
 * real question.
 *
 * Creating a sender makes Brevo email a verification link to that address. It
 * prints what it did; it never prints the API key.
 */

const email = (process.argv[2] ?? "").trim();
const name = (process.argv[3] ?? "Kaleb Befekadu").trim();

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Usage: node --env-file=.env.local scripts/brevo-sender.mjs <email> [name]");
  process.exit(1);
}

const apiKey = process.env.BREVO_API_KEY;
if (!apiKey) {
  console.error("BREVO_API_KEY is not set");
  process.exit(1);
}

const headers = { accept: "application/json", "content-type": "application/json", "api-key": apiKey };

const list = await fetch("https://api.brevo.com/v3/senders", { headers });
const listBody = await list.text();
if (!list.ok) {
  console.error(`Listing senders failed (${list.status}): ${listBody.slice(0, 400)}`);
  process.exit(1);
}

const senders = (JSON.parse(listBody).senders ?? []);
console.log(`Senders on the account: ${senders.length}`);
for (const s of senders) {
  console.log(`  ${s.email}  active=${s.active}  name="${s.name}"`);
}

const match = senders.find((s) => String(s.email).toLowerCase() === email.toLowerCase());
if (match) {
  console.log(match.active
    ? `\nREADY: ${email} is a verified, active sender.`
    : `\nPENDING: ${email} exists but is not verified yet. Check that inbox for Brevo's link.`);
  process.exit(match.active ? 0 : 2);
}

const created = await fetch("https://api.brevo.com/v3/senders", {
  method: "POST",
  headers,
  body: JSON.stringify({ name, email }),
});
const createdBody = await created.text();
if (!created.ok) {
  console.error(`Creating the sender failed (${created.status}): ${createdBody.slice(0, 400)}`);
  process.exit(1);
}
console.log(`\nCREATED: ${email} added as a sender. Brevo has emailed a verification link to it.`);
console.log("Nothing sends from this address until that link is clicked.");
process.exit(2);
