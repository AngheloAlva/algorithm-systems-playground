import { test, expect } from "@playwright/test";
import { PathfindingPage } from "./pathfinding-page";

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

test.describe("Pathfinding (/pathfinding)", () => {
  test(
    "renders heading and visualizer without console errors",
    { tag: ["@critical", "@e2e", "@pathfinding", "@PF-E2E-001"] },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" && !isBenign(msg.text()))
          errors.push(msg.text());
      });

      const pf = new PathfindingPage(page);
      await pf.goto();

      await expect(pf.heading).toBeVisible();

      expect(
        errors,
        `Unexpected console errors:\n${errors.join("\n")}`
      ).toHaveLength(0);
    }
  );

  test(
    "has exactly one <main> landmark",
    { tag: ["@critical", "@e2e", "@pathfinding", "@PF-E2E-002"] },
    async ({ page }) => {
      const pf = new PathfindingPage(page);
      await pf.goto();

      await expect(pf.main).toHaveCount(1);
    }
  );

  test(
    "sidebar navigation link is active for /pathfinding",
    { tag: ["@high", "@e2e", "@pathfinding", "@PF-E2E-003"] },
    async ({ page }) => {
      const pf = new PathfindingPage(page);
      await pf.goto();

      // The active sidebar link should have aria-current="page"
      const activeLink = page.getByRole("link", {
        name: "Pathfinding",
      });
      await expect(activeLink.first()).toHaveAttribute("aria-current", "page");
    }
  );

  test(
    "axe scan: no serious/critical accessibility violations (light theme)",
    { tag: ["@critical", "@e2e", "@a11y", "@PF-E2E-004"] },
    async ({ page }) => {
      const pf = new PathfindingPage(page);
      await pf.goto();

      await pf.checkA11y();
    }
  );

  test(
    "axe scan: no serious/critical accessibility violations (dark theme)",
    { tag: ["@critical", "@e2e", "@a11y", "@PF-E2E-005"] },
    async ({ page }) => {
      const pf = new PathfindingPage(page);
      await pf.goto();

      await pf.checkA11yDark();
    }
  );

  test(
    "axe scan: Sorting tab — scrollable pseudocode and sorting sliders are accessible",
    { tag: ["@critical", "@e2e", "@a11y", "@PF-E2E-006"] },
    async ({ page }) => {
      const pf = new PathfindingPage(page);
      await pf.goto();

      // Activate the Sorting tab so its content enters the DOM and becomes visible.
      // Base UI renders TabsTrigger as a <button> with role="tab". Use the
      // data-slot attribute as a fallback in case the role query fails in this
      // environment (Base UI uses data-active, not aria-selected).
      const sortingTab = page.locator('[data-slot="tabs-trigger"]', {
        hasText: "Sorting",
      });
      await sortingTab.click();

      // Base UI uses data-active (not aria-selected) to mark the active tab.
      // Wait for the SortingVisualizer content to appear in the active panel.
      await page.waitForSelector('[data-slot="slider"]', { timeout: 10000 });

      // Run axe on the Sorting tab content — covers the scrollable pseudocode
      // region (tabIndex={0} + role="region" + aria-label) and the sorting sliders
      // with forwarded aria-label to the thumb inputs.
      await pf.checkA11y();
    }
  );
});
