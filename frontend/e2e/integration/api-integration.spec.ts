/**
 * Integration E2E tests — run against the real backend (Docker Compose stack).
 * Uses Playwright's APIRequestContext for pure HTTP-level validation.
 *
 * Stack: docker compose -f docker/docker-compose.test.yml up -d --wait
 * Backend URL: http://localhost:8001
 */

import { test, expect } from "@playwright/test";

const DEMO_CREDS = { email: "demo@arcsphere3d.dev", password: "arcsphere-demo" };

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
    expect(body.access_token.split(".").length).toBe(3); // header.payload.signature
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
  let token: string;

  test.beforeEach(async ({ request }) => {
    const res = await request.post("/api/auth/login", { data: DEMO_CREDS });
    token = (await res.json()).access_token;
  });

  test("unauthenticated request returns 401", async ({ request }) => {
    const res = await request.get("/api/projects");
    expect(res.status()).toBe(401);
  });

  test("authenticated user can list projects", async ({ request }) => {
    const res = await request.get("/api/projects", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test("create → list → delete project", async ({ request }) => {
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    // Create
    const createRes = await request.post("/api/projects", {
      ...auth,
      data: { name: `integration-test-${Date.now()}` },
    });
    expect(createRes.status()).toBe(201);
    const project = await createRes.json();
    expect(typeof project.id).toBe("string");

    // List — project should appear
    const listRes = await request.get("/api/projects", auth);
    const projects: Array<{ id: string }> = await listRes.json();
    expect(projects.some((p) => p.id === project.id)).toBe(true);

    // Delete
    const delRes = await request.delete(`/api/projects/${project.id}`, auth);
    expect(delRes.status()).toBe(204);
  });

  test("rename project", async ({ request }) => {
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    const createRes = await request.post("/api/projects", {
      ...auth,
      data: { name: `rename-test-${Date.now()}` },
    });
    const project = await createRes.json();

    const renameRes = await request.put(`/api/projects/${project.id}`, {
      ...auth,
      data: { name: "renamed-project" },
    });
    expect(renameRes.status()).toBe(200);
    const renamed = await renameRes.json();
    expect(renamed.name).toBe("renamed-project");

    // Cleanup
    await request.delete(`/api/projects/${project.id}`, auth);
  });
});

// ── Files ─────────────────────────────────────────────────────────────────────

test.describe("files", () => {
  let token: string;
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    const loginRes = await request.post("/api/auth/login", { data: DEMO_CREDS });
    token = (await loginRes.json()).access_token;

    const projRes = await request.post("/api/projects", {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `file-test-${Date.now()}` },
    });
    projectId = (await projRes.json()).id;
  });

  test.afterEach(async ({ request }) => {
    await request.delete(`/api/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test("upload STL file and list it", async ({ request }) => {
    // Minimal binary STL: 84-byte header + 0 triangles
    const stlHeader = Buffer.alloc(84, 0);
    stlHeader.write("ArcSphere3D integration test", 0, "ascii");
    stlHeader.writeUInt32LE(0, 80); // 0 triangles

    const uploadRes = await request.post(`/api/files/upload`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { project_id: projectId },
      multipart: {
        upload_file: {
          name: "test.stl",
          mimeType: "model/stl",
          buffer: stlHeader,
        },
      },
    });
    expect([200, 201]).toContain(uploadRes.status());
    const file = await uploadRes.json();
    expect(file.filename).toBe("test.stl");

    // List files
    const listRes = await request.get(`/api/files/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.status()).toBe(200);
    const files: Array<{ id: string }> = await listRes.json();
    expect(files.some((f) => f.id === file.id)).toBe(true);
  });
});
