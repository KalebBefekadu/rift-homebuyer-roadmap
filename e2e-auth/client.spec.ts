import { test, expect, type Browser, type Page } from "@playwright/test";
import { Client } from "pg";
import { createHash, randomBytes } from "node:crypto";

/**
 * A client's way in, against a real Supabase Auth (manual review WS1.8).
 * See playwright.auth.config.ts and scripts/e2e-auth.sh.
 *
 * Each test makes its own invited person, so the tests do not depend on each
 * other's order and a rerun on the same stack starts clean.
 */

const E = process.env;
const ON = Boolean(E.E2E_SUPABASE_URL && E.E2E_SUPABASE_SERVICE_ROLE_KEY && E.E2E_DB_URL && E.E2E_MAILPIT_URL);
test.skip(!ON, "Needs a Supabase stack and Mailpit: run scripts/e2e-auth.sh");

const AGENT_EMAIL = "agent@rift.test";

/* The sign-in actions allow five tries per address per ten minutes
   (lib/core/ratelimit.ts). Every test here comes from the same machine, so
   each page says it is a different one, the way a different visitor would
   be. The limit itself is tested in lib/core/ratelimit.test.ts. */
const asSomeoneNew = (page: Page) =>
  page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 250) + 1).join(".")}` });
test.beforeEach(async ({ page }) => { await asSomeoneNew(page); });

async function admin(path: string, body: object) {
  const res = await fetch(`${E.E2E_SUPABASE_URL}/auth/v1/admin/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: E.E2E_SUPABASE_SERVICE_ROLE_KEY!, authorization: `Bearer ${E.E2E_SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{ id?: string; msg?: string }>;
}

/** The one agent this product has, made once per stack. */
async function agent(c: Client): Promise<string> {
  const have = await c.query("select id from rift_agents limit 1");
  if (have.rows[0]) return have.rows[0].id as string;
  const user = await admin("users", { email: AGENT_EMAIL, email_confirm: true });
  const { rows: [a] } = await c.query(
    "insert into rift_agents (auth_user_id, name, email) values ($1, 'Kaleb Befekadu', $2) returning id", [user.id, AGENT_EMAIL]);
  return a.id as string;
}

/** An invited buyer on a fresh journey, and the invitation link's token. */
async function invited(): Promise<{ email: string; token: string; journeyId: string; label: string }> {
  const c = new Client({ connectionString: E.E2E_DB_URL });
  await c.connect();
  try {
    const agentId = await agent(c);
    const n = randomBytes(4).toString("hex");
    const email = `buyer-${n}@rift.test`;
    const label = `First home ${n}`;
    const { rows: [l] } = await c.query(
      "insert into rift_leads (agent_id, side, name, email, score, band) values ($1, 'buy', 'Test Buyer', $2, 70, 'soon') returning id", [agentId, email]);
    const { rows: [j] } = await c.query(
      "insert into rift_journeys (agent_id, origin_lead_id, side, label) values ($1, $2, 'buy', $3) returning id", [agentId, l.id, label]);
    const token = randomBytes(32).toString("base64url");
    await c.query(
      `insert into rift_journey_members (agent_id, journey_id, email, display_name, role, scopes, invite_token_hash, invite_expires_at)
       values ($1, $2, $3, 'Test Buyer', 'buyer', '{search,homes,money}', $4, now() + interval '1 day')`,
      [agentId, j.id, email, createHash("sha256").update(token).digest("hex")]);
    return { email, token, journeyId: j.id as string, label };
  } finally {
    await c.end();
  }
}

/** The newest email Mailpit has for this address, waiting for it to arrive. */
async function linkFor(email: string, after: number): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(`${E.E2E_MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json() as { messages?: { ID: string; Created: string }[] };
    const m = (list.messages ?? []).find((x) => Date.parse(x.Created) >= after - 1000);
    if (m) {
      const msg = await (await fetch(`${E.E2E_MAILPIT_URL}/api/v1/message/${m.ID}`)).json() as { HTML?: string; Text?: string };
      const href = /href="([^"]+)"/.exec(msg.HTML ?? "")?.[1] ?? /(https?:\/\/\S+)/.exec(msg.Text ?? "")?.[1];
      if (href) return href.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email reached ${email}`);
}

async function joinWithPassword(page: Page, inv: { token: string; journeyId: string; label: string }, password: string) {
  await page.goto(`/app/invite/${inv.token}`);
  await page.getByLabel("Create a password").fill(password);
  await page.getByRole("button", { name: "Create password and join" }).click();
  await page.waitForURL(`**/app/j/${inv.journeyId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(inv.label);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/app/sign-in?out=1");
}

