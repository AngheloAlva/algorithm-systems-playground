/**
 * PhasePlaneChart — reduced-motion gate tests (REQ-ANIM-5)
 *
 * Verifies the Line series receives isAnimationActive={false}
 * when useReducedMotion returns true, and isAnimationActive={true}
 * when it returns false.
 */

import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen } from "@testing-library/react"
import type { SeriesPoint } from "@/lib/simulation/sird"

// ---------------------------------------------------------------------------
// Mock useReducedMotion
// ---------------------------------------------------------------------------

const mockUseReducedMotion = vi.fn(() => false)

vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}))

// ---------------------------------------------------------------------------
// Recharts mock — captures isAnimationActive
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

  return { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip }
})

beforeAll(() => {
  class MutationObserverMock {
    observe = vi.fn()
    disconnect = vi.fn()
    takeRecords = vi.fn(() => [])
  }
  vi.stubGlobal("MutationObserver", MutationObserverMock)
})

import { PhasePlaneChart } from "./PhasePlaneChart"

const TICKS: SeriesPoint[] = [
  { day: 0, s: 999, i: 1, r: 0, d: 0 },
  { day: 1, s: 990, i: 9, r: 0.5, d: 0.5 },
]

describe("PhasePlaneChart — reduced-motion gate (REQ-ANIM-5)", () => {
  it("Line series has isAnimationActive=false when reduced motion is active", () => {
    mockUseReducedMotion.mockReturnValue(true)

    render(<PhasePlaneChart ticks={TICKS} />)

    const el = screen.getByTestId("line-y")
    expect(el.getAttribute("data-animation")).toBe("false")
  })

  it("Line series has isAnimationActive=true when reduced motion is inactive", () => {
    mockUseReducedMotion.mockReturnValue(false)

    render(<PhasePlaneChart ticks={TICKS} />)

    const el = screen.getByTestId("line-y")
    expect(el.getAttribute("data-animation")).toBe("true")
  })
})
