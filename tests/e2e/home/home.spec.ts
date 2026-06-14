import { test, expect } from "@playwright/test";
import { HomePage } from "./home-page";

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

test.describe("Home (/)", () => {
  test(
    "renders primary heading and module cards without console errors",
    { tag: ["@critical", "@e2e", "@home", "@HOME-E2E-001"] },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" && !isBenign(msg.text()))
          errors.push(msg.text());
      });

      const home = new HomePage(page);
      await home.goto();

      await expect(home.heading).toBeVisible();
      await expect(home.exploreLinks.first()).toBeVisible();

      expect(
        errors,
        `Unexpected console errors:\n${errors.join("\n")}`
      ).toHaveLength(0);
    }
  );

  test(
    "has exactly one <main> landmark",
    { tag: ["@critical", "@e2e", "@home", "@HOME-E2E-002"] },
    async ({ page }) => {
      const home = new HomePage(page);
      await home.goto();

      await expect(home.main).toHaveCount(1);
    }
  );

  test(
    "skip link: focus → visible in viewport → Enter → focus moves to #main-content",
    { tag: ["@critical", "@e2e", "@a11y", "@HOME-E2E-003"] },
    async ({ page }) => {
      const home = new HomePage(page);
      await home.goto();

      // Press Tab from a clean state — the skip link must be the FIRST tabbable
      // element in the DOM (first child of <body> per layout.tsx). If Tab does
      // not land here, that is a real WCAG 2.4.1 bypass-blocks failure.
      await page.keyboard.press("Tab");
      await expect(home.skipLink).toBeFocused();

      // Assert the skip link has a non-zero bounding box — confirming it entered
      // the viewport on focus (a hidden-until-focus link with clip/translate would
      // have a zero or off-screen bounding box if the focus style is broken).
      const box = await home.skipLink.boundingBox();
      expect(
        box,
        "Skip link bounding box must be non-null when focused"
      ).not.toBeNull();
      expect(
        box!.width,
        "Skip link must have a positive width when focused"
      ).toBeGreaterThan(0);
      expect(
        box!.height,
        "Skip link must have a positive height when focused"
      ).toBeGreaterThan(0);
      // Verify the link is within the visible viewport area
      const viewportSize = page.viewportSize();
      expect(
        box!.y + box!.height,
        "Skip link bottom edge must be within the viewport when focused"
      ).toBeLessThanOrEqual(viewportSize!.height);

      // Press Enter — focus should move to #main-content
      await page.keyboard.press("Enter");

      const mainContent = page.locator("#main-content");
      await expect(mainContent).toBeFocused();
    }
  );

  test(
    "module navigation: clicking Pathfinding Explore link navigates to /pathfinding",
    { tag: ["@high", "@e2e", "@home", "@HOME-E2E-004"] },
    async ({ page }) => {
      const home = new HomePage(page);
      await home.goto();

      // Click the first module card's Explore link (Pathfinding)
      const pathfindingLink = page.getByRole("link", {
        name: "Open Pathfinding module",
      });
      await pathfindingLink.click();

      await expect(page).toHaveURL("/pathfinding");
      // Confirm the module heading is rendered after navigation
      await expect(
        page.getByRole("heading", { name: "Pathfinding", level: 1 })
      ).toBeVisible();
    }
  );

  test(
    "axe scan: no serious/critical accessibility violations (light theme)",
    { tag: ["@critical", "@e2e", "@a11y", "@HOME-E2E-005"] },
    async ({ page }) => {
      const home = new HomePage(page);
      await home.goto();

      await home.checkA11y();
    }
  );

  test(
    "axe scan: no serious/critical accessibility violations (dark theme)",
    { tag: ["@critical", "@e2e", "@a11y", "@HOME-E2E-006"] },
    async ({ page }) => {
      const home = new HomePage(page);
      await home.goto();

      await home.checkA11yDark();
    }
  );
});
