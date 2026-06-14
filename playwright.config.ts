import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration.
 *
 * webServer strategy (ADR-6):
 *   CI  → production build + start (`pnpm build && pnpm start`) — representative for a11y/contrast.
 *   DEV → `pnpm dev` with reuseExistingServer so the inner loop stays fast.
 *
 * Chromium-only (REQ-E2E-1) — no browser matrix.
 * testDir / testMatch kept strictly in tests/e2e so Vitest never picks up *.spec.ts.
 */
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",

  /* Reporters: list for CI, html report opened manually */
  reporter: [["list"], ["html", { open: "never" }]],

  /* Parallelism: constrained in CI, unlimited locally */
  workers: process.env.CI ? 2 : undefined,

  /* Prevent focused tests from silently passing in CI */
  forbidOnly: !!process.env.CI,

  /* Retries: 1 in CI to handle flake, none locally */
  retries: process.env.CI ? 1 : 0,

  use: {
    baseURL: "http://localhost:3000",
    /* Capture trace on first retry for debugging */
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Disable browser extensions so they cannot inject content into pages
        // and cause false-positive axe violations (e.g. color-contrast failures
        // from third-party extension overlays).
        launchOptions: {
          args: ["--disable-extensions"],
        },
      },
    },
  ],

  webServer: {
    command: process.env.CI
      ? "pnpm build && pnpm start"
      : "pnpm dev",
    url: "http://localhost:3000",
    /**
     * Generous timeout — production build can take 60-90 s in CI.
     * Local dev server is usually ready in under 10 s.
     */
    timeout: 120_000,
    /**
     * Reuse an already-running dev server locally; always spin a fresh one in CI
     * so the production build is authoritative.
     */
    reuseExistingServer: !process.env.CI,
  },
});
