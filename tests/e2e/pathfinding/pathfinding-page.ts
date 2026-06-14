import { Page, Locator } from "@playwright/test";
import { BasePage } from "../base-page";

export class PathfindingPage extends BasePage {
  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: "Pathfinding", level: 1 });
  }

  async goto(): Promise<void> {
    await super.goto("/pathfinding");
  }
}
