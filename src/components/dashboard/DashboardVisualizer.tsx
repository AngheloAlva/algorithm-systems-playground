"use client"

/**
 * DashboardVisualizer — "use client" island for the sorting benchmark dashboard.
 *
 * Assembles:
 *   - BenchmarkControls: array length slider + mode select + Regenerate button
 *   - SnapshotChart: grouped BarChart comparing 5 algorithms (comparisons + swaps)
 *   - MetricsTable: tabular metrics with Merge Sort swaps=0 note
 *   - SweepChart: LineChart showing comparison growth across SWEEP_SIZES
 *
 * URL sync (mirrors SimulationVisualizer / GraphVisualizer pattern):
 *   - On mount: reads useSearchParams() → dashboardCodec.decode → applies via store actions
 *   - On config change: writes URL via dashboardCodec.encode + router.replace
 *
 * The store runs recompute() eagerly on any config change, so results are always fresh.
 *
 * Note on selector usage: selectBarChartData / selectSweepChartData create new array
 * references on every call. Using them directly as Zustand selectors would trigger
 * "getSnapshot should be cached" warnings and potential infinite re-render cycles.
 * Instead, we subscribe to snapshot/sweep (stable store fields) and derive chart data
 * from them inline in render — this is correct behavior per React/Zustand docs.
 *
 * Spec: UI-5, UI-6
 * Design: ADR-C (single scrolling page), ADR-F (RSC boundary)
 */

import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import {
  useDashboardStore,
  type BarChartRow,
  type SweepChartRow,
} from "@/store/dashboard-store"
import type { SnapshotResult } from "@/lib/benchmark/snapshot"
import type { SweepResult } from "@/lib/benchmark/sweep"
import { dashboardCodec } from "@/lib/url-state/dashboard-codec"

import { SnapshotChart } from "./SnapshotChart"
import { SweepChart } from "./SweepChart"
import { MetricsTable } from "./MetricsTable"
import { BenchmarkControls } from "./BenchmarkControls"
import { ControlPanel } from "@/components/controls/control-panel"

// ---------------------------------------------------------------------------
// Data mappers (kept here to avoid creating new selector references in Zustand)
// ---------------------------------------------------------------------------

function mapSnapshotToBarChartRows(snapshot: SnapshotResult): BarChartRow[] {
  return snapshot.rows.map((row) => ({
    algorithm: row.algorithm,
    label: row.label,
    comparisons: row.comparisons,
    swaps: row.swaps,
  }))
}

function mapSweepToChartRows(sweep: SweepResult): SweepChartRow[] {
  return sweep.points.map((point) => ({
    n: point.n,
    bubble: point.comparisons["bubble"] ?? 0,
    insertion: point.comparisons["insertion"] ?? 0,
    quick: point.comparisons["quick"] ?? 0,
    merge: point.comparisons["merge"] ?? 0,
    heap: point.comparisons["heap"] ?? 0,
  }))
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardVisualizer() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // -------------------------------------------------------------------------
  // Store subscriptions — subscribe to stable state fields, not derived arrays
  // -------------------------------------------------------------------------

  const snapshot = useDashboardStore((s) => s.snapshot)
  const sweep = useDashboardStore((s) => s.sweep)
  const setArrayLength = useDashboardStore((s) => s.setArrayLength)
  const setArrayMode = useDashboardStore((s) => s.setArrayMode)
  const recompute = useDashboardStore((s) => s.recompute)

  // Derive chart data from stable snapshot/sweep references (inline, not via selector)
  const barChartData: BarChartRow[] = snapshot ? mapSnapshotToBarChartRows(snapshot) : []
  const sweepChartData: SweepChartRow[] = sweep ? mapSweepToChartRows(sweep) : []

  // -------------------------------------------------------------------------
  // URL sync — read once on mount (mirrors GraphVisualizer / SimulationVisualizer)
  // -------------------------------------------------------------------------

  const urlSyncedRef = useRef(false)

  useEffect(() => {
    if (urlSyncedRef.current) return
    urlSyncedRef.current = true

    const decoded = dashboardCodec.decode(searchParams)
    const current = useDashboardStore.getState()

    // Apply URL params that differ from current store state.
    // setArrayLength / setArrayMode each call recompute() internally.
    // If no config differs, call recompute() directly for initial data load.
    let configChanged = false
    if (decoded.arrayLength !== current.arrayLength) {
      setArrayLength(decoded.arrayLength)
      configChanged = true
    }
    if (decoded.arrayMode !== current.arrayMode) {
      setArrayMode(decoded.arrayMode)
      configChanged = true
    }
    if (!configChanged) {
      recompute()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // -------------------------------------------------------------------------
  // URL write — called after any config change by BenchmarkControls
  // -------------------------------------------------------------------------

  function syncUrl() {
    const { arrayLength, arrayMode, seed } = useDashboardStore.getState()
    const urlState = { arrayLength, arrayMode, seed }
    const urlParams = dashboardCodec.encode(urlState)
    const qs = urlParams.toString()
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false })
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Main content: controls + charts side-by-side */}
      <div className="flex flex-1 gap-4">
        {/* Left column: charts stack */}
        <div className="flex flex-1 flex-col gap-4">
          {/* Snapshot section — bar chart + table */}
          <ControlPanel title="Snapshot — Comparisons & Swaps">
            <SnapshotChart rows={barChartData} />
          </ControlPanel>

          <ControlPanel title="Metrics">
            <MetricsTable rows={barChartData} />
          </ControlPanel>

          {/* Sweep section — line chart */}
          <ControlPanel title="Sweep — Comparisons Across Sizes (10 – 200)">
            <SweepChart data={sweepChartData} />
          </ControlPanel>
        </div>

        {/* Right panel: controls */}
        <div className="flex w-64 flex-shrink-0 flex-col gap-3">
          <ControlPanel title="Configuration">
            <BenchmarkControls onConfigChange={syncUrl} />
          </ControlPanel>

          {/* Info card */}
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              The sweep chart uses fixed sizes [10, 25, 50, 100, 200] to show
              how O(n²) algorithms diverge from O(n log n) as input grows.
              Array length only affects the snapshot bars.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
