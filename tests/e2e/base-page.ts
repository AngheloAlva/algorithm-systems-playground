import { Page, Locator, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * BasePage — shared helpers for all Page Object Models.
 *
 * A11y design contract (ADR-5, REQ-A11Y-5):
 *   checkA11y() fails on `serious`, `critical`, or `null`-impact axe violations.
 *   `moderate` and `minor` are surfaced in the report but do NOT fail the test.
 *
 *   checkA11yDark() switches the page to dark theme, runs axe, then restores.
 *   Both light and dark must pass the same serious/critical/null gate.
 */
export class BasePage {
  /** The single <main> landmark provided by layout.tsx (via SidebarInset). */
  readonly main: Locator;
  /** Skip link — first focusable element in <body>, WCAG 2.4.1. */
  readonly skipLink: Locator;

  constructor(protected page: Page) {
    this.main = page.locator("main");
    this.skipLink = page.getByRole("link", { name: "Skip to main content" });
  }

  /**
   * Navigate to a path and wait for the network to settle.
   * Uses baseURL from playwright.config.ts so tests stay URL-agnostic.
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
    // "load" is sufficient for App Router RSC pages — "networkidle" is too strict
    // because Next.js dev server emits continuous HMR websocket traffic.
    await this.page.waitForLoadState("load");
  }

  /**
   * Run axe against the current page state.
   *
   * Fails immediately on any violation at `serious`, `critical`, or `null` impact.
   * A `null`-impact violation indicates axe could not determine severity — treated
   * as blocking (fail-safe) per ADR-5.
   * Violations at `moderate`/`minor` are logged to the console but do NOT
   * fail the test (design ADR-5, authority override #4).
   *
   * @param disabledRules - Narrow per-call rule exclusions for known third-party
   *   false positives (e.g. Recharts SVG). Each entry MUST include a comment
   *   in the calling spec explaining why the rule is excluded.
   * @param label - Optional context label for error messages (e.g. "dark theme").
   */
  async checkA11y(
    disabledRules: string[] = [],
    label = "default theme"
  ): Promise<void> {
    const builder = new AxeBuilder({ page: this.page })
      .withTags(["wcag2a", "wcag2aa"]);

    if (disabledRules.length > 0) {
      builder.disableRules(disabledRules);
    }

    const results = await builder.analyze();

    // Log moderate/minor as informational — not test-blocking
    const informational = results.violations.filter(
      (v) => v.impact === "moderate" || v.impact === "minor"
    );
    if (informational.length > 0) {
      console.info(
        `[axe:${label}] ${informational.length} non-blocking violation(s) on ${this.page.url()}:`,
        informational.map((v) => `${v.id} (${v.impact}): ${v.description}`)
      );
    }

    // Fail on serious/critical/null (null-impact = axe couldn't classify — fail-safe)
    const blocking = results.violations.filter(
      (v) =>
        v.impact === "serious" ||
        v.impact === "critical" ||
        v.impact === null
    );

    expect(
      blocking,
      `[axe:${label}] ${blocking.length} blocking violation(s) on ${this.page.url()}:\n` +
        blocking
          .map(
            (v) =>
              `  [${v.impact ?? "null"}] ${v.id}: ${v.description}\n` +
              v.nodes
                .slice(0, 2)
                .map((n) => `    → ${n.html}`)
                .join("\n")
          )
          .join("\n")
    ).toHaveLength(0);
  }

  /**
   * Switch the page to dark theme and run an axe scan.
   *
   * Strategy: uses `page.emulateMedia({ colorScheme: "dark" })` to signal dark
   * preference to next-themes, then forces `.dark` class on <html> via evaluate
   * (next-themes applies the class when it detects the media preference on
   * initial render, but may need a push on SSR-rendered pages). Waits a frame
   * for any class-triggered transitions before scanning.
   *
   * After the scan, restores the media emulation to "no-preference" and removes
   * the forced class so subsequent tests are not affected.
   *
   * @param disabledRules - Same as checkA11y.
   */
  async checkA11yDark(disabledRules: string[] = []): Promise<void> {
    // Signal dark-scheme preference to next-themes
    await this.page.emulateMedia({ colorScheme: "dark" });

    // Force .dark class on <html> — next-themes may not respond to emulateMedia
    // alone when the page is already hydrated in light mode.
    await this.page.evaluate(() => {
      document.documentElement.classList.add("dark");
    });

    // Wait one animation frame for CSS transitions triggered by the class change
    await this.page.waitForTimeout(100);

    // Confirm the dark class is present before scanning
    const hasDark = await this.page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    if (!hasDark) {
      console.warn(
        "[axe:dark theme] .dark class not present on <html> — dark scan may not reflect actual dark styles"
      );
    }

    await this.checkA11y(disabledRules, "dark theme");

    // Restore to light / no preference after scan
    await this.page.evaluate(() => {
      document.documentElement.classList.remove("dark");
    });
    await this.page.emulateMedia({ colorScheme: "no-preference" });
  }
}
