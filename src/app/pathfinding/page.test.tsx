/**
 * PathfindingPage — landmark tests (REQ-A11Y-2)
 *
 * Verifies the page does not render its own <main> landmark,
 * since layout.tsx owns the single main landmark via SidebarInset.
 */

import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"

vi.mock("@/components/pathfinding/PathfindingVisualizer", () => ({
  PathfindingVisualizer: () => (
    <div data-testid="pathfinding-visualizer">Pathfinding Visualizer</div>
  ),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null, toString: () => "" }),
}))

import PathfindingPage from "./page"

describe("PathfindingPage", () => {
  it("root element is NOT a <main> — layout owns the single main landmark (REQ-A11Y-2)", () => {
    const { container } = render(<PathfindingPage />)
    const mainElements = container.querySelectorAll("main")
    expect(mainElements.length).toBe(0)
  })
})
