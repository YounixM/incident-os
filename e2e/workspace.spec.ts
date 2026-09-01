import { expect, test, type Page } from "@playwright/test";

async function openIncident(page: Page): Promise<void> {
  await page.goto("/incidents/checkout-api-error-rate");
  await expect(page.locator("#incident-header")).toContainText("Checkout API");
  await expect(page.locator("#agent-column")).toBeVisible();
  await expect(page.locator("#agent-prompt")).toBeVisible();
  await expect(page.locator("#investigate-with-ai")).toBeEnabled();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__INCIDENTOS_FAST = true;
    window.__INCIDENTOS_FORCE_DEMO = true;
  });
});

test("incident list navigates to the checkout SEV-1", async ({ page }) => {
  await page.goto("/incidents");
  await page.locator("[data-incident-id=checkout-api-error-rate]").click();
  await expect(page).toHaveURL(/\/incidents\/checkout-api-error-rate/);
  await expect(page.locator("#incident-header")).toContainText("Checkout API");
  await expect(page.locator("#investigate-with-ai")).toBeVisible();
});

test("opening a trace shows the waterfall", async ({ page }) => {
  await openIncident(page);
  await page.locator("#traces").scrollIntoViewIfNeeded();
  await page.locator("#traces").getByRole("button", { name: "8fd3c21a9b4d12ef" }).click();
  await expect(page.locator("#trace-detail")).toBeVisible();
  await expect(page.locator("#trace-detail")).toContainText("8fd3c21a9b4d12ef");
});

test("investigation start, evidence jump, approval, recovery, and reset", async ({ page }) => {
  await openIncident(page);
  await page.locator("#investigate-with-ai").click();
  await expect(page.locator("#traffic-challenge-chip")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("list", { name: "Evidence" })).toContainText("Failed traces");

  await page.locator('[data-evidence-type="trace"]').first().click();
  await expect(page.locator("#traces")).toBeVisible();

  await page.locator("#traffic-challenge-chip").click();
  await expect(page.locator("#approval-dialog")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#approval-dialog")).toContainText("v2.30");

  await page.locator("#approval-approve").click();
  await expect(page.getByText("Incident resolved.")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#overview")).toContainText("1.1%");

  await page.locator("#reset-investigation").click();
  await expect(page.locator("#overview")).toContainText("18.4%");
  await expect(page.getByText("Evidence items will navigate into telemetry views.")).toBeVisible();
});

test("a payment redirect during the traffic pause still resumes the investigation", async ({
  page,
}) => {
  await openIncident(page);
  await page.locator("#investigate-with-ai").click();
  await expect(page.locator("#traffic-challenge-chip")).toBeVisible({ timeout: 60_000 });

  await page.locator("#agent-prompt").fill("investigate payment-service instead");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Following up: investigate payment-service instead")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator("#traffic-challenge-chip")).toBeVisible({ timeout: 20_000 });
});
