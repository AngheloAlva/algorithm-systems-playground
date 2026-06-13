/**
 * Unit tests for the SIRD pure library (T1).
 *
 * TDD: all tests written RED first, then sird.ts makes them green.
 *
 * Authority:
 *   - dt = 0.1 (design ADR-1; spec's SIM1.2-a fixture uses dt=1, NOT used here)
 *   - SIRD_DEFAULTS: beta=0.3, gamma=0.1, mu=0.005, n=1000, i0=1 (ADR-3)
 *   - Clamp + renormalize: normal path gives s+(i+r+d) === N bit-exactly; S-clamp within ~1e-12 (ADR-7)
 */

import { describe, it, expect } from "vitest"
import {
  DT,
  RECORD_INTERVAL,
  AUTO_STOP_I,
  SIRD_DEFAULTS,
  initialState,
  stepSIRD,
  deriveMetrics,
  computeSirdMetrics,
} from "./sird"

// ---------------------------------------------------------------------------
// T1-a — constants and SIRD_DEFAULTS shape (SIM1.1)
// ---------------------------------------------------------------------------

describe("constants (T1-a)", () => {
  it("DT is 0.1", () => {
    expect(DT).toBe(0.1)
  })

  it("RECORD_INTERVAL is 1.0", () => {
    expect(RECORD_INTERVAL).toBe(1.0)
  })

  it("AUTO_STOP_I is 0.5", () => {
    expect(AUTO_STOP_I).toBe(0.5)
  })

  it("SIRD_DEFAULTS has shape { beta:0.3, gamma:0.1, mu:0.005, n:1000, i0:1 }", () => {
    expect(SIRD_DEFAULTS.beta).toBe(0.3)
    expect(SIRD_DEFAULTS.gamma).toBe(0.1)
    expect(SIRD_DEFAULTS.mu).toBe(0.005)
    expect(SIRD_DEFAULTS.n).toBe(1000)
    expect(SIRD_DEFAULTS.i0).toBe(1)
  })

  it("initialState(SIRD_DEFAULTS) returns { s:999, i:1, r:0, d:0 }", () => {
    const state = initialState(SIRD_DEFAULTS)
    expect(state.s).toBe(999)
    expect(state.i).toBe(1)
    expect(state.r).toBe(0)
    expect(state.d).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// T1-b — Euler step correctness at dt=0.1 (SIM1.2, design ADR-1)
//
// Reference values computed from Euler formulas at dt=0.1:
//   start: { s:999, i:1, r:0, d:0 }, SIRD_DEFAULTS
//   dS = -0.3 * 999 * 1 / 1000 * 0.1 = -0.02997
//   dI = (0.3 * 999/1000 - 0.1 - 0.005) * 1 * 0.1 = 0.1947 * 0.1 = 0.01947
//   dR = 0.1 * 1 * 0.1 = 0.01
//   dD = 0.005 * 1 * 0.1 = 0.0005
// ---------------------------------------------------------------------------

describe("Euler step at dt=0.1 (T1-b)", () => {
  const start = initialState(SIRD_DEFAULTS)
  const next = stepSIRD(start, SIRD_DEFAULTS, DT)

  it("s after one step ≈ 998.97003 (±1e-9)", () => {
    expect(Math.abs(next.s - 998.97003)).toBeLessThan(1e-9)
  })

  it("i after one step ≈ 1.01947 (±1e-9)", () => {
    expect(Math.abs(next.i - 1.01947)).toBeLessThan(1e-9)
  })

  it("r after one step ≈ 0.01 (±1e-9)", () => {
    expect(Math.abs(next.r - 0.01)).toBeLessThan(1e-9)
  })

  it("d after one step ≈ 0.0005 (±1e-9)", () => {
    expect(Math.abs(next.d - 0.0005)).toBeLessThan(1e-9)
  })
})

// ---------------------------------------------------------------------------
// T1-c — invariant s+i+r+d === N EXACTLY (SIM1.3, design ADR-7)
// ---------------------------------------------------------------------------

describe("conservation invariant (T1-c)", () => {
  // stepSIRD computes s = N − (i + r + d) as a group.
  // IEEE 754: s + (i + r + d) === N exactly because (N − x) + x === N
  // when x is the same floating-point value.
  // Assertions mirror this grouping: s + (i + r + d) === N.

  it("s + (i+r+d) === N EXACTLY after one step", () => {
    const start = initialState(SIRD_DEFAULTS)
    const next = stepSIRD(start, SIRD_DEFAULTS, DT)
    expect(next.s + (next.i + next.r + next.d)).toBe(SIRD_DEFAULTS.n)
  })

  it("s + (i+r+d) === N EXACTLY at every step in a 1000-step loop", () => {
    let state = initialState(SIRD_DEFAULTS)
    const N = SIRD_DEFAULTS.n
    for (let step = 0; step < 1000; step++) {
      state = stepSIRD(state, SIRD_DEFAULTS, DT)
      expect(state.s + (state.i + state.r + state.d)).toBe(N)
    }
  })
})

// ---------------------------------------------------------------------------
// T1-d — non-negativity + clamp (SIM1.4)
// ---------------------------------------------------------------------------

describe("non-negativity (T1-d)", () => {
  it("s >= 0 with large beta and very small susceptible pool", () => {
    const aggressiveParams = { ...SIRD_DEFAULTS, beta: 10 }
    // Construct a state with very small s to force the residual path
    const state = { s: 0.0001, i: 500, r: 249.9999, d: 250 }
    const next = stepSIRD(state, aggressiveParams, DT)
    expect(next.s).toBeGreaterThanOrEqual(0)
  })

  it("all compartments >= 0 across 500 steps with aggressive params", () => {
    let state = initialState(SIRD_DEFAULTS)
    const aggressiveParams = { ...SIRD_DEFAULTS, beta: 5.0 }
    for (let step = 0; step < 500; step++) {
      state = stepSIRD(state, aggressiveParams, DT)
      expect(state.s).toBeGreaterThanOrEqual(0)
      expect(state.i).toBeGreaterThanOrEqual(0)
      expect(state.r).toBeGreaterThanOrEqual(0)
      expect(state.d).toBeGreaterThanOrEqual(0)
    }
  })

  it("S-clamp path: nextS === 0 AND nextI+nextR+nextD === N when othersSum > N", () => {
    // This test triggers the S-clamp path: othersSum > n after the step.
    // Use s:0, i:999, r:0, d:0 with beta:50 — infection term is 0 (no susceptibles)
    // but the high-beta test we really want is s:1, i:999, rest:0 with beta:50.
    // With beta=50, dt=0.1: infection = 50*1*999/1000 ≈ 49.95 per unit time
    // dI = (infection - gamma*i - mu*i)*dt ≈ (49.95 - 99.9 - 0.5)*0.1 ≈ -5.04 (I goes down)
    // Use a state where the I growth dominates: s:500, i:499, r:0, d:0, beta=50
    // infection = 50*500*499/1000 = 12475 per day, *0.1 = 1247.5 → nextI will be huge
    // dS = -infection*dt = -1247.5 → far negative → S clamps to 0
    // dI = (1247.5 - gamma*499 - mu*499)*0.1 ... rawI = 499 + 1247.5 - 49.9 - 2.495 ≈ 1694
    // othersSum = nextI + nextR + nextD > 1000 = n → S-clamp path fires
    const params = { ...SIRD_DEFAULTS, beta: 50 }
    const state = { s: 500, i: 499, r: 0, d: 0 }
    const next = stepSIRD(state, params, DT)
    expect(next.s).toBe(0) // clamped to 0
    expect(next.i + next.r + next.d).toBeCloseTo(SIRD_DEFAULTS.n, 10) // others sum to N
    expect(next.s + next.i + next.r + next.d).toBeCloseTo(SIRD_DEFAULTS.n, 10) // s+i+r+d === N
    expect(next.i).toBeGreaterThanOrEqual(0)
    expect(next.r).toBeGreaterThanOrEqual(0)
    expect(next.d).toBeGreaterThanOrEqual(0)
  })

  it("normal residual path (s:0, i:999, r:0, d:0, beta:50): s+(i+r+d) === N bit-exactly", () => {
    // s=0 means no new infections; othersSum <= n so the normal residual path fires:
    // nextS = n - othersSum. IEEE 754: (n - x) + x === n exactly for the same x.
    const params = { ...SIRD_DEFAULTS, beta: 50 }
    const state = { s: 0, i: 999, r: 0, d: 0 }
    const next = stepSIRD(state, params, DT)
    expect(next.s + (next.i + next.r + next.d)).toBe(SIRD_DEFAULTS.n)
    expect(next.s).toBeGreaterThanOrEqual(0)
    expect(next.i).toBeGreaterThanOrEqual(0)
  })

  it("conservation holds at EVERY step over 500 steps with beta=5 (catches silent S-clamp drift)", () => {
    let state = initialState(SIRD_DEFAULTS)
    const aggressiveParams = { ...SIRD_DEFAULTS, beta: 5 }
    const N = SIRD_DEFAULTS.n
    for (let step = 0; step < 500; step++) {
      state = stepSIRD(state, aggressiveParams, DT)
      // Within 1e-9 of N; S-clamp path (if triggered) is not bit-exact, so we
      // use an approximate bound here rather than strict ===.
      const sum = state.s + state.i + state.r + state.d
      expect(Math.abs(sum - N)).toBeLessThan(1e-9)
    }
  })
})

// ---------------------------------------------------------------------------
// T1-e — derived metrics (SIM1.5)
//
// SIRD_DEFAULTS: beta=0.3, gamma=0.1, mu=0.005
//   r0 = 0.3 / 0.105
//   cfr = 0.005 / 0.105
//   herd = 1 - 0.105/0.3
// ---------------------------------------------------------------------------

describe("deriveMetrics (T1-e)", () => {
  it("returns correct r0, cfr, herdImmunityThreshold for SIRD_DEFAULTS (±1e-6)", () => {
    const metrics = deriveMetrics(SIRD_DEFAULTS)
    const expectedR0 = 0.3 / 0.105
    const expectedCfr = 0.005 / 0.105
    const expectedHerd = 1 - 0.105 / 0.3
    expect(Math.abs(metrics.r0 - expectedR0)).toBeLessThan(1e-6)
    expect(Math.abs(metrics.cfr - expectedCfr)).toBeLessThan(1e-6)
    expect(Math.abs(metrics.herdImmunityThreshold - expectedHerd)).toBeLessThan(1e-6)
  })

  it("herdImmunityThreshold === 0 when R0 < 1 (beta=0.05, gamma=0.09, mu=0.01)", () => {
    const params = { ...SIRD_DEFAULTS, beta: 0.05, gamma: 0.09, mu: 0.01 }
    const metrics = deriveMetrics(params)
    // R0 = 0.05 / (0.09 + 0.01) = 0.05 / 0.1 = 0.5 < 1
    expect(metrics.herdImmunityThreshold).toBe(0)
  })

  it("computeSirdMetrics returns correct peakInfected, peakDay, totalDeaths from history", () => {
    // Build a small synthetic history
    const history = [
      { s: 990, i: 10, r: 0, d: 0, day: 0 },
      { s: 980, i: 18, r: 1, d: 1, day: 1 },
      { s: 960, i: 35, r: 3, d: 2, day: 2 }, // peak
      { s: 940, i: 28, r: 28, d: 4, day: 3 },
      { s: 930, i: 15, r: 50, d: 5, day: 4 },
    ]
    const metrics = computeSirdMetrics(history, SIRD_DEFAULTS)
    expect(metrics.peakInfected).toBe(35)
    expect(metrics.peakDay).toBe(2)
    expect(metrics.totalDeaths).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// T1-f — epidemic threshold (SIM1.6)
// ---------------------------------------------------------------------------

describe("epidemic threshold (T1-f)", () => {
  it("R0 < 1 → I monotonically decreases from step 1 (200 steps)", () => {
    // beta=0.05, gamma=0.09, mu=0.01 → R0 = 0.05/0.1 = 0.5
    const params = { beta: 0.05, gamma: 0.09, mu: 0.01, n: 1000, i0: 10 }
    let state = { s: 990, i: 10, r: 0, d: 0 }
    let prevI = state.i
    for (let step = 0; step < 200; step++) {
      state = stepSIRD(state, params, DT)
      expect(state.i).toBeLessThanOrEqual(prevI + 1e-12) // allow floating-point epsilon
      prevI = state.i
    }
  })

  it("R0 > 1 (SIRD_DEFAULTS) → I rises to a peak > I0 then falls", () => {
    let state = initialState(SIRD_DEFAULTS)
    const values: number[] = [state.i]
    // Run until auto-stop; guard cap prevents infinite loop if constant changes
    let steps = 0
    while (state.i >= AUTO_STOP_I && steps < 5000) {
      state = stepSIRD(state, SIRD_DEFAULTS, DT)
      values.push(state.i)
      steps++
    }
    const peak = Math.max(...values)
    // Peak must be above initial infected count
    expect(peak).toBeGreaterThan(SIRD_DEFAULTS.i0)
    // There must be a step where I increased from step 0
    const peakIdx = values.indexOf(peak)
    expect(peakIdx).toBeGreaterThan(0)
    // And I must have come back down
    expect(values[values.length - 1]).toBeLessThan(peak)
  })
})

// ---------------------------------------------------------------------------
// T1-h — n <= 0 guard (FIX B)
// ---------------------------------------------------------------------------

describe("n <= 0 guard (T1-h)", () => {
  it("n=0 → returns input state unchanged (no NaN, no mutation)", () => {
    const state = { s: 999, i: 1, r: 0, d: 0 }
    const result = stepSIRD(state, { ...SIRD_DEFAULTS, n: 0 }, DT)
    expect(result.s).toBe(state.s)
    expect(result.i).toBe(state.i)
    expect(result.r).toBe(state.r)
    expect(result.d).toBe(state.d)
    expect(Number.isNaN(result.s)).toBe(false)
    expect(Number.isNaN(result.i)).toBe(false)
    expect(Number.isNaN(result.r)).toBe(false)
    expect(Number.isNaN(result.d)).toBe(false)
  })

  it("n=-5 → returns input state unchanged", () => {
    const state = { s: 500, i: 300, r: 150, d: 50 }
    const result = stepSIRD(state, { ...SIRD_DEFAULTS, n: -5 }, DT)
    expect(result.s).toBe(state.s)
    expect(result.i).toBe(state.i)
    expect(result.r).toBe(state.r)
    expect(result.d).toBe(state.d)
  })
})

// ---------------------------------------------------------------------------
// T1-g — edge cases (SIM1.7)
// ---------------------------------------------------------------------------

describe("edge cases (T1-g)", () => {
  it("I=0 → all compartments stable (no-op)", () => {
    const state = { s: 1000, i: 0, r: 0, d: 0 }
    const next = stepSIRD(state, SIRD_DEFAULTS, DT)
    expect(next.s).toBe(1000)
    expect(next.i).toBe(0)
    expect(next.r).toBe(0)
    expect(next.d).toBe(0)
  })

  it("S=0, I=N → S stays 0, I decreases, d increases", () => {
    const params = SIRD_DEFAULTS
    const state = { s: 0, i: 1000, r: 0, d: 0 }
    const next = stepSIRD(state, params, DT)
    expect(next.s).toBe(0)
    expect(next.i).toBeLessThan(state.i)
    expect(next.d).toBeGreaterThan(0)
  })

  it("mu=0 → D stays 0, CFR=0, R0=beta/gamma", () => {
    const params = { ...SIRD_DEFAULTS, mu: 0 }
    let state = initialState(params)
    for (let step = 0; step < 100; step++) {
      state = stepSIRD(state, params, DT)
      expect(state.d).toBe(0)
    }
    const metrics = deriveMetrics(params)
    expect(metrics.cfr).toBe(0)
    expect(Math.abs(metrics.r0 - params.beta / params.gamma)).toBeLessThan(1e-12)
  })

  it("gamma=0 → R stays 0, CFR=1 (all removal through D)", () => {
    const params = { ...SIRD_DEFAULTS, gamma: 0 }
    let state = initialState(params)
    for (let step = 0; step < 100; step++) {
      state = stepSIRD(state, params, DT)
      expect(state.r).toBe(0)
    }
    const metrics = deriveMetrics(params)
    expect(metrics.cfr).toBe(1)
  })

  it("beta=5.0, dt=0.1 → no NaN, no compartment negative, t not used", () => {
    const params = { ...SIRD_DEFAULTS, beta: 5.0 }
    let state = initialState(params)
    for (let step = 0; step < 50; step++) {
      state = stepSIRD(state, params, DT)
      expect(Number.isNaN(state.s)).toBe(false)
      expect(Number.isNaN(state.i)).toBe(false)
      expect(Number.isNaN(state.r)).toBe(false)
      expect(Number.isNaN(state.d)).toBe(false)
      expect(state.s).toBeGreaterThanOrEqual(0)
      expect(state.i).toBeGreaterThanOrEqual(0)
      expect(state.r).toBeGreaterThanOrEqual(0)
      expect(state.d).toBeGreaterThanOrEqual(0)
    }
  })

  it("gamma=0, mu=0 degenerate case → deriveMetrics returns r0=0, cfr=0, herdImmunityThreshold=0", () => {
    // When removal rate (gamma + mu) = 0, R0 is mathematically undefined.
    // Convention: report r0=0, cfr=0, herdImmunityThreshold=0 (no epidemic threshold).
    const params = { ...SIRD_DEFAULTS, gamma: 0, mu: 0 }
    const metrics = deriveMetrics(params)
    expect(metrics.r0).toBe(0)
    expect(metrics.cfr).toBe(0)
    expect(metrics.herdImmunityThreshold).toBe(0)
  })
})
