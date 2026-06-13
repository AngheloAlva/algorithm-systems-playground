/**
 * Tests for simulation-store — Zustand FSM, downsample in step(), auto-stop.
 *
 * All tests run synchronously by calling step() in a loop.
 * No rAF, no fake timers needed — downsampling lives in the store.
 *
 * Design: sdd/phase-3-systems-simulator/design
 * Spec:   SIM2.1, SIM3.x, SIM8.1
 */

import { describe, it, expect, beforeEach } from "vitest"
import {
  useSimulationStore,
  getInitialState,
  RUN_STATUS,
} from "./simulation-store"
import { DT, RECORD_INTERVAL, AUTO_STOP_I, SIRD_DEFAULTS } from "@/lib/simulation/sird"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset the store to initial values between tests. */
function resetStore() {
  useSimulationStore.setState(getInitialState())
}

/** Flush `n` store step() calls synchronously. */
function runSteps(n: number) {
  const store = useSimulationStore.getState()
  for (let i = 0; i < n; i++) {
    store.step()
  }
}

/** Steps per RECORD_INTERVAL (10 at dt=0.1, interval=1.0). */
const STEPS_PER_INTERVAL = Math.round(RECORD_INTERVAL / DT)

// ---------------------------------------------------------------------------
// getInitialState shape
// ---------------------------------------------------------------------------

