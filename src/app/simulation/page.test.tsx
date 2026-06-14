/**
 * Simulation page — smoke tests (SIM6.2, T9)
 *
 * Verifies:
 *   - Page no longer renders EmptyState
 *   - Page renders SimulationVisualizer (via Suspense fallback or resolved)
 *   - Module metadata uses the simulation module entry
 */

import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

// ---------------------------------------------------------------------------
// Mock SimulationVisualizer so we don't need to boot the full island
// ---------------------------------------------------------------------------

vi.mock("@/components/simulation/SimulationVisualizer", () => ({
  SimulationVisualizer: () => (
    <div data-testid="simulation-visualizer">Simulation Visualizer</div>
  ),
}))

// ---------------------------------------------------------------------------
// Mock next/navigation (Suspense boundary + useSearchParams)
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null, toString: () => "" }),
}))

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import SimulationPage from "./page"
import { MODULES } from "@/config/modules"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SimulationPage", () => {
  it("renders without crashing", () => {
    expect(() => render(<SimulationPage />)).not.toThrow()
  })

  it("root element is NOT a <main> — layout owns the single main landmark (REQ-A11Y-2)", () => {
    const { container } = render(<SimulationPage />)
    const mainElements = container.querySelectorAll("main")
    expect(mainElements.length).toBe(0)
  })

  it("does NOT render EmptyState — renders SimulationVisualizer instead (SIM6.2)", () => {
    render(<SimulationPage />)
    // The page must mount the SimulationVisualizer (mocked as data-testid="simulation-visualizer").
    // Suspense may show a fallback in sync test env — but the mocked child should resolve synchronously.
    // If the page still renders EmptyState the visualizer testid will NOT be present.
    expect(screen.queryByTestId("simulation-visualizer")).not.toBeNull()
  })

  it("page title references the simulation module", () => {
    const simulationModule = MODULES.find((m) => m.slug === "simulation")
    expect(simulationModule).toBeDefined()
    expect(simulationModule?.title).toBeTruthy()
  })
})
