import { test, expect } from "@playwright/test";
import { DashboardPage } from "./dashboard-page";

/**
 * Console error filter — patterns that are benign and not caused by this app.
 * Add new patterns here with a comment explaining why they are safe to ignore.
 */
const BENIGN_CONSOLE_PATTERNS: RegExp[] = [
  // React DevTools browser extension download notice — not an app error
  /Download the React DevTools/i,
];

function isBenign(msg: string): boolean {
  return BENIGN_CONSOLE_PATTERNS.some((pattern) => pattern.test(msg));
}

test.describe("Dashboard (/dashboard)", () => {
  test(
    "renders heading and benchmark UI without console errors",
    { tag: ["@critical", "@e2e", "@dashboard", "@DASH-E2E-001"] },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" && !isBenign(msg.text()))
          errors.push(msg.text());
      });

      const dash = new DashboardPage(page);
      await dash.goto();

      await expect(dash.heading).toBeVisible();

      expect(
        errors,
        `Unexpected console errors:\n${errors.join("\n")}`
      ).toHaveLength(0);
    }
  );

  test(
    "has exactly one <main> landmark",
    { tag: ["@critical", "@e2e", "@dashboard", "@DASH-E2E-002"] },
    async ({ page }) => {
      const dash = new DashboardPage(page);
      await dash.goto();

      await expect(dash.main).toHaveCount(1);
    }
  );

  test(
    "sidebar navigation link is active for /dashboard",
    { tag: ["@high", "@e2e", "@dashboard", "@DASH-E2E-003"] },
    async ({ page }) => {
      const dash = new DashboardPage(page);
      await dash.goto();

      const activeLink = page.getByRole("link", { name: "Dashboard" });
      await expect(activeLink.first()).toHaveAttribute("aria-current", "page");
    }
  );

  test(
    "axe scan: no serious/critical accessibility violations (light theme)",
    { tag: ["@critical", "@e2e", "@a11y", "@DASH-E2E-004"] },
    async ({ page }) => {
      const dash = new DashboardPage(page);
      await dash.goto();

      await dash.checkA11y();
    }
  );

  test(
    "axe scan: no serious/critical accessibility violations (dark theme)",
    { tag: ["@critical", "@e2e", "@a11y", "@DASH-E2E-005"] },
    async ({ page }) => {
      const dash = new DashboardPage(page);
      await dash.goto();

      await dash.checkA11yDark();
    }
  );
});
