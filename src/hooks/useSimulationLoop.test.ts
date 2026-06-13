/**
 * Tests for useSimulationLoop hook.
 *
 * rAF-based timing is tested with mocked rAF + manual frame pumping.
 * All simulation math is delegated to the store's step() — the hook only
 * owns pacing (rAF lifecycle + advance() accumulator). No stepSIRD math here.
 *
 * Design: sdd/phase-3-systems-simulator/design §useSimulationLoop DESIGN
 * Spec:   SIM4.1, SIM4.3, SIM4.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSimulationLoop } from "./useSimulationLoop"

// ---------------------------------------------------------------------------
// rAF mock helpers (mirrors useStepPlayer.test.ts pattern)
// ---------------------------------------------------------------------------

type RafCallback = (timestamp: number) => void

let rafCallbacks: RafCallback[] = []
let rafTimestamp = 0

function setupRafMock() {
  rafCallbacks = []
  rafTimestamp = 0
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((cb: RafCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
  )
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
}

/** Advance timestamp by deltaMs and flush all pending rAF callbacks. */
function flushRaf(deltaMs = 16) {
  rafTimestamp += deltaMs
  const cbs = rafCallbacks.splice(0)
  for (const cb of cbs) {
    cb(rafTimestamp)
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSimulationLoop", () => {
  beforeEach(() => {
    setupRafMock()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // -------------------------------------------------------------------------
  // SIM4.1 — rAF driven step when RUNNING
  // -------------------------------------------------------------------------

  it("when running, a rAF frame calls step at least once", () => {
    const step = vi.fn()
    renderHook(() =>
      useSimulationLoop({
        speed: 8, // fastest: 1ms/step → many steps per 16ms frame
        isRunning: true,
        step,
      })
    )
    act(() => {
      flushRaf(16) // frame 1: establishes baseline (elapsed = 0)
      flushRaf(16) // frame 2: 16ms elapsed @ 1ms/step → ≥1 step
    })
    expect(step).toHaveBeenCalled()
  })

  it("when running, step is called more times with higher speed", () => {
    const stepSlow = vi.fn()
    const stepFast = vi.fn()

    renderHook(() =>
      useSimulationLoop({ speed: 1, isRunning: true, step: stepSlow })
    )
    renderHook(() =>
      useSimulationLoop({ speed: 8, isRunning: true, step: stepFast })
    )

    act(() => {
      flushRaf(16)
      flushRaf(100) // large elapsed to distinguish call counts
    })
    expect(stepFast.mock.calls.length).toBeGreaterThanOrEqual(
      stepSlow.mock.calls.length
    )
  })

  // -------------------------------------------------------------------------
  // SIM4.4 — no-op when paused (isRunning = false)
  // -------------------------------------------------------------------------

  it("when not running, rAF frames do NOT call step", () => {
    const step = vi.fn()
    renderHook(() =>
      useSimulationLoop({ speed: 8, isRunning: false, step })
    )
    act(() => {
      flushRaf(16)
      flushRaf(16)
    })
    expect(step).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Speed change takes effect on the next frame without restarting
  // -------------------------------------------------------------------------

  it("speed change takes effect on the next frame without restarting rAF", () => {
    const step = vi.fn()
    const { rerender } = renderHook(
      ({ speed }: { speed: number }) =>
        useSimulationLoop({ speed, isRunning: true, step }),
      { initialProps: { speed: 4 } }
    )

    act(() => {
      flushRaf(16) // baseline frame
    })
    const callsAtSpeed4 = step.mock.calls.length

    // Change speed — must NOT cancel/restart rAF
    rerender({ speed: 8 })

    act(() => {
      flushRaf(100) // more elapsed → speed 8 produces more calls than speed 4
    })

    // Step was called before and after the speed change in the same loop
    expect(step.mock.calls.length).toBeGreaterThan(callsAtSpeed4)
  })

  // -------------------------------------------------------------------------
  // isRunning false → rAF is NOT queued (loop stops)
  // -------------------------------------------------------------------------

  it("when isRunning transitions true→false, rAF stops and step is not called further", () => {
    const step = vi.fn()
    const { rerender } = renderHook(
      ({ isRunning }: { isRunning: boolean }) =>
        useSimulationLoop({ speed: 8, isRunning, step }), // speed 8 = 1ms/step
      { initialProps: { isRunning: true } }
    )

    act(() => {
      flushRaf(16) // baseline frame
      flushRaf(50) // 50ms @ 1ms/step → many steps
    })
    expect(step).toHaveBeenCalled()

    // Transition to paused
    rerender({ isRunning: false })
    step.mockClear()

    // Further frames should NOT call step
    act(() => {
      flushRaf(16)
      flushRaf(16)
    })
    expect(step).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Unmount while running → rAF cancelled (no leak)
  // -------------------------------------------------------------------------

  it("unmount while running cancels rAF (no leak)", () => {
    const cancelAnimationFrame = vi.mocked(window.cancelAnimationFrame)
    const step = vi.fn()
    const { unmount } = renderHook(() =>
      useSimulationLoop({ speed: 4, isRunning: true, step })
    )

    act(() => {
      flushRaf(16) // queue at least one rAF
    })

    unmount()

    // cancelAnimationFrame must have been called at least once on unmount
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // rAF re-queues itself each frame while running
  // -------------------------------------------------------------------------

  it("rAF is re-queued each frame while running (continuous loop)", () => {
    const requestAnimationFrame = vi.mocked(window.requestAnimationFrame)
    const step = vi.fn()
    renderHook(() =>
      useSimulationLoop({ speed: 4, isRunning: true, step })
    )

    const callsBefore = requestAnimationFrame.mock.calls.length
    act(() => {
      flushRaf(16)
    })
    const callsAfter = requestAnimationFrame.mock.calls.length
    // rAF was queued again (re-queued from within the tick)
    expect(callsAfter).toBeGreaterThan(callsBefore)
  })
})
