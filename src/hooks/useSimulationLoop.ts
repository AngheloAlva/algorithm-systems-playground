"use client"

/**
 * useSimulationLoop — rAF-driven pacing hook for the SIRD simulation.
 *
 * Design: sdd/phase-3-systems-simulator/design §useSimulationLoop DESIGN
 * Spec:   SIM4.1, SIM4.4
 *
 * ## Responsibilities (ONLY):
 * - Manage rAF lifecycle (start, re-queue, cancel on unmount/stop).
 * - Compute step count per frame via advance() + getMsPerStep().
 * - Call store's step() that many times.
 *
 * ## NOT responsible for:
 * - Simulation math (that is stepSIRD in sird.ts).
 * - Downsampling (that is store.step()).
 * - Auto-stop detection (that is store.step(); hook reads isRunning to stop loop).
 *
 * ## Why useStepPlayer CANNOT be reused:
 * useStepPlayer is a cursor over a pre-computed trace of fixed `length`.
 * SIRD has no precomputed trace — state is generated live; the series GROWS.
 * useStepPlayer's terminal condition is cursor >= length-1 (index test).
 * SIRD auto-stop is I < AUTO_STOP_I (a value test that fires inside store.step()).
 * Reusing it would require inverting its entire contract. New hook required.
 * We DO reuse advance() and getMsPerStep() — that math is trace-agnostic.
 */

import { useEffect, useLayoutEffect, useRef } from "react"
import { advance } from "@/lib/animation/stepper"
import { getMsPerStep } from "@/lib/animation/speed-config"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum simulation steps that may fire in a single rAF frame.
 *
 * Without this cap, a backgrounded-then-refocused tab can produce a massive
 * elapsed delta (seconds or minutes), causing thousands of synchronous step()
 * calls in one frame and locking the UI. Mirrors the `remaining` cap pattern
 * used in useStepPlayer.
 */
const MAX_STEPS_PER_FRAME = 600

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseSimulationLoopOptions {
  /** Discrete speed level 1–8, resolved via getMsPerStep(). */
  speed: number
  /** True when store status === RUNNING. Controls whether rAF runs. */
  isRunning: boolean
  /** Store action: advance one dt, maybe append SeriesPoint, maybe auto-stop. */
  step: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSimulationLoop({ speed, isRunning, step }: UseSimulationLoopOptions): void {
  // Mutable refs — shared with the rAF loop closure to avoid stale closures.
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const accRef = useRef<number>(0)
  const isRunningRef = useRef<boolean>(isRunning)
  const speedRef = useRef<number>(speed)
  const stepRef = useRef<() => void>(step)

  // Keep refs current after each render (before browser paint).
  // Using useLayoutEffect avoids the "ref access during render" lint error.
  useLayoutEffect(() => {
    isRunningRef.current = isRunning
    speedRef.current = speed
    stepRef.current = step
  })

  // The tick function lives in a ref so it can reference itself recursively
  // without creating a circular useCallback dependency.
  const tickRef = useRef<(timestamp: number) => void>(() => {})

  useLayoutEffect(() => {
    tickRef.current = (timestamp: number) => {
      // Guard: stop loop if no longer running
      if (!isRunningRef.current) return

      const last = lastTimeRef.current ?? timestamp
      const elapsedMs = timestamp - last
      lastTimeRef.current = timestamp

      const msPerStep = getMsPerStep(speedRef.current)
      // Pass MAX_STEPS_PER_FRAME as the `remaining` cap to advance() so that
      // a huge elapsed delta (backgrounded tab) never causes thousands of
      // synchronous step() calls in one frame. Pattern mirrors useStepPlayer.
      const { steps, nextAcc } = advance(accRef.current, elapsedMs, 1, msPerStep, MAX_STEPS_PER_FRAME)
      accRef.current = nextAcc

      // Call store's step() once per sim-dt
      for (let i = 0; i < steps; i++) {
        stepRef.current()
        // Re-check isRunning after each step — store may have set DONE via auto-stop
        if (!isRunningRef.current) return
      }

      // Re-queue for the next frame
      rafRef.current = requestAnimationFrame((t) => tickRef.current(t))
    }
  })

  // Start/stop the rAF loop when isRunning changes.
  useEffect(() => {
    if (isRunning) {
      // Reset timing accumulators on each new run start
      lastTimeRef.current = null
      accRef.current = 0
      rafRef.current = requestAnimationFrame((t) => tickRef.current(t))
    } else {
      // Cancel any in-flight rAF when paused/stopped/reset
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isRunning])

  // Cleanup on unmount — cancel rAF to prevent memory leaks
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [])
}
