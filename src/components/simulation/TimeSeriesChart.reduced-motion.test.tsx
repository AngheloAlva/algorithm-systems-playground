/**
 * TimeSeriesChart — reduced-motion gate tests (REQ-ANIM-5)
 *
 * Verifies that all Line series receive isAnimationActive={false}
 * when useReducedMotion returns true, and isAnimationActive={true}
 * when it returns false.
 */

import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen } from "@testing-library/react"
import type { SeriesPoint } from "@/lib/simulation/sird"

// ---------------------------------------------------------------------------
// Mock useReducedMotion — controlled per test
// ---------------------------------------------------------------------------

const mockUseReducedMotion = vi.fn(() => false)

vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}))

// ---------------------------------------------------------------------------
// Recharts mock — captures isAnimationActive per series
// ---------------------------------------------------------------------------

vi.mock("recharts", () => {
  const ResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  )

  const LineChart = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  )

  const Line = ({
    dataKey,
    isAnimationActive,
  }: {
    dataKey: string
    isAnimationActive?: boolean
  }) => (
    <div
      data-testid={`line-${dataKey}`}
      data-animation={String(isAnimationActive ?? true)}
    />
  )

  const XAxis = () => <div data-testid="x-axis" />
  const YAxis = () => <div data-testid="y-axis" />
  const CartesianGrid = () => <div data-testid="cartesian-grid" />
  const Tooltip = () => <div data-testid="tooltip" />
  const Legend = () => <div data-testid="legend" />
  const ReferenceLine = () => <div data-testid="reference-line" />

  return { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine }
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

const TICKS: SeriesPoint[] = [
  { day: 0, s: 999, i: 1, r: 0, d: 0 },
  { day: 1, s: 990, i: 9, r: 0.5, d: 0.5 },
]

describe("TimeSeriesChart — reduced-motion gate (REQ-ANIM-5)", () => {
  it("all Line series have isAnimationActive=false when reduced motion is active", () => {
    mockUseReducedMotion.mockReturnValue(true)

    render(<TimeSeriesChart ticks={TICKS} />)

    for (const key of ["s", "i", "r", "d"]) {
      const el = screen.getByTestId(`line-${key}`)
      expect(el.getAttribute("data-animation"), `line-${key}`).toBe("false")
    }
  })

  it("all Line series have isAnimationActive=true when reduced motion is inactive", () => {
    mockUseReducedMotion.mockReturnValue(false)

    render(<TimeSeriesChart ticks={TICKS} />)

    for (const key of ["s", "i", "r", "d"]) {
      const el = screen.getByTestId(`line-${key}`)
      expect(el.getAttribute("data-animation"), `line-${key}`).toBe("true")
    }
  })
})
