/**
 * DashboardVisualizer — integration tests (UI-5)
 *
 * Strategy: mock next/navigation, mock recharts, mock child components;
 * control dashboard store directly (no real benchmarks in tests).
 *
 * Spec: UI-5 (page wiring, Suspense, no EmptyState)
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

// ---------------------------------------------------------------------------
// next/navigation mock
// ---------------------------------------------------------------------------

const mockReplace = vi.fn()
const mockSearchParams: { get: (key: string) => string | null; toString: () => string } = {
  get: () => null,
  toString: () => "",
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/dashboard",
}))

// ---------------------------------------------------------------------------
// Recharts mock
// ---------------------------------------------------------------------------

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: ({ dataKey }: { dataKey: string }) => (
    <div data-testid={`bar-${dataKey}`} />
  ),
  LineChart: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: ({ dataKey }: { dataKey: string }) => (
    <div data-testid={`line-${dataKey}`} />
  ),
  XAxis: ({ dataKey }: { dataKey?: string }) => (
    <div data-testid="x-axis" data-key={dataKey ?? ""} />
  ),
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}))

// ---------------------------------------------------------------------------
// jsdom stubs
// ---------------------------------------------------------------------------

beforeAll(() => {
  class MutationObserverMock {
    observe = vi.fn()
    disconnect = vi.fn()
    takeRecords = vi.fn(() => [])
  }
  vi.stubGlobal("MutationObserver", MutationObserverMock)

  class ResizeObserverMock {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverMock)
})

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

import { useDashboardStore } from "@/store/dashboard-store"
import { DashboardVisualizer } from "./DashboardVisualizer"

function resetStore() {
  useDashboardStore.setState({
    arrayLength: 50,
    arrayMode: "random",
    seed: 42,
    snapshot: null,
    sweep: null,
    status: "idle",
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetStore()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DashboardVisualizer — mount", () => {
  it("renders without crashing (UI-5)", () => {
    expect(() => render(<DashboardVisualizer />)).not.toThrow()
  })

  it("renders the snapshot chart area (bar-chart)", () => {
    render(<DashboardVisualizer />)
    expect(screen.getByTestId("bar-chart")).toBeDefined()
  })

  it("renders the sweep chart area (line-chart)", () => {
    render(<DashboardVisualizer />)
    expect(screen.getByTestId("line-chart")).toBeDefined()
  })

  it("renders the metrics table", () => {
    const { container } = render(<DashboardVisualizer />)
    // Query specifically within table headers to avoid matching other text
    const headers = container.querySelectorAll("th")
    const headerTexts = Array.from(headers).map((h) => h.textContent?.toLowerCase() ?? "")
    expect(headerTexts.some((t) => t.includes("algorithm"))).toBe(true)
    expect(headerTexts.some((t) => t.includes("comparisons"))).toBe(true)
    expect(headerTexts.some((t) => t.includes("swaps"))).toBe(true)
  })

  it("renders a slider for array length controls", () => {
    const { container } = render(<DashboardVisualizer />)
    const slider = container.querySelector("[data-slot='slider']")
    expect(slider).toBeTruthy()
  })

  it("renders a Regenerate button", () => {
    render(<DashboardVisualizer />)
    expect(screen.getByRole("button", { name: /regenerate/i })).toBeDefined()
  })
})

describe("DashboardVisualizer — URL sync", () => {
  it("reads searchParams on mount and hydrates arrayLength", () => {
    // Override mock to return a non-default length
    mockSearchParams.get = (key: string): string | null =>
      key === "len" ? "100" : null

    render(<DashboardVisualizer />)

    const state = useDashboardStore.getState()
    expect(state.arrayLength).toBe(100)

    // Reset mock
    mockSearchParams.get = (): string | null => null
  })

  it("hydrates arrayMode from ?mode=reversed", () => {
    mockSearchParams.get = (key: string): string | null =>
      key === "mode" ? "reversed" : null

    render(<DashboardVisualizer />)

    const state = useDashboardStore.getState()
    expect(state.arrayMode).toBe("reversed")

    mockSearchParams.get = (): string | null => null
  })

  it("hydrates seed from ?seed=7", () => {
    mockSearchParams.get = (key: string): string | null =>
      key === "seed" ? "7" : null

    render(<DashboardVisualizer />)

    const state = useDashboardStore.getState()
    expect(state.seed).toBe(7)
    // recompute ran with the hydrated seed → results populated (not just state set)
    expect(state.snapshot).not.toBeNull()

    mockSearchParams.get = (): string | null => null
  })

  it("batches all three params and triggers exactly one recompute (no triple-recompute)", () => {
    const recomputeSpy = vi.fn()
    useDashboardStore.setState({ recompute: recomputeSpy })

    mockSearchParams.get = (key: string): string | null => {
      if (key === "len") return "120"
      if (key === "mode") return "reversed"
      if (key === "seed") return "7"
      return null
    }

    render(<DashboardVisualizer />)

    expect(recomputeSpy).toHaveBeenCalledTimes(1)
    const state = useDashboardStore.getState()
    expect(state.arrayLength).toBe(120)
    expect(state.arrayMode).toBe("reversed")
    expect(state.seed).toBe(7)

    mockSearchParams.get = (): string | null => null
  })
})
