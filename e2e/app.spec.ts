import { expect, test, type Page } from "@playwright/test";

const demo = {
  email: "demo@spendsense.dev",
  password: "demo-pass-123",
};

async function login(page: Page, email = demo.email, password = demo.password) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("unauthenticated dashboard visits redirect to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("signup and login land on the dashboard", async ({ page }) => {
  const email = `e2e-${Date.now()}@spendsense.dev`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("demo-pass-123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await login(page, email, "demo-pass-123");
});

test("mock bank connect fills the transactions table", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Connect bank" }).click();
  await expect(page).toHaveURL(/\/transactions/);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("row").nth(1)).toBeVisible();
});

test("copilot answers spending questions and refuses off-topic ones", async ({ page }) => {
  await login(page);
  await page.goto("/copilot");
  await page.getByPlaceholder("Ask about your spending").fill("how much did I spend on food last month?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible({ timeout: 20_000 });

  await page.getByPlaceholder("Ask about your spending").fill("What is the capital of France?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("I don't have enough data to answer that from your transactions.")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("heading", { name: "Sources" })).toHaveCount(0);
});

test("forecast, report, and mock billing upgrade render", async ({ page }) => {
  await login(page);

  await page.goto("/forecast");
  await expect(page.getByRole("heading", { name: "Forecast" })).toBeVisible();
  await expect(page.locator("svg").first()).toBeVisible();
  await expect(page.getByText(/Projected end balance/)).toBeVisible();

  await page.goto("/report");
  await expect(page.getByRole("heading", { name: "Monthly report" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Spend by category")).toBeVisible();
  await expect(page.locator("article")).toHaveCount(3);

  await page.goto("/billing");
  await page.getByRole("button", { name: "Upgrade to Pro" }).click();
  await expect(page.getByText(/Effective tier is pro/)).toBeVisible();
});
