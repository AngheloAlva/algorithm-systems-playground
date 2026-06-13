"use client"

/**
 * PhasePlaneChart — parametric I-vs-S trajectory for the SIRD simulator.
 *
 * Renders the epidemic's phase-plane portrait: x = S (susceptible),
 * y = I (infected), connected in time order as a continuous LineChart.
 * Uses a LineChart (not ScatterChart) so trajectory direction is preserved.
 *
 * Props:
 *   ticks — downsampled SeriesPoint array from the simulation store.
 *           Internally mapped to { x: p.s, y: p.i } for Recharts dataKeys.
 *
 * Spec:  SIM7.2
 * Design: ADR-5 (LineChart parametric — not ScatterChart)
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import type { SeriesPoint } from "@/lib/simulation/sird"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PhasePlaneChartProps {
  ticks: SeriesPoint[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PhasePlaneChart({ ticks }: PhasePlaneChartProps) {
  // Derive parametric data: x = susceptible, y = infected, in time order.
  // Derived inline; cheap at ≤160 points — no manual useMemo needed.
  const data = ticks.map((p) => ({ x: p.s, y: p.i }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="x"
          type="number"
          domain={["auto", "auto"]}
          tick={{ fontSize: 11 }}
          label={{ value: "Susceptible (S)", position: "insideBottomRight", offset: -4, fontSize: 11 }}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          width={44}
          label={{ value: "Infected (I)", angle: -90, position: "insideLeft", fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{ fontSize: 12 }}
          formatter={(value, name) => [
            typeof value === "number" ? value.toFixed(1) : String(value),
            // Recharts passes the Line's `name` prop ("I"), not the dataKey ("y").
            // Single series — always "Infected".
            name === "I" ? "Infected" : "Susceptible",
          ]}
        />
        <Line
          type="monotone"
          dataKey="y"
          stroke="#ef4444"
          dot={false}
          name="I"
          strokeWidth={1.5}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
