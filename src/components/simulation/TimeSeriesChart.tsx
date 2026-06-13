"use client"

/**
 * TimeSeriesChart — Recharts S/I/R/D time-series chart for the SIRD simulator.
 *
 * Props:
 *   ticks    — downsampled SeriesPoint array from the simulation store.
 *   herdLine — optional herd-immunity threshold (population count). When a
 *              finite number, renders a dashed ReferenceLine on the chart.
 *              When null/undefined the line is omitted.
 *
 * Spec: SIM7.1
 * Design: ADR-4 (ReferenceLine annotation), ADR-5 (Recharts LineChart)
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import type { SeriesPoint } from "@/lib/simulation/sird"

// ---------------------------------------------------------------------------
// Series color palette (--viz token-style hand-picked distinct hues)
// ---------------------------------------------------------------------------

const SERIES_COLORS = {
  s: "#3b82f6", // blue   — susceptible
  i: "#ef4444", // red    — infected
  r: "#22c55e", // green  — recovered
  d: "#a855f7", // purple — dead
} as const

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TimeSeriesChartProps {
  ticks: SeriesPoint[]
  /** Herd-immunity threshold in population count. Omit or null to hide line. */
  herdLine?: number | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimeSeriesChart({ ticks, herdLine }: TimeSeriesChartProps) {
  const showHerdLine = typeof herdLine === "number" && Number.isFinite(herdLine)

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={ticks} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11 }}
          label={{ value: "Day", position: "insideBottomRight", offset: -4, fontSize: 11 }}
          tickFormatter={(value) => Math.round(Number(value)).toString()}
        />
        <YAxis tick={{ fontSize: 11 }} width={40} />
        <Tooltip
          contentStyle={{ fontSize: 12 }}
          labelFormatter={(label) => `Day ${Math.round(Number(label))}`}
          formatter={(value, name) => [
            typeof value === "number" ? value.toFixed(1) : String(value),
            String(name).toUpperCase(),
          ]}
        />
        {/* Legend — persistent text labels for S/I/R/D series (WCAG 1.4.1 non-color differentiation) */}
        <Legend verticalAlign="top" height={24} iconSize={10} wrapperStyle={{ fontSize: 11 }} />

        {/* Four compartment series */}
        <Line
          type="monotone"
          dataKey="s"
          stroke={SERIES_COLORS.s}
          dot={false}
          name="S"
          strokeWidth={1.5}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="i"
          stroke={SERIES_COLORS.i}
          dot={false}
          name="I"
          strokeWidth={1.5}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="r"
          stroke={SERIES_COLORS.r}
          dot={false}
          name="R"
          strokeWidth={1.5}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="d"
          stroke={SERIES_COLORS.d}
          dot={false}
          name="D"
          strokeWidth={1.5}
          isAnimationActive={false}
        />

        {/* Optional herd-immunity threshold annotation (ADR-4) */}
        {showHerdLine && (
          <ReferenceLine
            y={herdLine}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="6 3"
            label={{
              value: "Herd immunity",
              position: "insideTopRight",
              fontSize: 10,
              fill: "hsl(var(--muted-foreground))",
            }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
