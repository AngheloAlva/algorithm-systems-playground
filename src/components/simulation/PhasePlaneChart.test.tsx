/**
 * PhasePlaneChart — unit tests (SIM7.2)
 *
 * Strategy: mock recharts so we can assert on structural/data wiring without
 * jsdom SVG rendering issues. Key assertions:
 *   - XAxis uses "x" (derived susceptible) as dataKey
 *   - Renders a Line with dataKey "y" (infected on y-axis)
 *   - Renders without crashing on empty and populated ticks
 */

import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen } from "@testing-library/react"
import type { SeriesPoint } from "@/lib/simulation/sird"

// ---------------------------------------------------------------------------
// Recharts mock — JSX approach (no require())
// ---------------------------------------------------------------------------

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children, data }: { children?: React.ReactNode; data?: unknown[] }) => (
    <div data-testid="line-chart" data-points={data ? String(data.length) : "0"}>
      {children}
    </div>
  ),
  Line: ({ dataKey, name }: { dataKey: string; name?: string }) => (
    <div data-testid={`line-${dataKey}`} data-name={name ?? dataKey} />
  ),
  XAxis: ({ dataKey, type }: { dataKey?: string; type?: string }) => (
    <div data-testid="x-axis" data-key={dataKey ?? ""} data-type={type ?? ""} />
  ),
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ReferenceLine: () => <div data-testid="reference-line" />,
}))

beforeAll(() => {
  class MutationObserverMock {
    observe = vi.fn()
    disconnect = vi.fn()
    takeRecords = vi.fn(() => [])
  }
  vi.stubGlobal("MutationObserver", MutationObserverMock)
})

import { PhasePlaneChart } from "./PhasePlaneChart"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_TICKS: SeriesPoint[] = [
  { day: 0, s: 999, i: 1, r: 0, d: 0 },
  { day: 1, s: 990, i: 9, r: 0.5, d: 0.5 },
  { day: 5, s: 970, i: 25, r: 3, d: 2 },
  { day: 10, s: 900, i: 80, r: 12, d: 8 },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PhasePlaneChart", () => {
  it("renders without crashing with empty ticks", () => {
    expect(() => render(<PhasePlaneChart ticks={[]} />)).not.toThrow()
  })

  it("renders without crashing with sample ticks", () => {
    expect(() => render(<PhasePlaneChart ticks={SAMPLE_TICKS} />)).not.toThrow()
  })

  it("renders a LineChart (not ScatterChart — ADR-5 trajectory direction)", () => {
    render(<PhasePlaneChart ticks={SAMPLE_TICKS} />)
    expect(screen.getByTestId("line-chart")).toBeDefined()
  })

  it("LineChart data length equals ticks length (one derived point per tick)", () => {
    render(<PhasePlaneChart ticks={SAMPLE_TICKS} />)
    const chart = screen.getByTestId("line-chart")
    expect(chart.getAttribute("data-points")).toBe(String(SAMPLE_TICKS.length))
  })

  it("XAxis dataKey is 'x' (susceptible — SIM7.2-a)", () => {
    render(<PhasePlaneChart ticks={SAMPLE_TICKS} />)
    const xAxis = screen.getByTestId("x-axis")
    expect(xAxis.getAttribute("data-key")).toBe("x")
  })

  it("XAxis type is 'number' (numeric axis for S values)", () => {
    render(<PhasePlaneChart ticks={SAMPLE_TICKS} />)
    const xAxis = screen.getByTestId("x-axis")
    expect(xAxis.getAttribute("data-type")).toBe("number")
  })

  it("renders a Line with dataKey 'y' (infected on y-axis)", () => {
    render(<PhasePlaneChart ticks={SAMPLE_TICKS} />)
    expect(screen.getByTestId("line-y")).toBeDefined()
  })

  it("empty ticks renders LineChart with 0 data points", () => {
    render(<PhasePlaneChart ticks={[]} />)
    const chart = screen.getByTestId("line-chart")
    expect(chart.getAttribute("data-points")).toBe("0")
  })
})
