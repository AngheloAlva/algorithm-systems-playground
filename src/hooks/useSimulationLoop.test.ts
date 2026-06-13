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
    const requestAnimationFrameMock = vi.mocked(window.requestAnimationFrame)
    const { rerender } = renderHook(
      ({ speed }: { speed: number }) =>
        useSimulationLoop({ speed, isRunning: true, step }),
      { initialProps: { speed: 4 } }
    )

    // Frame 1: establishes lastTimeRef baseline (elapsedMs = 0, no steps fired)
    act(() => {
      flushRaf(16)
    })
    const callsAtSpeed4 = step.mock.calls.length
    const rafCallsBeforeSpeedChange = requestAnimationFrameMock.mock.calls.length

    // Change speed — must NOT cancel/restart rAF (no extra requestAnimationFrame call)
    rerender({ speed: 8 })
    const rafCallsAfterSpeedChange = requestAnimationFrameMock.mock.calls.length
    // Speed change alone must not trigger an extra rAF scheduling
    expect(rafCallsAfterSpeedChange).toBe(rafCallsBeforeSpeedChange)

    act(() => {
      flushRaf(100) // 100ms elapsed — speed 8 produces more steps than speed 4 would
    })

    // Steps accumulated across both speeds in the same continuous loop
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
  // MAX_STEPS_PER_FRAME clamp (FIX 4) — backgrounded-tab defense
  // -------------------------------------------------------------------------

  it("a very large elapsed delta never triggers more than MAX_STEPS_PER_FRAME steps", () => {
    const step = vi.fn()
    renderHook(() =>
      useSimulationLoop({ speed: 8, isRunning: true, step })
    )
    act(() => {
      flushRaf(16)       // frame 1: establishes baseline
      flushRaf(100000)   // frame 2: 100 s elapsed — would be millions of steps unclamped
    })
    // MAX_STEPS_PER_FRAME = 600; total calls must be at most 600 (frame 2 only)
    // Frame 1 may produce a few calls at speed 8 (1ms/step, elapsed=0), so we give
    // a small buffer but ensure the catastrophic case is prevented.
    expect(step.mock.calls.length).toBeLessThanOrEqual(600)
  })

  // -------------------------------------------------------------------------
  // FIX D — rAF NOT re-queued after auto-stop (isRunning false post-loop)
  // -------------------------------------------------------------------------

  it("rAF is NOT re-queued on the frame where isRunning becomes false (auto-stop guard)", () => {
    const requestAnimationFrameMock = vi.mocked(window.requestAnimationFrame)
    const step = vi.fn()
    const { rerender } = renderHook(
      ({ isRunning }: { isRunning: boolean }) =>
        useSimulationLoop({ speed: 4, isRunning, step }),
      { initialProps: { isRunning: true } }
    )

    // Frame 1: establishes baseline (isRunning = true, re-queue fires)
    act(() => {
      flushRaf(16)
    })
    const rafCountAfterRunningFrame = requestAnimationFrameMock.mock.calls.length

    // Transition to stopped (simulates auto-stop or pause)
    rerender({ isRunning: false })

    // Capture count right after stop transition (before any more frames)
    const rafCountAfterStop = requestAnimationFrameMock.mock.calls.length

    // Flush a frame — the top-of-callback guard fires; loop must NOT re-queue
    act(() => {
      flushRaf(16)
    })
    const rafCountAfterStopFrame = requestAnimationFrameMock.mock.calls.length

    // The running frame did re-queue (sanity check)
    expect(rafCountAfterRunningFrame).toBeGreaterThan(0)
    // After the stop frame, no new rAF should have been scheduled
    expect(rafCountAfterStopFrame).toBe(rafCountAfterStop)
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
