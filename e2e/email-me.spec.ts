import { test, expect } from "@playwright/test";

/**
 * "Email me this" (D40): one field, in reach once the answer has been read
 * past its headline, and honest about what happened. This suite runs with no
 * database, so the honest answer is "Not saved.", never "Sent."
 */
test("an answer offers to email itself, and says when nothing was stored", async ({ page }) => {
  await page.goto("/buy/cash-to-close?c=DeKalb&p=320000&d=3.5");
  await page.waitForLoadState("networkidle");

  const bar = page.getByRole("region", { name: "Email me this answer" });
  /* Not on arrival: a bar over the answer before it is read is a pop-up. */
  await expect(bar).toHaveCount(0);

  await page.mouse.wheel(0, 900);
  await bar.getByRole("button", { name: /Email me this answer/ }).click();
  const send = bar.getByRole("button", { name: "Send" });
  await expect(send).toBeDisabled();
  await bar.getByLabel("Email").fill("someone@example.com");
  await send.click();

  await expect(bar.getByRole("status")).toContainText("Not saved.");
});

test("the footer names the agent and the brokerage", async ({ page }) => {
  await page.goto("/buy");
  await expect(page.locator("footer.site-foot")).toContainText("Peachtree Cardinal");
});
