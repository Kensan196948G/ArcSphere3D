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
  // Viewport container should be present (canvas may not exist when WebGL is unavailable)
  await expect(page.locator("[data-testid='viewport-canvas']")).toBeVisible();
});

test("ログインボタンでモーダルが開く", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  await expect(page.getByLabel("メールアドレス")).toBeVisible();
  await expect(page.getByLabel("パスワード")).toBeVisible();
});

test("ログインモーダルはバックドロップクリックで閉じる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  // Click outside the modal (the backdrop overlay)
  await page.locator(".fixed.inset-0").click({ position: { x: 10, y: 10 } });
  await expect(page.getByLabel("メールアドレス")).not.toBeVisible();
});

test("ログイン成功でログアウトボタンとプロジェクトパネルが表示される", async ({ page }) => {
  await setupApiMocks(page);
  await page.goto("/");

  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("demo@arcsphere3d.dev");
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();

  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  // RightPanel のセクション見出し（h2）でプロジェクトパネルの存在を確認
  await expect(page.getByRole("heading", { name: "プロジェクト" })).toBeVisible();
});

test("誤った認証情報でエラーが表示される", async ({ page }) => {
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "invalid credentials" }),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("メールアドレス").fill("wrong@example.com");
  await page.getByLabel("パスワード").fill("wrongpassword");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  // Error message should appear
  await expect(page.locator(".text-rose-500")).toBeVisible();
});

test("ログイン後: プロジェクト一覧表示とファイル一覧取得", async ({ page }) => {
  await setupApiMocks(page);
  await page.goto("/");

  // Login
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();

  // Select project from dropdown
  await page.selectOption("select", MOCK_PROJECT.id);

  // File should appear in the list
  await expect(page.getByText("cube.stl")).toBeVisible();
});

test("ログアウトで認証クリアとプロジェクトパネル非表示", async ({ page }) => {
  await setupApiMocks(page);
  await page.goto("/");

  // Login
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByLabel("パスワード").fill("arcsphere-demo");
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();

  // Sign out
  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page.getByRole("button", { name: "ログイン" })).toBeVisible();
  // ログアウト後は RightPanel のプロジェクトセクション見出し（h2）が消える
  await expect(page.getByRole("heading", { name: "プロジェクト" })).not.toBeVisible();
});
