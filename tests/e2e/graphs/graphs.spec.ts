import { test, expect } from "@playwright/test";
import { GraphsPage } from "./graphs-page";

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

test.describe("Graphs (/graphs)", () => {
  test(
    "renders heading and visualizer without console errors",
    { tag: ["@critical", "@e2e", "@graphs", "@GR-E2E-001"] },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" && !isBenign(msg.text()))
          errors.push(msg.text());
      });

      const graphs = new GraphsPage(page);
      await graphs.goto();

      await expect(graphs.heading).toBeVisible();

      expect(
        errors,
        `Unexpected console errors:\n${errors.join("\n")}`
      ).toHaveLength(0);
    }
  );

  test(
    "has exactly one <main> landmark",
    { tag: ["@critical", "@e2e", "@graphs", "@GR-E2E-002"] },
    async ({ page }) => {
      const graphs = new GraphsPage(page);
      await graphs.goto();

      await expect(graphs.main).toHaveCount(1);
    }
  );

  test(
    "sidebar navigation link is active for /graphs",
    { tag: ["@high", "@e2e", "@graphs", "@GR-E2E-003"] },
    async ({ page }) => {
      const graphs = new GraphsPage(page);
      await graphs.goto();

      const activeLink = page.getByRole("link", { name: "Graphs" });
      await expect(activeLink.first()).toHaveAttribute("aria-current", "page");
    }
  );

  test(
    "axe scan: no serious/critical accessibility violations (light theme)",
    { tag: ["@critical", "@e2e", "@a11y", "@GR-E2E-004"] },
    async ({ page }) => {
      const graphs = new GraphsPage(page);
      await graphs.goto();

      await graphs.checkA11y();
    }
  );

  test(
    "axe scan: no serious/critical accessibility violations (dark theme)",
    { tag: ["@critical", "@e2e", "@a11y", "@GR-E2E-005"] },
    async ({ page }) => {
      const graphs = new GraphsPage(page);
      await graphs.goto();

      await graphs.checkA11yDark();
    }
  );
});
