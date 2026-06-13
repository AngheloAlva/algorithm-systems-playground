/**
 * Zustand FSM store for the SIRD simulation module.
 *
 * Design: sdd/phase-3-systems-simulator/design §STORE DESIGN
 * Spec:   SIM3.1–SIM3.4, SIM2.1, SIM8.1
 *
 * ## Responsibilities
 * - Own all persistent simulation state (params, speed, status, current, ticks, simTime).
 * - step(): advance one dt, accumulate recordAcc, append SeriesPoint every RECORD_INTERVAL,
 *   update peak tracking, auto-stop when I < AUTO_STOP_I AND simTime > 0.
 * - Downsampling lives HERE (not in the hook) so it is unit-testable without rAF.
 * - ticks array: always spread to a new reference on append — never .push() in place.
 *
 * ## Re-exported constants
 * RUN_STATUS and RunStatus are re-exported from pathfinding-store (same object reference,
 * not a copy). See SIM3.1.
 */

import { create } from "zustand"
import {
  initialState,
  deriveMetrics,
  stepSIRD,
  SIRD_DEFAULTS,
  DT,
  RECORD_INTERVAL,
  AUTO_STOP_I,
} from "@/lib/simulation/sird"
import type { SIRState, SIRParams, SIRMetrics, SeriesPoint } from "@/lib/simulation/sird"
import { DEFAULT_SPEED } from "@/lib/animation/speed-config"
import { RUN_STATUS } from "./pathfinding-store"
import type { RunStatus } from "./pathfinding-store"

// ---------------------------------------------------------------------------
// Re-export RUN_STATUS / RunStatus (same object reference — SIM3.1)
// ---------------------------------------------------------------------------

export { RUN_STATUS } from "./pathfinding-store"
export type { RunStatus } from "./pathfinding-store"

// ---------------------------------------------------------------------------
// Store state interface
// ---------------------------------------------------------------------------

export interface SimulationState {
  // Config (URL-serializable) — the param sliders
  params: SIRParams
  // Speed (separate slider; does NOT reset run)
  speed: number
  // Run state
  status: RunStatus
  current: SIRState
  ticks: SeriesPoint[]
  simTime: number
  recordAcc: number
  metrics: SIRMetrics

  // Param actions — each resets+replays from t=0 (locked product rule)
  setParam: (key: keyof SIRParams, value: number) => void
  // Speed action — does NOT reset
  setSpeed: (speed: number) => void
  // Playback controls
  play: () => void
  pause: () => void
  reset: () => void
  // Core sim step — called by useSimulationLoop per rAF frame
  step: () => void
}

// ---------------------------------------------------------------------------
// Internal data-slice type for getInitialState (test seam)
// ---------------------------------------------------------------------------

