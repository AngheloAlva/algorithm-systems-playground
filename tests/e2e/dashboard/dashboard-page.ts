import { Page, Locator } from "@playwright/test";
import { BasePage } from "../base-page";

export class DashboardPage extends BasePage {
  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: "Dashboard", level: 1 });
  }

  async goto(): Promise<void> {
    await super.goto("/dashboard");
  }
}