async function signInWithPassword(page: Page, email: string, password: string) {
  await page.goto("/app/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function askForLink(page: Page, email: string, which: "link" | "reset") {
  await page.goto("/app/sign-in");
  await page.getByRole("button", { name: which === "link" ? "Email me a sign-in link instead" : "Forgot password?" }).click();
  await page.getByLabel("Email").fill(email);
  const at = Date.now();
  await page.getByRole("button", { name: which === "link" ? "Email me a sign-in link" : "Email me a reset link" }).click();
  await expect(page.getByText("Check your email.")).toBeVisible();
  return linkFor(email, at);
}

test("an invitation becomes a password and the journey, in one step", async ({ page }) => {
  const inv = await invited();
  await joinWithPassword(page, inv, "correct horse battery");
  /* Signed in for real: the account page knows who they are. */
  await page.goto("/app/account");
  await expect(page.getByText(inv.email)).toBeVisible();
});

test("signing out and back in with the password", async ({ page }) => {
  const inv = await invited();
  await joinWithPassword(page, inv, "correct horse battery");
  await signOut(page);
  await signInWithPassword(page, inv.email, "correct horse battery");
  /* One journey goes straight to it. */
  await page.waitForURL(`**/app/j/${inv.journeyId}`);
});

test("a wrong password is refused, and nothing is signed in", async ({ page }) => {
  const inv = await invited();
  await joinWithPassword(page, inv, "correct horse battery");
  await signOut(page);
  await signInWithPassword(page, inv.email, "not the password at all");
  await expect(page.getByRole("alert")).toBeVisible();
  await page.goto("/app");
  await page.waitForURL("**/app/sign-in**");
});

test("an emailed sign-in link works in the browser that asked for it, after Continue", async ({ page }) => {
  const inv = await invited();
  await joinWithPassword(page, inv, "correct horse battery");
  await signOut(page);
  const link = await askForLink(page, inv.email, "link");
  await page.goto(link);
  /* The scanner-proof step: nothing is spent until a person presses Continue. */
  await page.waitForURL("**/auth/callback**");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(`**/app/j/${inv.journeyId}`);
});

test("the same link opened in another browser says so, and offers the way in", async ({ page, browser }: { page: Page; browser: Browser }) => {
  const inv = await invited();
  await joinWithPassword(page, inv, "correct horse battery");
  await signOut(page);
  const link = await askForLink(page, inv.email, "link");
  const other = await browser.newContext();
  const elsewhere = await other.newPage();
  await asSomeoneNew(elsewhere);
  await elsewhere.goto(link);
  await elsewhere.waitForURL("**/auth/callback**");
  await elsewhere.getByRole("button", { name: "Continue" }).click();
  await elsewhere.waitForURL("**/app/sign-in?error=other_device**");
  await expect(elsewhere.getByText(/different browser/)).toBeVisible();
  await other.close();
});

test("a forgotten password is reset from the email, and the new one works", async ({ page }) => {
  const inv = await invited();
  await joinWithPassword(page, inv, "correct horse battery");
  await signOut(page);
  const link = await askForLink(page, inv.email, "reset");
  await page.goto(link);
  await page.waitForURL("**/auth/callback**");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/app/account?reset=1");
  await page.getByLabel("Choose a new password").fill("a brand new phrase");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByText("Password saved.")).toBeVisible();
  await signOut(page);
  await signInWithPassword(page, inv.email, "a brand new phrase");
  await page.waitForURL(`**/app/j/${inv.journeyId}`);
});

