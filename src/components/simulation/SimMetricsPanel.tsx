/**
 * SimMetricsPanel — live metrics display for the SIRD simulator.
 *
 * Presentational component — no store access. Accepts `metrics` and `status`
 * as props. Status gates display:
 *   - IDLE: show "—" for run-dependent metrics (peak, deaths, duration);
 *           param-derived metrics (R0, CFR, herd) may also show "—" to avoid
 *           confusion before any run.
 *   - RUNNING / PAUSED / DONE: show actual values.
 *
 * Spec: SIM7.3
 * Design: §COMPONENT COMPOSITION (SimMetricsPanel)
 */

import type { SIRMetrics } from "@/lib/simulation/sird"
import { RUN_STATUS } from "@/store/simulation-store"
import type { RunStatus } from "@/store/simulation-store"
import { ControlPanel } from "@/components/controls/control-panel"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SimMetricsPanelProps {
  metrics: SIRMetrics
  /** Current run status — gates "—" placeholders. */
  status: RunStatus | string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DASH = "—"

function fmt(value: number, decimals = 1): string {
  return value.toFixed(decimals)
}

function fmtPct(fraction: number, decimals = 1): string {
  return `${(fraction * 100).toFixed(decimals)}%`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SimMetricsPanel({ metrics, status }: SimMetricsPanelProps) {
  // "has run" = any status other than IDLE means we have or had simulation data
  const hasRun = status !== RUN_STATUS.IDLE

  // Param-derived (valid any time once we have params):
  const r0Display = hasRun ? fmt(metrics.r0, 2) : DASH
  const cfrDisplay = hasRun ? fmtPct(metrics.cfr) : DASH
  const herdDisplay = hasRun ? fmtPct(metrics.herdImmunityThreshold) : DASH

  // Run-dependent (meaningful during/after a run):
  const peakInfectedDisplay = hasRun ? fmt(metrics.peakInfected, 0) : DASH
  const peakDayDisplay = hasRun ? fmt(metrics.peakDay, 1) : DASH
  const totalDeathsDisplay = hasRun ? fmt(metrics.totalDeaths, 0) : DASH
  const durationDisplay = hasRun ? fmt(metrics.durationDays, 1) : DASH

  return (
    <ControlPanel title="Metrics">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted-foreground text-xs col-span-2 font-medium uppercase tracking-wide mt-1">
          Epidemic params
        </dt>

        <dt className="text-muted-foreground text-xs">R₀</dt>
        <dd className="font-medium tabular-nums">{r0Display}</dd>

        <dt className="text-muted-foreground text-xs">CFR</dt>
        <dd className="font-medium tabular-nums">{cfrDisplay}</dd>

        <dt className="text-muted-foreground text-xs">Herd immunity</dt>
        <dd className="font-medium tabular-nums">{herdDisplay}</dd>

        <dt className="text-muted-foreground text-xs col-span-2 font-medium uppercase tracking-wide mt-2">
          Run results
        </dt>

        <dt className="text-muted-foreground text-xs">Peak infected</dt>
        <dd className="font-medium tabular-nums">{peakInfectedDisplay}</dd>

        <dt className="text-muted-foreground text-xs">Peak day</dt>
        <dd className="font-medium tabular-nums">{peakDayDisplay}</dd>

        <dt className="text-muted-foreground text-xs">Total deaths</dt>
        <dd className="font-medium tabular-nums">{totalDeathsDisplay}</dd>

        <dt className="text-muted-foreground text-xs">Duration (days)</dt>
        <dd className="font-medium tabular-nums">{durationDisplay}</dd>
      </dl>
    </ControlPanel>
  )
}
