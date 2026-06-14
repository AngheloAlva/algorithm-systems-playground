/**
 * SweepChart — reduced-motion gate tests (REQ-ANIM-5)
 *
 * Verifies all 5 Line series receive isAnimationActive={false}
 * when useReducedMotion returns true, and isAnimationActive={true}
 * when it returns false.
 */

import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen } from "@testing-library/react"
import type { SweepChartRow } from "@/store/dashboard-store"

// ---------------------------------------------------------------------------
// Mock useReducedMotion
// ---------------------------------------------------------------------------

const mockUseReducedMotion = vi.fn(() => false)

vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}))

// ---------------------------------------------------------------------------
// Recharts mock — captures isAnimationActive on Line
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

  return { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend }
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

const SAMPLE_SWEEP: SweepChartRow[] = [
  { n: 10, bubble: 45, insertion: 25, quick: 15, merge: 22, heap: 28 },
  { n: 25, bubble: 300, insertion: 150, quick: 55, merge: 60, heap: 75 },
]

const ALGO_KEYS = ["bubble", "insertion", "quick", "merge", "heap"] as const

describe("SweepChart — reduced-motion gate (REQ-ANIM-5)", () => {
  it("all Line series have isAnimationActive=false when reduced motion is active", () => {
    mockUseReducedMotion.mockReturnValue(true)

    render(<SweepChart data={SAMPLE_SWEEP} />)

    for (const key of ALGO_KEYS) {
      const el = screen.getByTestId(`line-${key}`)
      expect(el.getAttribute("data-animation"), `line-${key}`).toBe("false")
    }
  })

  it("all Line series have isAnimationActive=true when reduced motion is inactive", () => {
    mockUseReducedMotion.mockReturnValue(false)

    render(<SweepChart data={SAMPLE_SWEEP} />)

    for (const key of ALGO_KEYS) {
      const el = screen.getByTestId(`line-${key}`)
      expect(el.getAttribute("data-animation"), `line-${key}`).toBe("true")
    }
  })
})
