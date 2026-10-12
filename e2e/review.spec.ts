import { test, expect } from "@playwright/test";

/**
 * The 5 October manual review (docs/audit/manual-review-2026-10-05.md), the
 * parts a browser can check with no database and no auth server. The full
 * sign-in journey (WS1.8) needs a local Supabase Auth stack this suite does
 * not have; what is here is the half that broke silently before.
 */

test("a sign-in link signs nobody in until Continue is pressed", async ({ page }) => {
  /* A scanner fetches the link; it must not be spent by that fetch (F4). */
  const res = await page.goto("/auth/callback?token_hash=abc&type=magiclink&next=/app");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveURL(/\/auth\/callback/);
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  /* Pressing it reaches the POST, which (with no auth configured here) says so. */
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/app\/sign-in\?error=unconfigured/);
  await expect(page.getByText("Sign-in is not set up on this site right now")).toBeVisible();
});

test("an incomplete link says so instead of offering Continue", async ({ page }) => {
  await page.goto("/auth/callback?next=/app");
  await expect(page.getByText("This link is incomplete.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
});

test("client sign-in offers a password, an email link and Forgot password", async ({ page }) => {
  await page.goto("/app/sign-in");
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Forgot password?" })).toBeVisible();
  await page.getByRole("button", { name: "Email me a sign-in link instead" }).click();
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
});

test("the offer page starts with the PDF, and the form opens by hand", async ({ page }) => {
  await page.goto("/offer");
  await expect(page.getByText("Upload your offer in PDF")).toBeVisible();
  await expect(page.getByText("Property address")).toHaveCount(0);
  await page.getByRole("button", { name: "Fill in the offer by hand" }).click();
  await expect(page.getByText("Property address")).toBeVisible();
  /* No contingency is ticked for the sender (WS8.5). */
  await expect(page.getByRole("button", { name: "Inspection" })).toHaveAttribute("aria-pressed", "false");
  /* Errors go under the box, and focus lands on the first one (WS8.4). */
  await page.getByRole("button", { name: /Send this offer/ }).click();
  await expect(page.locator("#offer-address-err")).toBeVisible();
  /* Who is sending is asked first, with the upload (WS8.2), so it is the first box to fix. */
  await expect(page.locator("#offer-from")).toBeFocused();
});

test("an offer PDF cannot be chosen before a name and phone (WS8.2)", async ({ page }) => {
  await page.goto("/offer");
  await page.getByText("Choose the PDF").click();
  await expect(page.locator("#offer-from-err")).toBeVisible();
  await expect(page.locator("#offer-phone-err")).toBeVisible();
  await expect(page.locator("#offer-from")).toBeFocused();
});

test("the Equb page switches to Amharic and every call to action opens the form page", async ({ page }) => {
  await page.goto("/equb");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Save together. Buy a home.");
  await page.getByRole("button", { name: "አማርኛ" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("በአንድነት እንቆጥብ። ቤት እንግዛ።");
  const ctas = page.locator('a[href^="/equb/reserve"]');
  expect(await ctas.count()).toBeGreaterThanOrEqual(4);
});

test("the Equb form asks for contact details first", async ({ page }) => {
  await page.goto("/equb/reserve");
  await expect(page.getByText("Step 1 of 2: how to reach you")).toBeVisible();
  await expect(page.getByText("Household size")).toHaveCount(0);
});

test("booking needs an email", async ({ page }) => {
  await page.goto("/book");
  await page.getByLabel("Your name").fill("Test Person");
  await page.getByLabel("Phone").fill("4045550100");
  await page.locator("label.opt input[type=checkbox]").check();
  await expect(page.getByRole("button", { name: "Add your email" })).toBeDisabled();
});

test("the client sign-in switches to Amharic and remembers it (WS11.6)", async ({ page }) => {
  await page.goto("/app/sign-in");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in to your move");
  await page.getByRole("button", { name: "አማርኛ" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ወደ ቤት ጉዳይዎ ይግቡ");
  await expect(page.locator("main")).toHaveAttribute("lang", "am");
  /* The choice is a cookie, so the next server-rendered page keeps it. */
  await page.goto("/app/sign-in");
  await expect(page.getByLabel("የይለፍ ቃል")).toBeVisible();
});
