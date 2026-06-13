/**
 * TimeSeriesChart — unit tests (SIM7.1)
 *
 * Strategy: mock recharts entirely so we can assert on structural/data wiring
 * without fighting jsdom's 0×0 measurement and SVG rendering gaps.
 * We expose a lightweight spy wrapper that records the props passed by the
 * component under test, letting us verify data-key coverage and ReferenceLine
 * presence without pixel-level assertions.
 */

import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen } from "@testing-library/react"
import type { SeriesPoint } from "@/lib/simulation/sird"

// ---------------------------------------------------------------------------
// Minimal Recharts mock — records rendered children for inspection
// ---------------------------------------------------------------------------

vi.mock("recharts", () => {
  // Each "chart element" renders a data-testid so tests can query it.
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

  const ReferenceLine = ({ y, label }: { y?: number; label?: { value?: string } | string }) => {
    const labelText = typeof label === "string" ? label : label?.value ?? ""
    return (
      <div data-testid="reference-line" data-y={y}>
        {labelText ? <span data-testid="reference-line-label">{labelText}</span> : null}
      </div>
    )
  }

  const Legend = () => <div data-testid="legend" />

  return {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
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

import { TimeSeriesChart } from "./TimeSeriesChart"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_TICKS: SeriesPoint[] = [
  { day: 0, s: 999, i: 1, r: 0, d: 0 },
  { day: 1, s: 990, i: 9, r: 0.5, d: 0.5 },
  { day: 2, s: 970, i: 25, r: 3, d: 2 },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TimeSeriesChart", () => {
  it("renders without crashing with empty ticks", () => {
    expect(() => render(<TimeSeriesChart ticks={[]} />)).not.toThrow()
  })

  it("renders without crashing with sample ticks", () => {
    expect(() => render(<TimeSeriesChart ticks={SAMPLE_TICKS} />)).not.toThrow()
  })

  it("renders four Line elements (s, i, r, d series) — SIM7.1-a", () => {
    render(<TimeSeriesChart ticks={SAMPLE_TICKS} />)
    // Each Line is rendered as data-testid=line-{dataKey}
    expect(screen.getByTestId("line-s")).toBeDefined()
    expect(screen.getByTestId("line-i")).toBeDefined()
    expect(screen.getByTestId("line-r")).toBeDefined()
    expect(screen.getByTestId("line-d")).toBeDefined()
  })

  it("XAxis uses 'day' as dataKey", () => {
    render(<TimeSeriesChart ticks={SAMPLE_TICKS} />)
    const xAxis = screen.getByTestId("x-axis")
    expect(xAxis.getAttribute("data-key")).toBe("day")
  })

  it("does NOT render ReferenceLine when herdLine is undefined", () => {
    render(<TimeSeriesChart ticks={SAMPLE_TICKS} />)
    expect(screen.queryByTestId("reference-line")).toBeNull()
  })

  it("does NOT render ReferenceLine when herdLine is null", () => {
    render(<TimeSeriesChart ticks={SAMPLE_TICKS} herdLine={null} />)
    expect(screen.queryByTestId("reference-line")).toBeNull()
  })

  it("renders a ReferenceLine when herdLine is a finite number", () => {
    render(<TimeSeriesChart ticks={SAMPLE_TICKS} herdLine={650} />)
    expect(screen.getByTestId("reference-line")).toBeDefined()
  })

  it("ReferenceLine carries the herdLine y value", () => {
    render(<TimeSeriesChart ticks={SAMPLE_TICKS} herdLine={650} />)
    const refLine = screen.getByTestId("reference-line")
    expect(refLine.getAttribute("data-y")).toBe("650")
  })

  it("renders a ReferenceLine with label text when herdLine is provided", () => {
    render(<TimeSeriesChart ticks={SAMPLE_TICKS} herdLine={650} />)
    expect(screen.getByTestId("reference-line-label")).toBeDefined()
    expect(screen.getByTestId("reference-line-label").textContent).toMatch(/herd immunity/i)
  })

  it("renders ReferenceLine when herdLine is 0 (finite boundary)", () => {
    // herdLine=0 is a finite number; the component SHOULD render the line.
    // This documents the current behavior — 0 is a valid y threshold.
    render(<TimeSeriesChart ticks={SAMPLE_TICKS} herdLine={0} />)
    expect(screen.getByTestId("reference-line")).toBeDefined()
  })

  it("renders a Legend for S/I/R/D series (FIX 3 — WCAG 1.4.1 non-color differentiation)", () => {
    render(<TimeSeriesChart ticks={SAMPLE_TICKS} />)
    expect(screen.getByTestId("legend")).toBeDefined()
  })
})