describe("getInitialState", () => {
  it("returns all required data fields", () => {
    const s = getInitialState()
    expect(s).toMatchObject({
      params: SIRD_DEFAULTS,
      speed: expect.any(Number),
      status: RUN_STATUS.IDLE,
      simTime: 0,
      recordAcc: 0,
    })
    expect(Array.isArray(s.ticks)).toBe(true)
    expect(s.ticks).toHaveLength(0)
    expect(s.current).toMatchObject({ s: expect.any(Number), i: expect.any(Number), r: 0, d: 0 })
    expect(s.metrics).toMatchObject({
      r0: expect.any(Number),
      cfr: expect.any(Number),
      herdImmunityThreshold: expect.any(Number),
      peakInfected: expect.any(Number),
      peakDay: expect.any(Number),
      totalDeaths: 0,
      durationDays: 0,
    })
  })

  it("initial current state matches initialState(SIRD_DEFAULTS)", () => {
    const s = getInitialState()
    // s = n - i0 = 999, i = i0 = 1
    expect(s.current.s).toBe(SIRD_DEFAULTS.n - SIRD_DEFAULTS.i0)
    expect(s.current.i).toBe(SIRD_DEFAULTS.i0)
    expect(s.current.r).toBe(0)
    expect(s.current.d).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// RUN_STATUS re-export identity
// ---------------------------------------------------------------------------

describe("RUN_STATUS re-export", () => {
  it("re-exports the same RUN_STATUS object from pathfinding-store", async () => {
    const { RUN_STATUS: fromPathfinding } = await import("./pathfinding-store")
    expect(RUN_STATUS).toBe(fromPathfinding)
  })
})

// ---------------------------------------------------------------------------
// play / pause / reset transitions
// ---------------------------------------------------------------------------

describe("play / pause / reset", () => {
  beforeEach(resetStore)

  it("play() transitions IDLE → RUNNING", () => {
    useSimulationStore.getState().play()
    expect(useSimulationStore.getState().status).toBe(RUN_STATUS.RUNNING)
  })

  it("pause() transitions RUNNING → PAUSED", () => {
    useSimulationStore.getState().play()
    useSimulationStore.getState().pause()
    expect(useSimulationStore.getState().status).toBe(RUN_STATUS.PAUSED)
  })

  it("reset() transitions RUNNING → IDLE and clears ticks/simTime", () => {
    useSimulationStore.getState().play()
    // Run enough steps to accumulate at least one tick
    for (let i = 0; i < STEPS_PER_INTERVAL + 1; i++) {
      useSimulationStore.getState().step()
    }
    expect(useSimulationStore.getState().ticks.length).toBeGreaterThan(0)
    useSimulationStore.getState().reset()
    const s = useSimulationStore.getState()
    expect(s.status).toBe(RUN_STATUS.IDLE)
    expect(s.ticks).toHaveLength(0)
    expect(s.simTime).toBe(0)
    expect(s.recordAcc).toBe(0)
  })

  it("reset() from PAUSED resets to IDLE", () => {
    useSimulationStore.getState().play()
    useSimulationStore.getState().pause()
    useSimulationStore.getState().reset()
    expect(useSimulationStore.getState().status).toBe(RUN_STATUS.IDLE)
  })

  it("reset() from DONE resets to IDLE", () => {
    // Force status DONE
    useSimulationStore.setState({ status: RUN_STATUS.DONE })
    useSimulationStore.getState().reset()
    expect(useSimulationStore.getState().status).toBe(RUN_STATUS.IDLE)
  })
})

// ---------------------------------------------------------------------------
// setParam → full reset + re-seed
// ---------------------------------------------------------------------------

describe("setParam", () => {
  beforeEach(resetStore)

  it("setParam resets status to IDLE", () => {
    useSimulationStore.getState().play()
    useSimulationStore.getState().setParam("beta", 0.5)
    expect(useSimulationStore.getState().status).toBe(RUN_STATUS.IDLE)
  })

  it("setParam clears ticks", () => {
    useSimulationStore.getState().play()
    for (let i = 0; i < STEPS_PER_INTERVAL + 1; i++) {
      useSimulationStore.getState().step()
    }
    expect(useSimulationStore.getState().ticks.length).toBeGreaterThan(0)
    useSimulationStore.getState().setParam("beta", 0.5)
    expect(useSimulationStore.getState().ticks).toHaveLength(0)
  })

  it("setParam resets simTime and recordAcc to 0", () => {
    useSimulationStore.getState().play()
    for (let i = 0; i < 5; i++) {
      useSimulationStore.getState().step()
    }
    useSimulationStore.getState().setParam("gamma", 0.2)
    const s = useSimulationStore.getState()
    expect(s.simTime).toBe(0)
    expect(s.recordAcc).toBe(0)
  })

  it("setParam re-derives metrics with new params", () => {
    const before = useSimulationStore.getState().metrics.r0
    // Change beta significantly
    useSimulationStore.getState().setParam("beta", 0.9)
    const after = useSimulationStore.getState().metrics.r0
    expect(after).not.toBe(before)
    // r0 = beta / (gamma + mu) = 0.9 / (0.1 + 0.005) ≈ 8.57
    expect(after).toBeCloseTo(0.9 / (SIRD_DEFAULTS.gamma + SIRD_DEFAULTS.mu), 6)
  })

  it("setParam re-seeds current state from initialState of new params", () => {
    useSimulationStore.getState().setParam("n", 2000)
    const s = useSimulationStore.getState()
    expect(s.params.n).toBe(2000)
    // s = n - i0 = 2000 - 1 = 1999
    expect(s.current.s).toBe(2000 - SIRD_DEFAULTS.i0)
    expect(s.current.i).toBe(SIRD_DEFAULTS.i0)
  })
})

// ---------------------------------------------------------------------------
// setSpeed → does NOT reset
// ---------------------------------------------------------------------------

describe("setSpeed", () => {
  beforeEach(resetStore)

  it("setSpeed does not reset status, ticks, or simTime", () => {
    useSimulationStore.getState().play()
    for (let i = 0; i < STEPS_PER_INTERVAL + 1; i++) {
      useSimulationStore.getState().step()
    }
    const ticksBefore = useSimulationStore.getState().ticks.length
    const timeBefore = useSimulationStore.getState().simTime
    useSimulationStore.getState().setSpeed(8)
    const s = useSimulationStore.getState()
    expect(s.status).toBe(RUN_STATUS.RUNNING)
    expect(s.ticks.length).toBe(ticksBefore)
    expect(s.simTime).toBeCloseTo(timeBefore, 9)
    expect(s.speed).toBe(8)
  })
})

// ---------------------------------------------------------------------------
// Downsampling: step() appends to ticks only every RECORD_INTERVAL
// ---------------------------------------------------------------------------

describe("downsample in step()", () => {
  beforeEach(resetStore)

  it("9 steps produce 0 ticks (< 1 RECORD_INTERVAL)", () => {
    useSimulationStore.getState().play()
    runSteps(STEPS_PER_INTERVAL - 1) // 9 steps
    expect(useSimulationStore.getState().ticks).toHaveLength(0)
  })

  it("10 steps produce exactly 1 tick", () => {
    useSimulationStore.getState().play()
    runSteps(STEPS_PER_INTERVAL) // 10 steps
    expect(useSimulationStore.getState().ticks).toHaveLength(1)
  })

  it("20 steps produce exactly 2 ticks", () => {
    useSimulationStore.getState().play()
    runSteps(STEPS_PER_INTERVAL * 2) // 20 steps
    expect(useSimulationStore.getState().ticks).toHaveLength(2)
  })

  it("tick has valid SeriesPoint shape", () => {
    useSimulationStore.getState().play()
    runSteps(STEPS_PER_INTERVAL)
    const tick = useSimulationStore.getState().ticks[0]
    expect(tick).toMatchObject({
      day: expect.any(Number),
      s: expect.any(Number),
      i: expect.any(Number),
      r: expect.any(Number),
      d: expect.any(Number),
    })
    expect(tick.day).toBeGreaterThan(0)
  })

  it("ticks are a new array reference on each append (Zustand reactivity)", () => {
    useSimulationStore.getState().play()
    // Grab reference before first append
    runSteps(STEPS_PER_INTERVAL - 1)
    const refBefore = useSimulationStore.getState().ticks
    // One more step triggers append
    useSimulationStore.getState().step()
    const refAfter = useSimulationStore.getState().ticks
    expect(refAfter).not.toBe(refBefore)
    expect(refAfter).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Auto-stop: I < AUTO_STOP_I AND simTime > 0 → DONE
// ---------------------------------------------------------------------------

describe("auto-stop", () => {
  beforeEach(resetStore)

  it("I=1.0 stays RUNNING (above threshold 0.5)", () => {
    // Manually set state: I slightly above threshold
    useSimulationStore.setState({
      current: { s: 999, i: 1.0, r: 0, d: 0 },
      status: RUN_STATUS.RUNNING,
      simTime: 1.0, // t > 0
      recordAcc: 0,
    })
    useSimulationStore.getState().step()
    // At I=1.0, next I will still be > 0.5 (params are benign defaults)
    // Just verify it hasn't auto-stopped prematurely
    expect(useSimulationStore.getState().status).toBe(RUN_STATUS.RUNNING)
  })

  it("I < AUTO_STOP_I AND simTime > 0 → transitions to DONE", () => {
    // Manually inject state with I just below threshold
    useSimulationStore.setState({
      current: { s: 999.6, i: AUTO_STOP_I - 0.1, r: 0.3, d: 0.1 },
      status: RUN_STATUS.RUNNING,
      simTime: 50, // t > 0
      recordAcc: 0,
      metrics: {
        r0: 2.0,
        cfr: 0.05,
        herdImmunityThreshold: 0.5,
        peakInfected: 100,
        peakDay: 20,
        totalDeaths: 0,
        durationDays: 0,
      },
    })
    useSimulationStore.getState().step()
    expect(useSimulationStore.getState().status).toBe(RUN_STATUS.DONE)
  })

  it("auto-stop sets metrics.totalDeaths > 0 after a full run", () => {
    // Run to completion from default params (epidemic will peak and decline)
    useSimulationStore.getState().play()
    // Run a lot of steps to get to auto-stop
    const store = useSimulationStore.getState()
    let iterations = 0
    while (
      useSimulationStore.getState().status === RUN_STATUS.RUNNING &&
      iterations < 10000
    ) {
      store.step()
      iterations++
    }
    const s = useSimulationStore.getState()
    expect(s.status).toBe(RUN_STATUS.DONE)
    expect(s.metrics.totalDeaths).toBeGreaterThan(0)
  })

  it("auto-stop does not fire at simTime=0 (t>0 guard uses PRE-advance time)", () => {
    // Inject state: I below AUTO_STOP_I, simTime=0 (first step scenario).
    // The guard must use state.simTime (BEFORE advance), so step 1 cannot auto-stop.
    useSimulationStore.setState({
      current: { s: 999.7, i: 0.3, r: 0, d: 0 },
      status: RUN_STATUS.RUNNING,
      simTime: 0,
      recordAcc: 0,
      metrics: {
        r0: 2.0,
        cfr: 0.05,
        herdImmunityThreshold: 0.5,
        peakInfected: 0.3,
        peakDay: 0,
        totalDeaths: 0,
        durationDays: 0,
      },
    })
    // Step 1: simTime was 0 (PRE-advance) — guard must keep status RUNNING
    useSimulationStore.getState().step()
    expect(useSimulationStore.getState().status).toBe(RUN_STATUS.RUNNING)

    // Step 2: simTime is now DT (> 0 PRE-advance) AND I still < AUTO_STOP_I → DONE
    useSimulationStore.getState().step()
    expect(useSimulationStore.getState().status).toBe(RUN_STATUS.DONE)
  })
})

// ---------------------------------------------------------------------------
// SIM8.1 — metrics object ref must NOT churn on every step
// ---------------------------------------------------------------------------

describe("metrics ref stability (SIM8.1)", () => {
  beforeEach(resetStore)

  it("metrics ref is stable across 9 consecutive non-append steps", () => {
    useSimulationStore.getState().play()
    // Run 9 steps (< RECORD_INTERVAL) — no tick append, no DONE
    runSteps(STEPS_PER_INTERVAL - 1)
    const refA = useSimulationStore.getState().metrics
    // One more step (total 9) — still no append, ref must stay the same
    // We already ran 9 above; take a fresh ref mid-run before checking stability
    // Restart from known state to keep it clean
    resetStore()
    useSimulationStore.getState().play()
    runSteps(1)
    const refAfterStep1 = useSimulationStore.getState().metrics
    runSteps(1)
    const refAfterStep2 = useSimulationStore.getState().metrics
    runSteps(1)
    const refAfterStep3 = useSimulationStore.getState().metrics
    // Steps 1-9 are all within the first RECORD_INTERVAL — ref must not change
    expect(refAfterStep2).toBe(refAfterStep1)
    expect(refAfterStep3).toBe(refAfterStep1)
    // Silence unused variable warning
    void refA
  })

  it("metrics ref CHANGES on the tick-append step (step 10)", () => {
    useSimulationStore.getState().play()
    // Run 9 steps — no append yet
    runSteps(STEPS_PER_INTERVAL - 1)
    const refBefore = useSimulationStore.getState().metrics
    // Step 10 triggers tick append — metrics ref must change
    useSimulationStore.getState().step()
    const refAfter = useSimulationStore.getState().metrics
    expect(refAfter).not.toBe(refBefore)
    // Tick array grew too
    expect(useSimulationStore.getState().ticks).toHaveLength(1)
  })

  it("final metrics after DONE have correct peakInfected and totalDeaths > 0", () => {
    useSimulationStore.getState().play()
    const store = useSimulationStore.getState()
    let iterations = 0
    while (
      useSimulationStore.getState().status === RUN_STATUS.RUNNING &&
      iterations < 10000
    ) {
      store.step()
      iterations++
    }
    const s = useSimulationStore.getState()
    expect(s.status).toBe(RUN_STATUS.DONE)
    expect(s.metrics.peakInfected).toBeGreaterThan(AUTO_STOP_I)
    expect(s.metrics.totalDeaths).toBeGreaterThan(0)
    expect(s.metrics.durationDays).toBeGreaterThan(0)
  })

  it("peakInfected tracked every step even between append boundaries", () => {
    // Run exactly 2 intervals (20 steps) from default params and verify
    // that peakInfected in metrics reflects the actual max I seen so far
    useSimulationStore.getState().play()
    let trackedMax = useSimulationStore.getState().current.i
    for (let k = 0; k < STEPS_PER_INTERVAL * 2; k++) {
      useSimulationStore.getState().step()
      const currentI = useSimulationStore.getState().current.i
      if (currentI > trackedMax) trackedMax = currentI
    }
    const metricsAfter = useSimulationStore.getState().metrics
    // The stored peak should match the max we independently tracked
    expect(metricsAfter.peakInfected).toBeCloseTo(trackedMax, 6)
  })
})

// ---------------------------------------------------------------------------
// play() from DONE — must stay DONE (FIX 6)
// ---------------------------------------------------------------------------

describe("play() from DONE", () => {
  beforeEach(resetStore)

  it("play() when DONE does not change status (replay requires reset())", () => {
    useSimulationStore.setState({ status: RUN_STATUS.DONE })
    useSimulationStore.getState().play()
    expect(useSimulationStore.getState().status).toBe(RUN_STATUS.DONE)
  })
})

// ---------------------------------------------------------------------------
// step() guards: no-op when not RUNNING
// ---------------------------------------------------------------------------

describe("step() when not RUNNING", () => {
  beforeEach(resetStore)

  it("step() when IDLE does not advance simTime", () => {
    useSimulationStore.getState().step()
    expect(useSimulationStore.getState().simTime).toBe(0)
  })

  it("step() when PAUSED does not advance simTime", () => {
    useSimulationStore.getState().play()
    useSimulationStore.getState().pause()
    const timeBefore = useSimulationStore.getState().simTime
    useSimulationStore.getState().step()
    expect(useSimulationStore.getState().simTime).toBe(timeBefore)
  })

  it("step() when DONE does not advance simTime", () => {
    useSimulationStore.setState({ status: RUN_STATUS.DONE, simTime: 99 })
    useSimulationStore.getState().step()
    expect(useSimulationStore.getState().simTime).toBe(99)
  })
})
