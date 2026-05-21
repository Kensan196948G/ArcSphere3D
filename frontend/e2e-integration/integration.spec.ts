/**
 * Integration E2E tests — runs against a real backend started by Docker Compose.
 * No mocks or MSW stubs: every request hits the actual API/DB/MinIO stack.
 *
 * Pre-conditions (handled by CI workflow):
 *   - docker-compose.test.yml is up and healthy
 *   - Demo user demo@arcsphere3d.dev / arcsphere-demo exists (seeded by APP_ENV=test)
 *   - Frontend dist is served at E2E_BASE_URL (default http://localhost:4173)
 */

import { expect, test } from "@playwright/test";

const API = process.env.E2E_API_URL ?? "http://localhost:8001";
const DEMO_EMAIL = "demo@arcsphere3d.dev";
const DEMO_PASSWORD = "arcsphere-demo";

// ---- helpers ----------------------------------------------------------------

async function apiLogin(): Promise<string> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function apiCreateProject(token: string, name: string): Promise<string> {
  const res = await fetch(`${API}/api/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Create project failed: ${res.status}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

// ---- tests ------------------------------------------------------------------

test.describe("API smoke tests (no UI)", () => {
  test("healthz returns ok", async () => {
    const res = await fetch(`${API}/healthz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  test("readyz reports DB ready", async () => {
    const res = await fetch(`${API}/readyz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; db: string };
    expect(body.status).toBe("ready");
    expect(body.db).toBe("ok");
  });

  test("login with demo credentials returns access token", async () => {
    const token = await apiLogin();
    expect(token).toBeTruthy();
    expect(token.split(".").length).toBe(3);
  });

  test("login with wrong password returns 401", async () => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: DEMO_EMAIL, password: "wrongpassword" }),
    });
    expect(res.status).toBe(401);
  });

  test("project lifecycle: create → list → delete", async () => {
    const token = await apiLogin();
    const projectName = `E2E-${Date.now()}`;

    const projectId = await apiCreateProject(token, projectName);
    expect(projectId).toBeTruthy();

    const listRes = await fetch(`${API}/api/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const projects = (await listRes.json()) as Array<{ id: string; name: string }>;
    expect(projects.some((p) => p.id === projectId)).toBe(true);

    const deleteRes = await fetch(`${API}/api/projects/${projectId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteRes.status).toBe(204);
  });

  test("file upload and download URL", async () => {
    const token = await apiLogin();
    const projectId = await apiCreateProject(token, `E2E-Files-${Date.now()}`);

    const form = new FormData();
    const blob = new Blob(["solid test\nendsolid test"], { type: "model/stl" });
    form.append("upload_file", blob, "test.stl");

    const uploadRes = await fetch(`${API}/api/files/upload?project_id=${projectId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    expect(uploadRes.status).toBe(201);
    const fileMeta = (await uploadRes.json()) as { id: string; filename: string };
    expect(fileMeta.filename).toBe("test.stl");

    const dlRes = await fetch(`${API}/api/files/${projectId}/${fileMeta.id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(dlRes.status).toBe(200);
    const dlBody = (await dlRes.json()) as { url: string };
    expect(dlBody.url).toBeTruthy();

    await fetch(`${API}/api/projects/${projectId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test("multipart upload init returns presigned URLs", async () => {
    const token = await apiLogin();
    const projectId = await apiCreateProject(token, `E2E-MP-${Date.now()}`);

    const initRes = await fetch(`${API}/api/files/multipart/init`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        project_id: projectId,
        filename: "large-model.ifc",
        file_size: 25 * 1024 * 1024,
        chunk_size: 10 * 1024 * 1024,
      }),
    });
    expect(initRes.status).toBe(201);
    const body = (await initRes.json()) as {
      upload_token: string;
      total_parts: number;
      parts: Array<{ part_number: number; presigned_url: string }>;
    };
    expect(body.total_parts).toBe(3);
    expect(body.parts.length).toBe(3);

    await fetch(`${API}/api/files/multipart/abort`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ upload_token: body.upload_token }),
    });

    await fetch(`${API}/api/projects/${projectId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  });
});

test.describe("UI integration tests", () => {
  test("login page renders and accepts credentials", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /ArcSphere/i })).toBeVisible();

    await page.getByLabel(/email/i).fill(DEMO_EMAIL);
    await page.getByLabel(/password/i).fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: /login|ログイン/i }).click();

    await expect(page).not.toHaveURL(/login/, { timeout: 10_000 });
  });

  test("authenticated user sees project panel", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/email/i).fill(DEMO_EMAIL);
    await page.getByLabel(/password/i).fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: /login|ログイン/i }).click();

    await expect(page.getByText(/プロジェクト/)).toBeVisible({ timeout: 10_000 });
  });
});
