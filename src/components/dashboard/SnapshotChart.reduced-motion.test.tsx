/**
 * SnapshotChart — reduced-motion gate tests (REQ-ANIM-5)
 *
 * Verifies both Bar series receive isAnimationActive={false}
 * when useReducedMotion returns true, and isAnimationActive={true}
 * when it returns false.
 */

import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen } from "@testing-library/react"
import type { BarChartRow } from "@/store/dashboard-store"

// ---------------------------------------------------------------------------
// Mock useReducedMotion
// ---------------------------------------------------------------------------

const mockUseReducedMotion = vi.fn(() => false)

vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}))

// ---------------------------------------------------------------------------
// Recharts mock — captures isAnimationActive on Bar
// ---------------------------------------------------------------------------

vi.mock("recharts", () => {
  const ResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  )

  const BarChart = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  )

  const Bar = ({
    dataKey,
    isAnimationActive,
  }: {
    dataKey: string
    isAnimationActive?: boolean
  }) => (
    <div
      data-testid={`bar-${dataKey}`}
      data-animation={String(isAnimationActive ?? true)}
    />
  )

  const XAxis = () => <div data-testid="x-axis" />
  const YAxis = () => <div data-testid="y-axis" />
  const CartesianGrid = () => <div data-testid="cartesian-grid" />
  const Tooltip = () => <div data-testid="tooltip" />
  const Legend = () => <div data-testid="legend" />

  return { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend }
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

const SAMPLE_ROWS: BarChartRow[] = [
  { algorithm: "bubble", label: "Bubble Sort", comparisons: 100, swaps: 50 },
  { algorithm: "merge", label: "Merge Sort", comparisons: 25, swaps: 0 },
]

describe("SnapshotChart — reduced-motion gate (REQ-ANIM-5)", () => {
  it("all Bar series have isAnimationActive=false when reduced motion is active", () => {
    mockUseReducedMotion.mockReturnValue(true)

    render(<SnapshotChart rows={SAMPLE_ROWS} />)

    expect(screen.getByTestId("bar-comparisons").getAttribute("data-animation")).toBe("false")
    expect(screen.getByTestId("bar-swaps").getAttribute("data-animation")).toBe("false")
  })

  it("all Bar series have isAnimationActive=true when reduced motion is inactive", () => {
    mockUseReducedMotion.mockReturnValue(false)

    render(<SnapshotChart rows={SAMPLE_ROWS} />)

    expect(screen.getByTestId("bar-comparisons").getAttribute("data-animation")).toBe("true")
    expect(screen.getByTestId("bar-swaps").getAttribute("data-animation")).toBe("true")
  })
})
