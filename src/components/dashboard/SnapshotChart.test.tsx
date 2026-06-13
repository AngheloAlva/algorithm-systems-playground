/**
 * SnapshotChart — unit tests (UI-1)
 *
 * Strategy: mock recharts (same approach as simulation chart tests) so we can
 * assert structural/data wiring without fighting jsdom's SVG rendering gaps.
 * Spec: UI-1 (grouped BarChart for snapshot comparisons + swaps, 5 algorithm groups)
 */

import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen } from "@testing-library/react"
import type { BarChartRow } from "@/store/dashboard-store"

// ---------------------------------------------------------------------------
// Recharts mock
// ---------------------------------------------------------------------------

vi.mock("recharts", () => {
  const ResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  )

  const BarChart = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  )

  const Bar = ({ dataKey, name }: { dataKey: string; name?: string }) => (
    <div data-testid={`bar-${dataKey}`} data-name={name ?? dataKey} />
  )

  const XAxis = ({ dataKey }: { dataKey?: string }) => (
    <div data-testid="x-axis" data-key={dataKey ?? ""} />
  )

  const YAxis = () => <div data-testid="y-axis" />

  const CartesianGrid = () => <div data-testid="cartesian-grid" />

  const Tooltip = () => <div data-testid="tooltip" />

  const Legend = () => <div data-testid="legend" />

  return {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
  }
})

beforeAll(() => {
  class MutationObserverMock {
    observe = vi.fn()
    disconnect = vi.fn()
    takeRecords = vi.fn(() => [])
  }
  vi.stubGlobal("MutationObserver", MutationObserverMock)
})

import { SnapshotChart } from "./SnapshotChart"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_ROWS: BarChartRow[] = [
  { algorithm: "bubble", label: "Bubble Sort", comparisons: 100, swaps: 50 },
  { algorithm: "insertion", label: "Insertion Sort", comparisons: 80, swaps: 40 },
  { algorithm: "quick", label: "Quick Sort", comparisons: 30, swaps: 10 },
  { algorithm: "merge", label: "Merge Sort", comparisons: 25, swaps: 0 },
  { algorithm: "heap", label: "Heap Sort", comparisons: 35, swaps: 15 },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SnapshotChart", () => {
  it("renders without crashing with empty rows", () => {
    expect(() => render(<SnapshotChart rows={[]} />)).not.toThrow()
  })

  it("renders without crashing with sample data (UI-1)", () => {
    expect(() => render(<SnapshotChart rows={SAMPLE_ROWS} />)).not.toThrow()
  })

  it("renders a BarChart inside ResponsiveContainer", () => {
    render(<SnapshotChart rows={SAMPLE_ROWS} />)
    expect(screen.getByTestId("responsive-container")).toBeDefined()
    expect(screen.getByTestId("bar-chart")).toBeDefined()
  })

  it("renders two Bar series: comparisons and swaps (UI-1)", () => {
    render(<SnapshotChart rows={SAMPLE_ROWS} />)
    expect(screen.getByTestId("bar-comparisons")).toBeDefined()
    expect(screen.getByTestId("bar-swaps")).toBeDefined()
  })

  it("renders XAxis keyed on 'label' (algorithm names)", () => {
    render(<SnapshotChart rows={SAMPLE_ROWS} />)
    const xAxis = screen.getByTestId("x-axis")
    expect(xAxis.getAttribute("data-key")).toBe("label")
  })

  it("renders a Legend for non-color differentiation (WCAG 1.4.1)", () => {
    render(<SnapshotChart rows={SAMPLE_ROWS} />)
    expect(screen.getByTestId("legend")).toBeDefined()
  })

  it("renders the Merge Sort swaps=0 note — UI-1 (Merge uses PLACE not SWAP)", () => {
    render(<SnapshotChart rows={SAMPLE_ROWS} />)
    // Must include a note conveying that Merge Sort places elements, not swaps
    const note = screen.getByTestId("merge-swaps-note")
    expect(note).toBeDefined()
    expect(note.textContent).toMatch(/merge|place/i)
  })

  it("renders CartesianGrid with chart structure", () => {
    render(<SnapshotChart rows={SAMPLE_ROWS} />)
    expect(screen.getByTestId("cartesian-grid")).toBeDefined()
  })
})
