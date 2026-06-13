"use client"

/**
 * SnapshotChart — grouped Recharts BarChart for snapshot benchmark results.
 *
 * Shows comparisons and swaps per algorithm as side-by-side bars.
 * The Merge Sort swaps=0 note is rendered below the chart per spec UI-1.
 *
 * Chart conventions (ADR-D): ResponsiveContainer, isAnimationActive={false},
 * CartesianGrid with hsl(var(--border)), fontSize 11 ticks, Legend.
 *
 * Spec: UI-1
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import type { BarChartRow } from "@/store/dashboard-store"

// ---------------------------------------------------------------------------
// Bar series colors — primary token for comparisons, muted for swaps
// (distinct from ALGO_COLORS used in SweepChart per design ADR-D)
// ---------------------------------------------------------------------------

const BAR_COLORS = {
  comparisons: "#3b82f6", // blue — primary metric
  swaps: "#94a3b8", // slate — secondary/muted metric
} as const

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SnapshotChartProps {
  rows: BarChartRow[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SnapshotChart({ rows }: SnapshotChartProps) {
  return (
    <div
      role="img"
      className="flex flex-col gap-2"
      aria-label="Snapshot benchmark bar chart comparing algorithm comparisons and swaps"
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            tickFormatter={(v: string) => v.replace(" Sort", "")}
          />
          <YAxis tick={{ fontSize: 11 }} width={48} />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value, name) => [
              typeof value === "number" ? value.toLocaleString() : String(value),
              String(name) === "comparisons" ? "Comparisons" : "Swaps",
            ]}
          />
          <Legend
            verticalAlign="top"
            height={24}
            iconSize={10}
            wrapperStyle={{ fontSize: 11 }}
          />
          <Bar
            dataKey="comparisons"
            name="Comparisons"
            fill={BAR_COLORS.comparisons}
            isAnimationActive={false}
          />
          <Bar
            dataKey="swaps"
            name="Swaps"
            fill={BAR_COLORS.swaps}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Merge Sort swaps=0 note — spec UI-1, design ADR-D */}
      <p
        data-testid="snapshot-merge-swaps-note"
        className="text-muted-foreground text-xs"
      >
        * Merge Sort places elements rather than swapping, so its swap count is
        always 0 by design.
      </p>
    </div>
  )
}
