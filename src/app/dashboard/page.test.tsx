/**
 * DashboardPage — landmark tests (REQ-A11Y-2)
 *
 * Verifies the page does not render its own <main> landmark,
 * since layout.tsx owns the single main landmark via SidebarInset.
 */

import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"

vi.mock("@/components/dashboard/DashboardVisualizer", () => ({
  DashboardVisualizer: () => (
    <div data-testid="dashboard-visualizer">Dashboard Visualizer</div>
  ),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null, toString: () => "" }),
}))

import DashboardPage from "./page"

describe("DashboardPage", () => {
  it("root element is NOT a <main> — layout owns the single main landmark (REQ-A11Y-2)", () => {
    const { container } = render(<DashboardPage />)
    const mainElements = container.querySelectorAll("main")
    expect(mainElements.length).toBe(0)
  })
})