test("an invitation to an address that already has a login asks them to sign in instead", async ({ page, browser }) => {
  const inv = await invited();
  await joinWithPassword(page, inv, "correct horse battery");
  /* A second invitation for the same address, opened by someone not signed in. */
  const c = new Client({ connectionString: E.E2E_DB_URL });
  await c.connect();
  const token = randomBytes(32).toString("base64url");
  await c.query(
    `insert into rift_journey_members (agent_id, journey_id, email, role, scopes, invite_token_hash, invite_expires_at)
     select agent_id, id, $2, 'co-buyer', '{search,homes}', $3, now() + interval '1 day' from rift_journeys where id <> $1 and agent_id = (select agent_id from rift_journeys where id = $1) limit 1`,
    [inv.journeyId, inv.email, createHash("sha256").update(token).digest("hex")]);
  await c.end();
  const other = await browser.newContext();
  const p = await other.newPage();
  await asSomeoneNew(p);
  await p.goto(`/app/invite/${token}`);
  await p.getByLabel("Create a password").fill("someone else's try");
  await p.getByRole("button", { name: "Create password and join" }).click();
  /* The existing password is never overwritten from an invitation link. */
  await expect(p.getByRole("alert")).toBeVisible();
  await expect(p.getByRole("alert").getByRole("link", { name: "Sign in" })).toBeVisible();
  await other.close();
});

/* A small PDF that passes lib/core/document.ts: the header, one page, the end marker. */
const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");

test("a client sends a document from the Documents tab, and it is listed as theirs (WS11.3)", async ({ page }) => {
  const inv = await invited();
  await joinWithPassword(page, inv, "correct horse battery");
  await page.goto(`/app/j/${inv.journeyId}?tab=documents`);
  await page.getByRole("button", { name: "Send Kaleb a document" }).click();
  await page.getByLabel("Name it").fill("Pre-approval letter, October");
  await page.getByLabel("File").setInputFiles({ name: "letter.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByRole("button", { name: "Send it" }).click();
  await expect(page.getByText("Sent. Kaleb has")).toBeVisible();
  await page.goto(`/app/j/${inv.journeyId}?tab=documents`);
  await expect(page.getByRole("link", { name: "Pre-approval letter, October" })).toBeVisible();
  /* It opens: a one-minute link to the private bucket, for this member. */
  const res = await page.request.get(await page.getByRole("link", { name: "Pre-approval letter, October" }).getAttribute("href") ?? "", { maxRedirects: 0 });
  expect(res.status()).toBe(303);
});

test("an offer PDF is kept the moment it uploads, with who sent it (WS8.2, WS8.3)", async ({ page }) => {
  const c = new Client({ connectionString: E.E2E_DB_URL });
  await c.connect();
  await agent(c);
  const name = `Dana Agent ${randomBytes(3).toString("hex")}`;
  await page.goto("/offer");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Phone").fill("404 555 0100");
  await page.locator('input[type=file]').setInputFiles({ name: "offer.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByText("Kaleb has your PDF.")).toBeVisible();
  /* An addendum joins the same offer. */
  await page.locator('input[type=file]').setInputFiles({ name: "addendum.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByText(/Added\. Kaleb has it with the rest of this offer \(2 PDFs\)/)).toBeVisible();
  /* The form was never sent, and the offer is on file anyway. */
  const { rows } = await c.query(
    "select u.offer_id, count(f.id)::int as files from rift_offer_uploads u join rift_offer_files f on f.upload_id = u.id where u.sender_name = $1 group by u.id",
    [name]);
  await c.end();
  expect(rows).toEqual([{ offer_id: null, files: 2 }]);
});
