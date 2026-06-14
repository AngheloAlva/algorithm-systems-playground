"use client"

/**
 * SweepChart — Recharts LineChart showing comparisons growth across SWEEP_SIZES.
 *
 * One line per algorithm (5 total) using the curated ALGO_COLORS palette
 * from design ADR-D. X-axis = array size (n), Y-axis = comparisons.
 *
 * Visualizes O(n²) vs O(n log n) divergence.
 *
 * Chart conventions (ADR-D): ResponsiveContainer, isAnimationActive={!reduced}
 * (gated via useReducedMotion, REQ-ANIM-5), CartesianGrid with hsl(var(--border)),
 * fontSize 11 ticks, Legend verticalAlign="top".
 *
 * Spec: UI-2
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import type { SweepChartRow } from "@/store/dashboard-store"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

// ---------------------------------------------------------------------------
// Algorithm color palette (design ADR-D) — distinct hues, WCAG non-color
// differentiation via legend text labels
// ---------------------------------------------------------------------------

const ALGO_COLORS = {
  bubble: "#3b82f6", // blue
  insertion: "#f59e0b", // amber
  quick: "#22c55e", // green
  merge: "#a855f7", // purple
  heap: "#ef4444", // red
} as const

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SweepChartProps {
  data: SweepChartRow[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SweepChart({ data }: SweepChartProps) {
  const reduced = useReducedMotion()
  return (
    <div
      role="img"
      aria-label="Sweep benchmark line chart showing comparisons growth across array sizes"
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="n"
            tick={{ fontSize: 11 }}
            label={{
              value: "Array size (n)",
              position: "insideBottomRight",
              offset: -4,
              fontSize: 11,
            }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            width={52}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
          />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value, name) => [
              typeof value === "number" ? value.toLocaleString() : String(value),
              String(name),
            ]}
            labelFormatter={(label) => `n = ${label}`}
          />
          <Legend
            verticalAlign="top"
            height={24}
            iconSize={10}
            wrapperStyle={{ fontSize: 11 }}
          />
          <Line
            type="monotone"
            dataKey="bubble"
            name="Bubble"
            stroke={ALGO_COLORS.bubble}
            dot={false}
            strokeWidth={1.5}
            isAnimationActive={!reduced}
          />
          <Line
            type="monotone"
            dataKey="insertion"
            name="Insertion"
            stroke={ALGO_COLORS.insertion}
            dot={false}
            strokeWidth={1.5}
            isAnimationActive={!reduced}
          />
          <Line
            type="monotone"
            dataKey="quick"
            name="Quick"
            stroke={ALGO_COLORS.quick}
            dot={false}
            strokeWidth={1.5}
            isAnimationActive={!reduced}
          />
          <Line
            type="monotone"
            dataKey="merge"
            name="Merge"
            stroke={ALGO_COLORS.merge}
            dot={false}
            strokeWidth={1.5}
            isAnimationActive={!reduced}
          />
          <Line
            type="monotone"
            dataKey="heap"
            name="Heap"
            stroke={ALGO_COLORS.heap}
            dot={false}
            strokeWidth={1.5}
            isAnimationActive={!reduced}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
