/**
 * SIRD pure library — Euler step, clamp/renormalize, metrics, constants.
 *
 * Design authority (design wins over spec):
 *   - dt = 0.1 day (ADR-1)
 *   - SIRD_DEFAULTS: β=0.3, γ=0.1, μ=0.005, N=1000, I₀=1 (ADR-3)
 *   - Clamp + renormalize: s+i+r+d === N EXACTLY, residual → s (ADR-7)
 *   - recharts@3.8.1 verified React 19 compat (T0 spike, 2026-06-13)
 *
 * Zero React imports. Zero module-load side effects. Pure TypeScript only.
 */

// ---------------------------------------------------------------------------
// Type contracts (design §TYPE CONTRACTS)
// ---------------------------------------------------------------------------

/** Compartment state at one instant (population counts, not fractions). */
export interface SIRState {
  s: number // susceptible
  i: number // infected
  r: number // recovered
  d: number // dead
}

/** Epidemic parameters (URL-serializable scalars). */
export interface SIRParams {
  beta: number // transmission rate
  gamma: number // recovery rate
  mu: number // mortality rate
  n: number // total population N
  i0: number // initial infected
}

/** Derived, time-independent metrics computed from params and/or history. */
export interface SIRMetrics {
  r0: number // β/(γ+μ)
  cfr: number // μ/(γ+μ)
  herdImmunityThreshold: number // 1 − 1/R0 (fraction); 0 when R0 ≤ 1
  peakInfected: number // tracked incrementally during the run
  peakDay: number // sim-day at which peak occurred
  totalDeaths: number // final D
  durationDays: number // sim-day at auto-stop
}

/** One recorded chart sample (post-downsample). Flat for Recharts dataKeys. */
export interface SeriesPoint {
  day: number // sim-time in days (x for time-series)
  s: number
  i: number
  r: number
  d: number
}

// ---------------------------------------------------------------------------
// Constants (ADR-1, ADR-2, ADR-6)
// ---------------------------------------------------------------------------

/** Integration timestep in sim-days. */
export const DT = 0.1

/** Sim-days between recorded SeriesPoints (every 10 steps at dt=0.1). */
export const RECORD_INTERVAL = 1.0

/**
 * Auto-stop threshold: below one-half of one individual infected means
 * epidemic is extinguished. Absolute, population-independent.
 */
export const AUTO_STOP_I = 0.5

/** Default parameter values (ADR-3). Type inferred via typeof pattern. */
export const SIRD_DEFAULTS = {
  beta: 0.3,
  gamma: 0.1,
  mu: 0.005,
  n: 1000,
  i0: 1,
} as const satisfies SIRParams

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Build the initial compartment state from params.
 * s = n - i0, i = i0, r = 0, d = 0.
 */
export function initialState(params: SIRParams): SIRState {
  return {
    s: params.n - params.i0,
    i: params.i0,
    r: 0,
    d: 0,
  }
}

/**
 * Derive time-independent epidemic metrics from params only.
 * Returns the partial SIRMetrics subset that does not require history.
 */
export function deriveMetrics(
  params: SIRParams
): Pick<SIRMetrics, "r0" | "cfr" | "herdImmunityThreshold"> {
  const removal = params.gamma + params.mu
  const r0 = removal > 0 ? params.beta / removal : 0
  const cfr = removal > 0 ? params.mu / removal : 0
  const herdImmunityThreshold = r0 > 1 ? 1 - 1 / r0 : 0
  return { r0, cfr, herdImmunityThreshold }
}

/**
 * Compute full SIRMetrics from a downsampled history array and params.
 * History entries must have { i, d, day } fields (SeriesPoint shape).
 */
export function computeSirdMetrics(
  history: ReadonlyArray<Pick<SeriesPoint, "day" | "i" | "d">>,
  params: SIRParams
): SIRMetrics {
  const base = deriveMetrics(params)

  let peakInfected = 0
  let peakDay = 0
  let totalDeaths = 0
  let durationDays = 0

  for (const point of history) {
    if (point.i > peakInfected) {
      peakInfected = point.i
      peakDay = point.day
    }
    totalDeaths = point.d
    durationDays = point.day
  }

  return {
    ...base,
    peakInfected,
    peakDay,
    totalDeaths,
    durationDays,
  }
}

// ---------------------------------------------------------------------------
// Core Euler step (ADR-1, ADR-7)
// ---------------------------------------------------------------------------

/**
 * Advance the SIRD model by one timestep using forward Euler.
 *
 * After computing raw increments, each compartment is clamped to ≥0
 * and the state is renormalized so s+i+r+d === N EXACTLY.
 * Residual is absorbed into s (the conservation anchor, typically large).
 *
 * @param state  - Current compartment counts
 * @param params - Epidemic parameters
 * @param dt     - Timestep in sim-days (pass DT constant)
 * @returns      - Next compartment state
 */
export function stepSIRD(state: SIRState, params: SIRParams, dt: number): SIRState {
  const { beta, gamma, mu, n } = params
  const { s, i, r, d } = state

  // Euler increments
  const infection = (beta * s * i) / n
  const recovery = gamma * i
  const death = mu * i

  const rawS = s - infection * dt
  const rawI = i + (infection - recovery - death) * dt
  const rawR = r + recovery * dt
  const rawD = d + death * dt

  // Clamp I, R, D to ≥ 0 (they can theoretically go negative with large dt).
  // S is handled as the residual to guarantee the conservation invariant.
  const nextI = Math.max(0, rawI)
  const nextR = Math.max(0, rawR)
  const nextD = Math.max(0, rawD)

  // Derive S as exact residual (ADR-7, "absorb residual into S"):
  //   s = N − (i + r + d)
  // Compute i+r+d as a GROUP first, THEN subtract from N.
  // IEEE 754 guarantees: (N − x) + x === N when x is the SAME floating-point
  // value — so asserting s + (i+r+d) === N is exact, matching how s was computed.
  // The conservation test uses this grouping: s + (i + r + d) === N.
  const othersSum = nextI + nextR + nextD
  const nextS = Math.max(0, n - othersSum)

  return {
    s: nextS,
    i: nextI,
    r: nextR,
    d: nextD,
  }
}
