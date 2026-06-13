/**
 * SweepChart — unit tests (UI-2)
 *
 * Strategy: mock recharts (same approach as simulation chart tests).
 * Spec: UI-2 (LineChart, one line per algorithm, X=size, Y=comparisons)
 */

import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen } from "@testing-library/react"
import type { SweepChartRow } from "@/store/dashboard-store"

// ---------------------------------------------------------------------------
// Recharts mock
// ---------------------------------------------------------------------------

vi.mock("recharts", () => {
  const ResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  )

  const LineChart = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  )

  const Line = ({ dataKey, name }: { dataKey: string; name?: string }) => (
    <div data-testid={`line-${dataKey}`} data-name={name ?? dataKey} />
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
    LineChart,
    Line,
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

import { SweepChart } from "./SweepChart"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_SWEEP: SweepChartRow[] = [
  { n: 10, bubble: 45, insertion: 25, quick: 15, merge: 22, heap: 28 },
  { n: 25, bubble: 300, insertion: 150, quick: 55, merge: 60, heap: 75 },
  { n: 50, bubble: 1225, insertion: 600, quick: 120, merge: 135, heap: 160 },
  { n: 100, bubble: 4950, insertion: 2500, quick: 270, merge: 290, heap: 350 },
  { n: 200, bubble: 19900, insertion: 10000, quick: 600, merge: 640, heap: 750 },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SweepChart", () => {
  it("renders without crashing with empty data", () => {
    expect(() => render(<SweepChart data={[]} />)).not.toThrow()
  })

  it("renders without crashing with sample data (UI-2)", () => {
    expect(() => render(<SweepChart data={SAMPLE_SWEEP} />)).not.toThrow()
  })

  it("renders a LineChart inside ResponsiveContainer", () => {
    render(<SweepChart data={SAMPLE_SWEEP} />)
    expect(screen.getByTestId("responsive-container")).toBeDefined()
    expect(screen.getByTestId("line-chart")).toBeDefined()
  })

  it("renders 5 Line elements — one per algorithm (UI-2)", () => {
    render(<SweepChart data={SAMPLE_SWEEP} />)
    expect(screen.getByTestId("line-bubble")).toBeDefined()
    expect(screen.getByTestId("line-insertion")).toBeDefined()
    expect(screen.getByTestId("line-quick")).toBeDefined()
    expect(screen.getByTestId("line-merge")).toBeDefined()
    expect(screen.getByTestId("line-heap")).toBeDefined()
  })

  it("XAxis uses 'n' as dataKey (array size)", () => {
    render(<SweepChart data={SAMPLE_SWEEP} />)
    const xAxis = screen.getByTestId("x-axis")
    expect(xAxis.getAttribute("data-key")).toBe("n")
  })

  it("renders a Legend (WCAG 1.4.1 non-color differentiation)", () => {
    render(<SweepChart data={SAMPLE_SWEEP} />)
    expect(screen.getByTestId("legend")).toBeDefined()
  })

  it("renders CartesianGrid", () => {
    render(<SweepChart data={SAMPLE_SWEEP} />)
    expect(screen.getByTestId("cartesian-grid")).toBeDefined()
  })
})