interface SimulationData {
  params: SIRParams
  speed: number
  status: RunStatus
  current: SIRState
  ticks: SeriesPoint[]
  simTime: number
  recordAcc: number
  metrics: SIRMetrics
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMetrics(params: SIRParams): SIRMetrics {
  const derived = deriveMetrics(params)
  return {
    ...derived,
    peakInfected: params.i0,
    peakDay: 0,
    totalDeaths: 0,
    durationDays: 0,
  }
}

function buildData(params: SIRParams): SimulationData {
  return {
    params,
    speed: DEFAULT_SPEED,
    status: RUN_STATUS.IDLE as RunStatus,
    current: initialState(params),
    ticks: [] as SeriesPoint[],
    simTime: 0,
    recordAcc: 0,
    metrics: buildMetrics(params),
  }
}

// ---------------------------------------------------------------------------
// getInitialState — test seam (mirrors graph-store pattern)
// ---------------------------------------------------------------------------

export function getInitialState(): SimulationData {
  return buildData(SIRD_DEFAULTS)
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSimulationStore = create<SimulationState>()((set, get) => ({
  ...getInitialState(),

  // -------------------------------------------------------------------------
  // setParam — full reset + re-seed from new params (SIM3.3)
  // -------------------------------------------------------------------------

  setParam(key: keyof SIRParams, value: number) {
    const params: SIRParams = { ...get().params, [key]: value }
    const speed = get().speed
    set({
      params,
      speed,
      status: RUN_STATUS.IDLE as RunStatus,
      current: initialState(params),
      ticks: [] as SeriesPoint[],
      simTime: 0,
      recordAcc: 0,
      metrics: buildMetrics(params),
    })
  },

  // -------------------------------------------------------------------------
  // setSpeed — does NOT reset (SIM3.3-b)
  // -------------------------------------------------------------------------

  setSpeed(speed: number) {
    set({ speed })
  },

  // -------------------------------------------------------------------------
  // Playback controls (SIM3.4)
  // -------------------------------------------------------------------------

  play() {
    if (get().status === RUN_STATUS.RUNNING) return
    if (get().status === RUN_STATUS.DONE) return
    set({ status: RUN_STATUS.RUNNING as RunStatus })
  },

  pause() {
    if (get().status !== RUN_STATUS.RUNNING) return
    set({ status: RUN_STATUS.PAUSED as RunStatus })
  },

  reset() {
    const params = get().params
    set({
      status: RUN_STATUS.IDLE as RunStatus,
      current: initialState(params),
      ticks: [] as SeriesPoint[],
      simTime: 0,
      recordAcc: 0,
      metrics: buildMetrics(params),
    })
  },

  // -------------------------------------------------------------------------
  // step() — called by useSimulationLoop (ADR-2, SIM2.1, SIM8.1)
  //
  // Responsibilities (per frame):
  //   1. Guard: no-op if not RUNNING
  //   2. Euler step
  //   3. Advance simTime
  //   4. Accumulate recordAcc; push SeriesPoint to ticks when >= RECORD_INTERVAL
  //      (ALWAYS spread: [...prev.ticks, point] — never .push() in place)
  //   5. Update peak tracking
  //   6. Auto-stop: if I < AUTO_STOP_I AND simTime > 0 → status=DONE, finalize metrics
  // -------------------------------------------------------------------------

  step() {
    const state = get()
    if (state.status !== RUN_STATUS.RUNNING) return

    const nextState = stepSIRD(state.current, state.params, DT)
    const nextSimTime = state.simTime + DT
    let nextRecordAcc = state.recordAcc + DT

    let nextTicks = state.ticks
    // Use RECORD_INTERVAL - 1e-10 to tolerate IEEE 754 float drift
    // (e.g. 10 × 0.1 = 0.9999999999999999, not exactly 1.0).
    if (nextRecordAcc >= RECORD_INTERVAL - 1e-10) {
      const point: SeriesPoint = {
        day: nextSimTime,
        s: nextState.s,
        i: nextState.i,
        r: nextState.r,
        d: nextState.d,
      }
      nextTicks = [...state.ticks, point]
      nextRecordAcc = nextRecordAcc - RECORD_INTERVAL
    }

    // Peak tracking (incremental)
    let { peakInfected, peakDay } = state.metrics
    if (nextState.i > peakInfected) {
      peakInfected = nextState.i
      peakDay = nextSimTime
    }

    // Auto-stop check: I < AUTO_STOP_I AND simTime > 0
    if (nextState.i < AUTO_STOP_I && nextSimTime > 0) {
      const finalMetrics: SIRMetrics = {
        ...deriveMetrics(state.params),
        peakInfected,
        peakDay,
        totalDeaths: nextState.d,
        durationDays: nextSimTime,
      }
      set({
        current: nextState,
        simTime: nextSimTime,
        recordAcc: nextRecordAcc,
        ticks: nextTicks,
        metrics: finalMetrics,
        status: RUN_STATUS.DONE as RunStatus,
      })
      return
    }

    // Still running — update state
    const nextMetrics: SIRMetrics = {
      ...state.metrics,
      peakInfected,
      peakDay,
      totalDeaths: nextState.d,
      durationDays: nextSimTime,
    }

    set({
      current: nextState,
      simTime: nextSimTime,
      recordAcc: nextRecordAcc,
      ticks: nextTicks,
      metrics: nextMetrics,
    })
  },
}))

// ---------------------------------------------------------------------------
// Selector helpers (narrow subscriptions — SIM8.1 re-render guard)
// ---------------------------------------------------------------------------

/** Select URL-serializable params for codec sync. */
export const selectSimUrlState = (s: SimulationState) => s.params

/** Select derived metrics for the metrics panel. */
export const selectSimMetrics = (s: SimulationState) => s.metrics

/** Select downsampled ticks for charts (changes only on append). */
export const selectTicks = (s: SimulationState) => s.ticks

/** Select playback status and speed (use with useShallow). */
export const selectPlayback = (s: SimulationState) => ({
  status: s.status,
  speed: s.speed,
})
