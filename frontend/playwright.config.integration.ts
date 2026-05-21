import { defineConfig } from "@playwright/test";

/**
 * Integration E2E config — runs against a real backend (Docker Compose stack).
 * No browser UI tests: uses only Playwright APIRequestContext for pure API validation.
 *
 * Start the stack first:
 *   docker compose -f docker/docker-compose.test.yml up -d --wait
 * Then run:
 *   npx playwright test --config playwright.config.integration.ts
 */
export default defineConfig({
  testDir: "./e2e/integration",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.API_BASE_URL ?? "http://localhost:8001",
    trace: "on-first-retry",
  },
  // No webServer — the backend runs via Docker Compose.
});
