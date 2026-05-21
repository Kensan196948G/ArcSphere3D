/**
 * Integration E2E tests — run against the real backend (Docker Compose stack).
 * Uses Playwright's APIRequestContext for pure HTTP-level validation.
 *
 * Stack: docker compose -f docker/docker-compose.test.yml up -d --wait
 * Backend URL: http://localhost:8001
 */

import { test, expect } from "@playwright/test";

const DEMO_CREDS = { email: "demo@arcsphere3d.dev", password: "arcsphere-demo" };

// Each test gets its own fresh token to avoid shared-state issues.
async function getToken(
  request: import("@playwright/test").APIRequestContext,
): Promise<string> {
  const res = await request.post("/api/auth/login", { data: DEMO_CREDS });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

test.describe("auth", () => {
  test("health endpoint returns ok", async ({ request }) => {
    const res = await request.get("/healthz");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("login with valid credentials returns JWT", async ({ request }) => {
    const res = await request.post("/api/auth/login", { data: DEMO_CREDS });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token_type).toBe("bearer");
    expect(typeof body.access_token).toBe("string");
    expect(body.access_token.split(".").length).toBe(3);
  });

  test("login with wrong password returns 401", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { email: DEMO_CREDS.email, password: "wrong-password-x" },
    });
    expect(res.status()).toBe(401);
  });

  test("JWKS endpoint returns RS256 key", async ({ request }) => {
    const res = await request.get("/api/auth/.well-known/jwks.json");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.keys)).toBe(true);
    expect(body.keys[0].alg).toBe("RS256");
  });
});

// ── Projects ──────────────────────────────────────────────────────────────────

test.describe("projects", () => {
  test("unauthenticated request returns 401", async ({ request }) => {
    const res = await request.get("/api/projects");
    expect(res.status()).toBe(401);
  });

  test("authenticated user can list projects", async ({ request }) => {
    const token = await getToken(request);
    const res = await request.get("/api/projects", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test("create → list → delete project", async ({ request }) => {
    const token = await getToken(request);
    const headers = { Authorization: `Bearer ${token}` };

    const createRes = await request.post("/api/projects", {
      headers,
      data: { name: `integration-test-${Date.now()}` },
    });
    expect(createRes.status()).toBe(201);
    const project = await createRes.json();
    expect(typeof project.id).toBe("string");

    const listRes = await request.get("/api/projects", { headers });
    const projects: Array<{ id: string }> = await listRes.json();
    expect(projects.some((p) => p.id === project.id)).toBe(true);

    const delRes = await request.delete(`/api/projects/${project.id}`, { headers });
    expect(delRes.status()).toBe(204);
  });

  test("rename project", async ({ request }) => {
    const token = await getToken(request);
    const headers = { Authorization: `Bearer ${token}` };

    const createRes = await request.post("/api/projects", {
      headers,
      data: { name: `rename-test-${Date.now()}` },
    });
    expect(createRes.status()).toBe(201);
    const project = await createRes.json();
    expect(typeof project.id).toBe("string");

    const renameRes = await request.put(`/api/projects/${project.id}`, {
      headers,
      data: { name: "renamed-project" },
    });
    expect(renameRes.status()).toBe(200);
    const renamed = await renameRes.json();
    expect(renamed.name).toBe("renamed-project");

    await request.delete(`/api/projects/${project.id}`, { headers });
  });
});

// ── Files ─────────────────────────────────────────────────────────────────────

test.describe("files", () => {
  test("upload STL file and list it", async ({ request }) => {
    const token = await getToken(request);
    const headers = { Authorization: `Bearer ${token}` };

    const projRes = await request.post("/api/projects", {
      headers,
      data: { name: `file-test-${Date.now()}` },
    });
    expect(projRes.status()).toBe(201);
    const project = await projRes.json();
    const projectId = project.id as string;

    // Minimal binary STL: 80-byte header + 4-byte triangle count (0)
    const stlBuf = Buffer.alloc(84, 0);
    stlBuf.write("ArcSphere3D integration test", 0, "ascii");
    stlBuf.writeUInt32LE(0, 80);

    const uploadRes = await request.post(`/api/files/upload`, {
      headers,
      params: { project_id: projectId },
      multipart: {
        upload_file: {
          name: "test.stl",
          mimeType: "model/stl",
          buffer: stlBuf,
        },
      },
    });
    expect([200, 201]).toContain(uploadRes.status());
    const file = await uploadRes.json();
    expect(file.filename).toBe("test.stl");

    const listRes = await request.get(`/api/files/${projectId}`, { headers });
    expect(listRes.status()).toBe(200);
    const files: Array<{ id: string }> = await listRes.json();
    expect(files.some((f) => f.id === file.id)).toBe(true);

    // Cleanup
    await request.delete(`/api/projects/${projectId}`, { headers });
  });
});
