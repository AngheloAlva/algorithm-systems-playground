/**
 * Zustand store for the sorting benchmark dashboard module.
 *
 * ## Store shape (design ADR-E)
 * - Config (URL-serializable): arrayLength, arrayMode, seed
 * - Derived results: snapshot (SnapshotResult), sweep (SweepResult)
 * - Run state: status (RUN_STATUS)
 *
 * ## Actions
 * - setArrayLength(len): clamps to [MIN, MAX], triggers recompute
 * - setArrayMode(mode): triggers recompute
 * - regenerate(): bumps seed (seed + 1), triggers recompute
 * - recompute(): runs snapshot + sweep synchronously, sets status=DONE
 *
 * ## Selectors
 * - selectConfig, selectSnapshot, selectSweep, selectStatus
 * - selectBarChartData: maps snapshot rows → BarChart shape
 * - selectSweepChartData: pivots sweep points → LineChart shape { n, bubble, insertion, ... }
 *
 * ## RUN_STATUS reuse (design ADR-E)
 * Imports RUN_STATUS + RunStatus from pathfinding-store — single source of truth (MD-2 pattern).
 * Re-exports both for consumer convenience.
 *
 * ## No React / DOM imports
 */

import { create } from "zustand"
import { RUN_STATUS, type RunStatus } from "./pathfinding-store"
import { runSnapshot, type SnapshotResult } from "../lib/benchmark/snapshot"
import { runSweep, type SweepResult } from "../lib/benchmark/sweep"
import { ARRAY_MODE, MIN_ARRAY_LENGTH, MAX_ARRAY_LENGTH } from "../lib/algorithms/sorting/array-gen"
import type { ArrayMode } from "../lib/algorithms/sorting/array-gen"
import type { SortAlgorithm } from "../lib/algorithms/sorting/index"

// Re-export for consumer convenience (mirrors sorting-store pattern)
export { RUN_STATUS }
export type { RunStatus }

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DASHBOARD_STORE_DEFAULTS = {
  arrayLength: 50,
  arrayMode: ARRAY_MODE.RANDOM as ArrayMode,
  seed: 42,
} as const

// ---------------------------------------------------------------------------
// BarChart row shape (selectBarChartData output)
// ---------------------------------------------------------------------------

export interface BarChartRow {
  algorithm: SortAlgorithm
  label: string
  comparisons: number
  swaps: number
}

// ---------------------------------------------------------------------------
// SweepChart row shape — pivoted (selectSweepChartData output)
// Design ADR-E: { n, bubble, insertion, quick, merge, heap }
// ---------------------------------------------------------------------------

export interface SweepChartRow {
  n: number
  bubble: number
  insertion: number
  quick: number
  merge: number
  heap: number
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface DashboardState {
  // Config (URL-serializable)
  arrayLength: number
  arrayMode: ArrayMode
  seed: number

  // Derived results
  snapshot: SnapshotResult | null
  sweep: SweepResult | null

  // Run state
  status: RunStatus

  // Actions
  setArrayLength: (len: number) => void
  setArrayMode: (mode: ArrayMode) => void
  setSeed: (seed: number) => void
  regenerate: () => void
  recompute: () => void
}

// ---------------------------------------------------------------------------
// Internal clamp helper
// ---------------------------------------------------------------------------

function clampArrayLength(len: number): number {
  return Math.max(MIN_ARRAY_LENGTH, Math.min(MAX_ARRAY_LENGTH, len))
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useDashboardStore = create<DashboardState>()((set, get) => ({
  // Initial state
  arrayLength: DASHBOARD_STORE_DEFAULTS.arrayLength,
  arrayMode: DASHBOARD_STORE_DEFAULTS.arrayMode,
  seed: DASHBOARD_STORE_DEFAULTS.seed,
  snapshot: null,
  sweep: null,
  status: RUN_STATUS.IDLE,

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  setArrayLength(len: number) {
    const clamped = clampArrayLength(len)
    set({ arrayLength: clamped })
    get().recompute()
  },

  setArrayMode(mode: ArrayMode) {
    set({ arrayMode: mode })
    get().recompute()
  },

  setSeed(seed: number) {
    set({ seed })
    get().recompute()
  },

  regenerate() {
    const nextSeed = get().seed + 1
    set({ seed: nextSeed })
    get().recompute()
  },

  recompute() {
    const { arrayLength, arrayMode, seed } = get()
    const snapshot = runSnapshot(arrayLength, arrayMode, seed)
    const sweep = runSweep(arrayMode, seed)
    set({ snapshot, sweep, status: RUN_STATUS.DONE })
  },
}))

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Select the URL-serializable config slice. */
export function selectConfig(state: DashboardState) {
  return {
    arrayLength: state.arrayLength,
    arrayMode: state.arrayMode,
    seed: state.seed,
  }
}

/** Select the raw SnapshotResult (null until first recompute). */
export function selectSnapshot(state: DashboardState): SnapshotResult | null {
  return state.snapshot
}

/** Select the raw SweepResult (null until first recompute). */
export function selectSweep(state: DashboardState): SweepResult | null {
  return state.sweep
}

/** Select the current run status. */
export function selectStatus(state: DashboardState): RunStatus {
  return state.status
}

/**
 * Select snapshot data shaped for the grouped BarChart.
 * Maps SnapshotResult.rows → BarChartRow[].
 * Returns null if snapshot has not been computed yet.
 */
export function selectBarChartData(state: DashboardState): BarChartRow[] | null {
  if (state.snapshot === null) return null
  return state.snapshot.rows.map((row) => ({
    algorithm: row.algorithm,
    label: row.label,
    comparisons: row.comparisons,
    swaps: row.swaps,
  }))
}

/**
 * Select sweep data shaped for the LineChart.
 * Pivots SweepResult.points → SweepChartRow[] with explicit algorithm keys.
 * Shape: { n, bubble, insertion, quick, merge, heap }
 * Returns null if sweep has not been computed yet.
 */
export function selectSweepChartData(state: DashboardState): SweepChartRow[] | null {
  if (state.sweep === null) return null
  return state.sweep.points.map((point) => ({
    n: point.n,
    bubble: point.comparisons["bubble"] ?? 0,
    insertion: point.comparisons["insertion"] ?? 0,
    quick: point.comparisons["quick"] ?? 0,
    merge: point.comparisons["merge"] ?? 0,
    heap: point.comparisons["heap"] ?? 0,
  }))
}
