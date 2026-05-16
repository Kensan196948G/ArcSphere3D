/**
 * E2E smoke tests — the API is mocked via page.route() so no backend is needed.
 * Tests verify that the UI renders correctly and auth flows work end-to-end.
 */

import { expect, test } from "@playwright/test";

const MOCK_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock";
const MOCK_PROJECT = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Demo Project",
  owner_id: "00000000-0000-0000-0000-000000000099",
  created_at: "2026-05-16T00:00:00Z",
};
const MOCK_FILE = {
  id: "00000000-0000-0000-0000-000000000002",
  project_id: MOCK_PROJECT.id,
  filename: "cube.stl",
  size_bytes: 1024,
  content_type: "model/stl",
  uploaded_at: "2026-05-16T00:00:00Z",
};

async function setupApiMocks(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[0] : never) {
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: MOCK_TOKEN,
        token_type: "bearer",
        expires_in: 3600,
      }),
    });
  });

  await page.route("**/api/projects*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([MOCK_PROJECT]),
      });
    } else if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(MOCK_PROJECT),
      });
    } else {
      await route.continue();
    }
  });

  await page.route(`**/api/files/${MOCK_PROJECT.id}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([MOCK_FILE]),
    });
  });

  await page.route(`**/api/files/${MOCK_PROJECT.id}/${MOCK_FILE.id}/download`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: "https://s3.example.com/cube.stl", expires_in: 3600 }),
    });
  });
}

// ---- Smoke tests ----------------------------------------------------------

test("page loads with 3D viewport and header", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("ArcSphere3D")).toBeVisible();
  await expect(page.getByText("MVP")).toBeVisible();
  // Canvas for Three.js viewport should be present
  await expect(page.locator("canvas")).toBeVisible();
});

test("Sign In button opens login modal", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("login modal closes on backdrop click", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign In" }).click();
  // Click outside the modal (the backdrop overlay)
  await page.locator(".fixed.inset-0").click({ position: { x: 10, y: 10 } });
  await expect(page.getByLabel("Email")).not.toBeVisible();
});

test("successful login shows Sign Out and Projects panel", async ({ page }) => {
  await setupApiMocks(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Sign In" }).click();
  await page.getByLabel("Email").fill("demo@arcsphere3d.dev");
  await page.getByLabel("Password").fill("arcsphere-demo");
  await page.getByRole("button", { name: "Sign In" }).last().click();

  await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();
  await expect(page.getByText("Projects")).toBeVisible();
});

test("login with wrong credentials shows error", async ({ page }) => {
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "invalid credentials" }),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.getByLabel("Email").fill("wrong@example.com");
  await page.getByLabel("Password").fill("wrongpassword");
  await page.getByRole("button", { name: "Sign In" }).last().click();
  // Error message should appear
  await expect(page.locator(".text-rose-400")).toBeVisible();
});

test("after login: project list is shown and files can be listed", async ({ page }) => {
  await setupApiMocks(page);
  await page.goto("/");

  // Login
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.getByLabel("Password").fill("arcsphere-demo");
  await page.getByRole("button", { name: "Sign In" }).last().click();
  await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();

  // Select project from dropdown
  await page.selectOption("select", MOCK_PROJECT.id);

  // File should appear in the list
  await expect(page.getByText("cube.stl")).toBeVisible();
});

test("sign out clears auth and hides Projects panel", async ({ page }) => {
  await setupApiMocks(page);
  await page.goto("/");

  // Login
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.getByLabel("Password").fill("arcsphere-demo");
  await page.getByRole("button", { name: "Sign In" }).last().click();
  await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();

  // Sign out
  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  await expect(page.getByText("Projects")).not.toBeVisible();
});
