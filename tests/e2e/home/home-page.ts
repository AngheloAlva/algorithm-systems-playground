import { Page, Locator } from "@playwright/test";
import { BasePage } from "../base-page";

export class HomePage extends BasePage {
  /** Primary heading for the home page */
  readonly heading: Locator;
  /** Module cards list */
  readonly moduleList: Locator;
  /** "Explore" links inside the module grid */
  readonly exploreLinks: Locator;
  /** Sidebar nav — "Main navigation" landmark */
  readonly sidebarNav: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", {
      name: "Algorithm Systems Playground",
      level: 1,
    });
    this.moduleList = page.getByRole("list").first();
    this.exploreLinks = page.getByRole("link", { name: /Open .+ module/ });
    this.sidebarNav = page.getByRole("navigation", {
      name: "Main navigation",
    });
  }

  async goto(): Promise<void> {
    await super.goto("/");
  }
}
